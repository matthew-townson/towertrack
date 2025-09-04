import log from '$lib/server/log.js';
import pool from '$lib/server/db.js';
import fetch from 'node-fetch';
import xml2js from 'xml2js';

export async function importBBData(userId) {
    // Get username, aliases, and exShort setting
    const [[user]] = await pool.query('SELECT username FROM User WHERE id = ?', [userId]);
    const [aliases] = await pool.query('SELECT Name FROM OtherNames WHERE userId = ?', [userId]);
    const [[settings]] = await pool.query('SELECT exShort FROM UserSettings WHERE userId = ?', [userId]);
    const names = [user.username, ...aliases.map(a => a.Name)];
    const exShort = !!settings?.exShort;

    log.info(`Importing BellBoard data for username=${user.username}`);

    // Helper to build BellBoard search URL
    function buildUrl(name, length) {
        const params = new URLSearchParams({
            ringer: name,
            bells_type: 'tower',
            automated_ringing: '0',
            simulated_sound: '0',
            pagesize: '9999',
            fmt: 'xml',
            length: length
        });
        return `https://bb.ringingworld.co.uk/export.php?${params.toString()}`;
    }

    // Helper to clean XML objects by removing $ keys and flattening _ keys
    function cleanXml(obj) {
        if (Array.isArray(obj)) {
            return obj.map(cleanXml);
        } else if (typeof obj === 'object' && obj !== null) {
            if ('_' in obj && Object.keys(obj).length === 1) {
                return obj._;
            }
            const result = {};
            for (const key in obj) {
                if (key === '$') continue;
                result[key] = cleanXml(obj[key]);
            }
            return result;
        }
        return obj;
    }

    // Helper to convert hundredweight format (e.g. "30-2-2 in Db") to lbs
    function cwtToLbs(str) {
        if (!str) return null;
        
        // First try to match the full format (e.g. "30-2-2")
        let match = str.match(/(\d{1,2})-(\d{1,2})-(\d{1,2})/);
        if (match) {
            const [_, cwt, qtr, lbs] = match;
            const total = 112 * parseInt(cwt) + 28 * parseInt(qtr) + parseInt(lbs);
            return total;
        }
        
        // If no full format match, try to match just a single number (hundredweight only)
        match = str.match(/(\d{1,2})/);
        if (match) {
            const cwt = match[1];
            const total = 112 * parseInt(cwt);
            return total;
        }
        
        return null;
    }

    // Helper to extract ringers from <ringers> XML
    function parseRingersTag(ringersTag) {
        if (!Array.isArray(ringersTag)) return [];
        return ringersTag.map(r => ({
            name: typeof r._ === 'string' ? r._ : r,
            conductor: r.$?.conductor === 'true' ? 1 : 0
        }));
    }

    // Helper to extract footnotes from <footnote> XML
    function parseFootnotesTag(footnotesTag) {
        if (!Array.isArray(footnotesTag)) return [];
        return footnotesTag.map(f => typeof f === 'string' ? f : f._).filter(Boolean);
    }

    // Helper to extract place, dedication, county, towerid, tenor from place XML
    function extractPlaceFields(placeObj) {
        let Place = null, Dedication = null, County = null, towerID = null, tenorWeightLbs = null;
        if (placeObj) {
            towerID = placeObj.$?.['dove-tower-id'] ? parseInt(placeObj.$['dove-tower-id']) : null;
            if (placeObj['place-name']) {
                for (const pn of Array.isArray(placeObj['place-name']) ? placeObj['place-name'] : [placeObj['place-name']]) {
                    const type = pn.$?.type || pn.type || null;
                    const value = pn._ || pn || null;
                    if (type === 'place') Place = value;
                    else if (type === 'dedication') Dedication = value;
                    else if (type === 'county') County = value;
                }
            }

            const ringObj = placeObj.ring?.[0] || placeObj.ring;
            if (ringObj && (ringObj.$?.tenor || ringObj.tenor)) {
                const tenorStr = ringObj.$?.tenor || ringObj.tenor;
                tenorWeightLbs = cwtToLbs(tenorStr);
            }
        }
        return { Place, Dedication, County, towerID, tenorWeightLbs };
    }

    // Helper to build the performance object for insertion
    function buildPerformanceObject(perf, perfId) {
        // Clean XML for place
        const placeObj = perf.place?.[0];
        const { Place, Dedication, County, towerID, tenorWeightLbs } = extractPlaceFields(placeObj);
        // Extract changes and method from <title>
        const changes = perf.title?.[0]?.changes?.[0] ? parseInt(perf.title[0].changes[0]) : null;
        const method = perf.title?.[0]?.method?.[0] || null;
        // Ringers
        const ringers = parseRingersTag(perf.ringers?.[0]?.ringer || []);
        // Footnotes
        const footnotes = parseFootnotesTag(perf.footnote || []);
        return {
            performanceID: perfId ? parseInt(perfId) : null,
            association: perf.association?.[0] || null,
            towerID: towerID,
            place: Place,
            dedication: Dedication,
            county: County,
            tenorWeightLbs: tenorWeightLbs,
            date: perf.date?.[0] || null,
            duration: perf.duration?.[0] || null,
            changes: changes,
            method: method,
            ringers: { ringers },
            timestamp: perf.timestamp?.[0] || null,
            footnotes: footnotes
        };
    }

    // Fetch and process performances for each name and length
    async function fetchAndInsert(name, length, filterChanges = false) {
        const url = buildUrl(name, length);
        const res = await fetch(url);
        if (!res.ok) {
            log.error(`Failed to fetch BellBoard data for "${name}" (URL: ${url}, Status: ${res.status})`);
            return;
        }
        const xml = await res.text();
        const data = await xml2js.parseStringPromise(xml, { explicitArray: true });
        const performances = data.performances?.performance || [];
        for (const perf of performances) {
            let perfId = perf.$?.id || perf.id?.[0];
            if (perfId && perfId.startsWith('P')) perfId = perfId.slice(1);
            const perfObj = buildPerformanceObject(perf, perfId);

            // Use INSERT IGNORE to skip if performance already exists
            try {
            await pool.query(
                `INSERT IGNORE INTO Performance (PerformanceID, Association, TowerID, Place, Dedication, County, TenorWeightLbs, Date, Duration, Changes, Method, Ringers, Timestamp, Footnotes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                perfObj.performanceID,
                perfObj.association,
                perfObj.towerID,
                perfObj.place,
                perfObj.dedication,
                perfObj.county,
                perfObj.tenorWeightLbs,
                perfObj.date,
                perfObj.duration,
                perfObj.changes,
                perfObj.method,
                JSON.stringify(perfObj.ringers),
                perfObj.timestamp,
                JSON.stringify(perfObj.footnotes)
                ]
            );
            } catch (err) {
            log.error(`DB error inserting performance ID: ${perfObj.performanceID} - ${err.message}`);
            }
        }
    }

    // Main import logic
    for (const name of names) {
        log.debug(`Begin importing for name/alias: ${name}`);
        if (exShort) {
            await fetchAndInsert(name, 'e-plus');
        } else {
            await fetchAndInsert(name, 'e-plus');
            await fetchAndInsert(name, 'vshort', true);
        }
    }
    log.success(`${user.username} imported performances from BellBoard`);
}