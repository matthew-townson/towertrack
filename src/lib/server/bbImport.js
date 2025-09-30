import log from '$lib/server/log.js';
import pool from '$lib/server/db.js';
import fetch from 'node-fetch';
import xml2js from 'xml2js';

export const importProgress = new Map();

function initProgress(userId) {
    importProgress.set(userId, {
        stage: 'starting',
        message: 'Initializing import',
        total: 0,
        processed: 0,
        percent: 0,
        lastUpdated: Date.now()
    });
}

function setProgress(userId, update) {
    const cur = importProgress.get(userId) || {
        stage: 'starting',
        message: '',
        total: 0,
        processed: 0,
        percent: 0,
        lastUpdated: Date.now()
    };
    const merged = { ...cur, ...update, lastUpdated: Date.now() };
    if (typeof merged.total === 'number' && typeof merged.processed === 'number') {
        merged.percent = merged.total > 0 ? Math.round((merged.processed / merged.total) * 100) : (merged.stage === 'done' ? 100 : merged.percent || 0);
    }
    importProgress.set(userId, merged);
}

function getProgress(userId) {
    return importProgress.get(userId) || { stage: 'idle', message: '', total: 0, processed: 0, percent: 0 };
}

async function getPerfHTTPStatus(performanceID) {
    if (!performanceID) return null;
    const url = `https://bb.ringingworld.co.uk/view.php?id=${performanceID}`;
    try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
        if (res.status === 302 && res.headers.get('location')) {
            const location = res.headers.get('location');
            const match = location.match(/id=(\d+)/);
            if (match) {
                return match[1];
            }
        }
        if (res.status === 200) {
            return performanceID;
        }
        return null;
    } catch {
        return null;
    }
}

async function cleanExistingPerformancesForUser(userId, normalisedNames) {
    const [rows] = await pool.query(`SELECT PerformanceID, Ringers FROM Performance`);
    for (const row of rows) {
        let ringers;
        try {
            ringers = typeof row.Ringers === 'string' ? JSON.parse(row.Ringers) : row.Ringers;
        } catch {
            ringers = row.Ringers;
        }
        const perfRingers = Array.isArray(ringers?.ringers) ? ringers.ringers : [];
        const hasUser = perfRingers.some(r =>
            normalisedNames.includes(
                String(r.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
            )
        );
        if (!hasUser) continue;
        const perfId = row.PerformanceID;
        const finalId = await getPerfHTTPStatus(perfId);
        if (!finalId) {
            await pool.query(`DELETE FROM Performance WHERE PerformanceID = ?`, [perfId]);
        } else if (String(finalId) !== String(perfId)) {
            await pool.query(`DELETE FROM Performance WHERE PerformanceID = ?`, [perfId]);
        }
    }
}

export async function importBBData(userId) {
    const [[user]] = await pool.query('SELECT username FROM User WHERE id = ?', [userId]);
    const [aliases] = await pool.query('SELECT Name FROM OtherNames WHERE userId = ?', [userId]);
    const [[settings]] = await pool.query('SELECT exShort, bellsPercent FROM UserSettings WHERE userId = ?', [userId]);
    const names = [user.username, ...aliases.map(a => a.Name)];
    const exShort = !!settings?.exShort;

    const normalisedNames = names.map(n => String(n).trim().toLowerCase().replace(/\s+/g, ' '));
    await cleanExistingPerformancesForUser(userId, normalisedNames);

    log.info(`Importing BellBoard data for ${user.username}`);
    const importStart = Date.now();
    let processedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;

    initProgress(userId);
    setProgress(userId, { stage: 'starting', message: 'Starting BellBoard import', total: 0, processed: 0 });

    function normName(n) {
        if (!n) return '';
        return String(n).trim().toLowerCase().replace(/\s+/g, ' ');
    }
    const userMinPercent = typeof settings?.bellsPercent === 'number' ? Number(settings.bellsPercent) : (settings?.bellsPercent ? Number(settings.bellsPercent) : 100);

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

    function cwtToLbs(str) {
        if (!str) return null;
        
        let match = str.match(/(\d{1,2})-(\d{1,2})-(\d{1,2})/);
        if (match) {
            const [_, cwt, qtr, lbs] = match;
            const total = 112 * parseInt(cwt) + 28 * parseInt(qtr) + parseInt(lbs);
            return total;
        }
        
        match = str.match(/(\d{1,2})/);
        if (match) {
            const cwt = match[1];
            const total = 112 * parseInt(cwt);
            return total;
        }
        
        return null;
    }

    function numOrNull(x) {
        const n = Number(x);
        return Number.isFinite(n) ? n : null;
    }

    function parseRingersTag(ringersTag) {
        if (!Array.isArray(ringersTag)) return [];
        return ringersTag.map(r => ({
            bell: r.$?.bell ? numOrNull(r.$?.bell) : null,
            name: typeof r._ === 'string' ? r._ : r,
            conductor: r.$?.conductor === 'true' ? 1 : 0
        }));
    }

    function parseFootnotesTag(footnotesTag) {
        if (!Array.isArray(footnotesTag)) return [];
        return footnotesTag.map(f => typeof f === 'string' ? f : f._).filter(Boolean);
    }

    function extractPlaceFields(placeObj) {
        let Place = null, Dedication = null, County = null, towerID = null, tenorWeightLbs = null, tenorKey = null, ringID = null;
        if (placeObj) {
            towerID = placeObj.$?.['dove-tower-id'] ? numOrNull(placeObj.$['dove-tower-id']) : null;
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
                
                const keyMatch = tenorStr.match(/in\s+([A-G][b#]?)/i);
                if (keyMatch) {
                    tenorKey = keyMatch[1];
                }
            }

            if (ringObj && ringObj.$?.['dove-ring-id']) {
                ringID = numOrNull(ringObj.$['dove-ring-id']);
            }
        }
        return { Place, Dedication, County, towerID, tenorWeightLbs, tenorKey, ringID };
    }

    function buildPerformanceObject(perf, perfId) {
        const placeObj = perf.place?.[0];
        const { Place, Dedication, County, towerID, tenorWeightLbs, tenorKey, ringID } = extractPlaceFields(placeObj);
        const rawChanges = perf.title?.[0]?.changes?.[0];
        const changes = numOrNull(rawChanges ? rawChanges : null);
        const method = perf.title?.[0]?.method?.[0] || null;
        const ringers = parseRingersTag(perf.ringers?.[0]?.ringer || []);
        const footnotes = parseFootnotesTag(perf.footnote || []);

        return {
            performanceID: perfId ? numOrNull(perfId) : null,
            association: perf.association?.[0] || null,
            towerID: towerID,
            ringID: ringID,
            place: Place,
            dedication: Dedication,
            county: County,
            tenorWeightLbs: tenorWeightLbs,
            tenorKey: tenorKey,
            date: perf.date?.[0] || null,
            duration: perf.duration?.[0] || null,
            changes: changes,
            method: method,
            ringers: { ringers },
            timestamp: perf.timestamp?.[0] || null,
            footnotes: footnotes
        };
    }

    async function addGrab(perfObj) {
        try {
            if (!perfObj || !perfObj.towerID) return;

            ////log.debug(`addGrab: checking perf ${perfObj.performanceID} (tower=${perfObj.towerID}, ring=${perfObj.ringID}, date=${perfObj.date})`);

            const perfRingers = Array.isArray(perfObj.ringers?.ringers) ? perfObj.ringers.ringers : (Array.isArray(perfObj.ringers) ? perfObj.ringers : []);
            if (!perfRingers || perfRingers.length === 0) return;

            const matchedRingers = perfRingers.filter(r => {
                const candidate = normName(typeof r.name === 'string' ? r.name.replace(/\s*\(.*?\)\s*$/, '') : r.name);
                return normalisedNames.includes(candidate);
            });
            ////log.debug(`addGrab: matchedRingers for perf ${perfObj.performanceID}: ${matchedRingers.length}`);
            if (matchedRingers.length === 0) return;

            let bellRows = [];
            try {
                if (perfObj.ringID) {
                    const [rows] = await pool.query(
                        `SELECT BellID, BellRole, BellName, WeightLbs, Note FROM Bell WHERE TowerID = ? AND RingID = ? ORDER BY CAST(BellRole AS SIGNED) ASC`,
                        [perfObj.towerID, perfObj.ringID]
                    );
                    bellRows = rows;
                }
                if (!bellRows || bellRows.length === 0) {
                    // fallback: any bells for tower
                    const [rows] = await pool.query(
                        `SELECT BellID, BellRole, BellName, WeightLbs, Note FROM Bell WHERE TowerID = ? ORDER BY CAST(BellRole AS SIGNED) ASC`,
                        [perfObj.towerID]
                    );
                    bellRows = rows;
                }
            } catch (err) {
                log.error(`Failed to load bells for tower ${perfObj.towerID}: ${err.message}`);
                return;
            }
            ////log.debug(`Loaded ${bellRows.length} bell rows for tower ${perfObj.towerID}`);

            if (!bellRows || bellRows.length === 0) {
                ////log.debug(`No bell records for tower ${perfObj.towerID} - cannot map grabbed bells`);
                return;
            }

            // exclude sharp or flat bells
            const numericBellRows = bellRows.filter(b => {
                const role = String(b.BellRole || '').trim();
                return /^\d+$/.test(role);
            });
            const bellRowsForMapping = numericBellRows.length > 0 ? numericBellRows : bellRows;
            if (numericBellRows.length > 0 && numericBellRows.length !== bellRows.length) {
                //log.debug(`Excluding ${bellRows.length - numericBellRows.length} extra/non-numeric bells from tower ${perfObj.towerID} when calculating grab eligibility`);
            }

            //log.debug(`Using ${bellRowsForMapping.length} bells for mapping (perf ring count), total physical bells ${bellRows.length}`);

            let numericToPhysical = null;
            if (numericBellRows.length > 0 && numericBellRows.length !== bellRows.length) {
                numericToPhysical = numericBellRows.map(nb => bellRows.indexOf(nb)).map(i => (i >= 0 ? i : null));
                //log.debug(`numericToPhysical map: ${JSON.stringify(numericToPhysical)}`);
            } else {
                numericToPhysical = bellRows.map((_, i) => i);
            }
            
            const towerBellCount = bellRowsForMapping.length;
            const perfBellCount = perfRingers.length;

            //log.debug(`perf ${perfObj.performanceID}: perfBellCount=${perfBellCount}, towerBellCount=${towerBellCount}, userMinPercent=${userMinPercent}`);

            const percentOfRing = (perfBellCount / towerBellCount) * 100;

            if (percentOfRing < userMinPercent) {
                //log.debug(`Performance ${perfObj.performanceID} uses ${percentOfRing.toFixed(1)}% of tower ${perfObj.towerID} (user requires ${userMinPercent}%) — skipping grab`);
                return;
            }

            let ringIdToUse = perfObj.ringID != null ? perfObj.ringID : null;
            if (ringIdToUse != null) {
                try {
                    const [trows] = await pool.query(
                        `SELECT 1 FROM Tower WHERE TowerID = ? AND RingID = ? LIMIT 1`,
                        [perfObj.towerID, ringIdToUse]
                    );
                    if (!trows || trows.length === 0) {
                        // ringID does not match current Tower record(s) — use tower only (null ringid)
                        //log.debug(`RingID ${ringIdToUse} for Tower ${perfObj.towerID} not found; will insert Grab with NULL ringID`);
                        ringIdToUse = null;
                    }
                } catch (err) {
                    log.error(`Error validating Tower/Ring for tower ${perfObj.towerID} ring ${ringIdToUse}: ${err.message}`);
                    ringIdToUse = null;
                }
            }

            const M = towerBellCount;
            const k = perfBellCount;
            const startIndex = Math.max(0, M - k);

            //log.debug(`Mapping: M=${M}, k=${k}, startIndex=${startIndex}`);

            let day = null, month = null, year = null;
            if (perfObj.date) {
                const d = new Date(perfObj.date);
                if (!isNaN(d.getTime())) {
                    day = d.getDate();
                    month = d.getMonth() + 1;
                    year = d.getFullYear();
                }
            }

            try {
                await pool.query(
                    `INSERT INTO Grab (userID, towerID, ringID, dateGrabbed, monthGrabbed, yearGrabbed)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                       dateGrabbed = VALUES(dateGrabbed),
                       monthGrabbed = VALUES(monthGrabbed),
                       yearGrabbed = VALUES(yearGrabbed),
                       lastUpdated = CURRENT_TIMESTAMP`,
                    [userId, perfObj.towerID, ringIdToUse, day, month, year]
                );
                //log.debug(`Upserted Grab for user ${userId} tower ${perfObj.towerID} ring ${ringIdToUse}`);
            } catch (err) {
                log.error(`Failed to upsert Grab for user ${userId} tower ${perfObj.towerID}: ${err.message}`);
                return;
            }

            for (const mr of matchedRingers) {
                const bellNum = (mr.bell != null && !isNaN(Number(mr.bell))) ? Number(mr.bell) : null;
                if (bellNum == null) {
                    const idx = perfRingers.findIndex(r => normName(r.name.replace(/\s*\(.*?\)\s*$/, '')) === normName(mr.name.replace(/\s*\(.*?\)\s*$/, '')));
                    if (idx >= 0) {
                        const targetIndex = startIndex + idx;
                        const physicalIndex = (numericToPhysical && numericToPhysical[targetIndex] != null) ? numericToPhysical[targetIndex] : targetIndex;
                        //log.debug(`Fallback mapping for ringer "${mr.name}" idx=${idx} -> targetIndex=${targetIndex} physicalIndex=${physicalIndex}`);
                        const bell = bellRows[physicalIndex];
                        if (bell) {
                            //log.debug(`Inserting GrabBell for user ${userId} -> BellID=${bell.BellID} role=${bell.BellRole}`);
                            try {
                                await pool.query(
                                    `INSERT IGNORE INTO GrabBell (userID, bellID, bellRole, towerID, ringID)
                                     VALUES (?, ?, ?, ?, ?)`,
                                    [userId, bell.BellID, bell.BellRole || String(targetIndex + 1), perfObj.towerID, ringIdToUse]
                                );
                            } catch (err) {
                                log.error(`Failed to insert GrabBell for user ${userId}, bell ${bell?.BellID}: ${err.message}`);
                            }
                        } else {
                            //log.debug(`No bell found at physicalIndex=${physicalIndex} for fallback ringer ${mr.name}`);
                        }
                    } else {
                        //log.debug(`Could not locate ringer name "${mr.name}" in perfRingers for fallback mapping`);
                    }
                } else {
                    const targetIndex = startIndex + (bellNum - 1);
                    const physicalIndex = (numericToPhysical && numericToPhysical[targetIndex] != null) ? numericToPhysical[targetIndex] : targetIndex;
                    //log.debug(`Explicit bell mapping for ringer "${mr.name}" bellNum=${bellNum} -> targetIndex=${targetIndex} physicalIndex=${physicalIndex}`);
                    const bell = bellRows[physicalIndex];
                    if (bell) {
                        //log.debug(`Inserting GrabBell for user ${userId} -> BellID=${bell.BellID} role=${bell.BellRole}`);
                        try {
                            await pool.query(
                                `INSERT IGNORE INTO GrabBell (userID, bellID, bellRole, towerID, ringID)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [userId, bell.BellID, bell.BellRole || String(targetIndex + 1), perfObj.towerID, ringIdToUse]
                            );
                        } catch (err) {
                            log.error(`Failed to insert GrabBell for user ${userId}, bell ${bell?.BellID}: ${err.message}`);
                        }
                    } else {
                        //log.debug(`Could not map performance bell ${bellNum} -> physicalIndex ${physicalIndex} for tower ${perfObj.towerID}`);
                    }
                }
            }

            log.info(`Auto-added grab for user ${user.username} on tower ${perfObj.towerID} from performance ${perfObj.performanceID} (ringID=${ringIdToUse})`);
        } catch (err) {
            log.error(`Error in addGrab for perf ${perfObj?.performanceID}: ${err.message}`);
        }
    }

    async function fetchAndInsert(name, length, filterChanges = false) {
        const url = buildUrl(name, length);
        log.info(`fetchAndInsert: fetching ${url} for name="${name}" length="${length}"`);
        setProgress(userId, { stage: 'downloading', message: `Downloading performances for ${name}...` });

        let res;
        try {
            res = await fetch(url);
        } catch (err) {
            log.error(`Failed to fetch BellBoard data for "${name}" (URL: ${url}): ${err.message}`);
            setProgress(userId, { stage: 'error', message: `Download failed for ${name}: ${err.message}` });
            return;
        }

        if (!res.ok) {
            log.error(`Failed to fetch BellBoard data for "${name}" (URL: ${url}, Status: ${res.status})`);
            setProgress(userId, { stage: 'error', message: `Failed to download for ${name}: ${res.status}` });
            return;
        }

        const xml = await res.text();
        const data = await xml2js.parseStringPromise(xml, { explicitArray: true });
        const performances = data.performances?.performance || [];

        //log.debug(`fetchAndInsert: parsed ${performances.length} performances for name="${name}" length="${length}"`);

        const perfObjs = [];
        for (const perf of performances) {
            let perfId = perf.$?.id || perf.id?.[0];
            if (perfId && perfId.startsWith('P')) perfId = perfId.slice(1);
            perfObjs.push(buildPerformanceObject(perf, perfId));
        }
        const filteredPerfObjs = await filterAndResolvePerformanceIDs(perfObjs);
        if (filteredPerfObjs.length > 0) {
            const prev = getProgress(userId);
            setProgress(userId, {
                stage: 'processing',
                message: `Processing performances for ${name}`,
                total: (prev.total || 0) + filteredPerfObjs.length,
                processed: prev.processed || 0
            });
        }
        if (filteredPerfObjs.length === 0) return;
        const ids = filteredPerfObjs.map(p => p.performanceID).filter(Boolean);
        //log.debug(`fetchAndInsert: checking existing DB for ${ids.length} perf IDs`);
        const existingMap = new Map();
        if (ids.length > 0) {
            try {
                const chunkSize = 500;
                for (let i = 0; i < ids.length; i += chunkSize) {
                    const chunk = ids.slice(i, i + chunkSize);
                    const [rows] = await pool.query(
                        `SELECT PerformanceID, Timestamp FROM Performance WHERE PerformanceID IN (${chunk.map(() => '?').join(',')})`,
                        chunk
                    );
                    for (const r of rows) {
                        existingMap.set(Number(r.PerformanceID), r.Timestamp ? new Date(r.Timestamp).getTime() : null);
                    }
                }
                //log.debug(`fetchAndInsert: found ${existingMap.size} existing performances in DB`);
            } catch (err) {
                log.error(`Failed to fetch existing performance IDs: ${err.message}`);
            }
        }

        // For each perfObj, skip DB write and addGrab if timestamp matches existing DB timestamp.
        for (const perfObj of filteredPerfObjs) {
            try {
                // if performance exists, still attempt addGrab, but count as processed
                if (perfObj.performanceID && existingMap.has(perfObj.performanceID)) {
                    //log.debug(`Performance ${perfObj.performanceID} already exists in DB; skipping Performance upsert and running addGrab`);
                    try {
                        await addGrab(perfObj);
                    } catch (err) {
                        log.error(`addGrab failed for existing performance ${perfObj.performanceID}: ${err.message}`);
                    }
                    const cur = getProgress(userId);
                    setProgress(userId, { processed: (cur.processed || 0) + 1, stage: 'processing', message: `Processed ${cur.processed + 1} / ${cur.total || '?'}` });
                    continue;
                }

                //log.debug(`Upserting performance ${perfObj.performanceID}: tower=${perfObj.towerID}, ring=${perfObj.ringID}, ts=${perfObj.timestamp}`);
                
                // if there is a ringID discrepancy, null ringID and use towerID only
                if (perfObj.towerID) {
                    if (perfObj.ringID != null) {
                        try {
                            const [trows] = await pool.query(
                                `SELECT 1 FROM Tower WHERE TowerID = ? AND RingID = ? LIMIT 1`,
                                [perfObj.towerID, perfObj.ringID]
                            );
                            if (!trows || trows.length === 0) {
                                //log.debug(`Performance ${perfObj.performanceID}: ringID ${perfObj.ringID} for Tower ${perfObj.towerID} not found — clearing ringID before insert`);
                                perfObj.ringID = null;
                            }
                        } catch (err) {
                            log.error(`Error validating Tower/Ring for performance ${perfObj.performanceID}: ${err.message}`);
                            // safest fallback: clear ringID to avoid FK failure
                            perfObj.ringID = null;
                        }
                    }
                }

                const [result] = await pool.query(
                    `INSERT INTO Performance (PerformanceID, Association, TowerID, RingID, Place, Dedication, County, TenorWeightLbs, TenorKey, Date, Duration, Changes, Method, Ringers, Timestamp, Footnotes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        Association = VALUES(Association),
                        TowerID = VALUES(TowerID),
                        RingID = VALUES(RingID),
                        Place = VALUES(Place),
                        Dedication = VALUES(Dedication),
                        County = VALUES(County),
                        TenorWeightLbs = VALUES(TenorWeightLbs),
                        TenorKey = VALUES(TenorKey),
                        Date = VALUES(Date),
                        Duration = VALUES(Duration),
                        Changes = VALUES(Changes),
                        Method = VALUES(Method),
                        Ringers = VALUES(Ringers),
                        Timestamp = VALUES(Timestamp),
                        Footnotes = VALUES(Footnotes)
                    `,
                    [
                        perfObj.performanceID,
                        perfObj.association,
                        perfObj.towerID,
                        perfObj.ringID,
                        perfObj.place,
                        perfObj.dedication,
                        perfObj.county,
                        perfObj.tenorWeightLbs,
                        perfObj.tenorKey,
                        perfObj.date,
                        perfObj.duration,
                        perfObj.changes,
                        perfObj.method,
                        JSON.stringify(perfObj.ringers),
                        perfObj.timestamp,
                        JSON.stringify(perfObj.footnotes)
                    ]
                );

                processedCount++;
                if (isNew) insertedCount++; else updatedCount++;
                
                ////log.debug(`Upsert completed for performance ${perfObj.performanceID}`);
                try {
                    await addGrab(perfObj);
                } catch (err) {
                    log.error(`addGrab failed for performance ${perfObj.performanceID}: ${err.message}`);
                }

                const cur2 = getProgress(userId);
                setProgress(userId, { processed: (cur2.processed || 0) + 1, stage: 'processing', message: `Processed ${cur2.processed + 1} / ${cur2.total || '?'}` });

            } catch (err) {
                log.error(`DB error inserting/updating performance ID: ${perfObj.performanceID} - ${err.message}`);
                const cur3 = getProgress(userId);
                setProgress(userId, { processed: (cur3.processed || 0) + 1, stage: 'processing', message: `Processed ${cur3.processed + 1} / ${cur3.total || '?'}` });
            }
        }
    }

    const CONCURRENCY = 6;
    const tasks = [];
    for (const name of names) {
        tasks.push(() => fetchAndInsert(name, 'e-plus'));
        if (!exShort) tasks.push(() => fetchAndInsert(name, 'vshort', true));
    }

    async function runLimited(funcs, limit) {
        const results = [];
        let index = 0;
        const workers = new Array(Math.min(limit, funcs.length)).fill(0).map(async function worker() {
            while (index < funcs.length) {
                const i = index++;
                try {
                    results[i] = await funcs[i]();
                } catch (err) {
                    results[i] = err;
                }
            }
        });
        await Promise.all(workers);
        return results;
    }
    
    try {
        await runLimited(tasks, CONCURRENCY);
        const finalTotal = getProgress(userId).total || processedCount;
        setProgress(userId, { stage: 'done', message: 'Import complete', processed: finalTotal, total: finalTotal });
        const elapsedMs = Date.now() - importStart;
        log.success(`${user.username} imported ${processedCount} performances (${insertedCount} new, ${updatedCount} updated) from BellBoard in ${(elapsedMs/1000).toFixed(2)}s`);
    } catch (err) {
        setProgress(userId, { stage: 'error', message: `Import failed: ${err.message}` });
        log.error(`Import failed for ${user.username}: ${err.message}`);
        throw err;
    }
}