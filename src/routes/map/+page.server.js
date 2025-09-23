import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    try {
        const [towers] = await db.execute('SELECT TowerID, RingID, Place, PlaceCL, Dedicn, County, Country, Lat, `Long`, Bells, UR, Wt, Note, Practice FROM Tower WHERE Lat IS NOT NULL AND `Long` IS NOT NULL ORDER BY Place');
        
        // get user's grabbed towers
        let userGrabs = new Set();
        if (locals.user) {
            const [grabRows] = await db.query(
                'SELECT towerID FROM Grab WHERE userID = ?',
                [locals.user.id]
            );
            // use towerID only (ignore ringID)
            userGrabs = new Set(grabRows.map(row => String(row.towerID)));
        }
        
        let normalisedNames = [];
        try {
            const nameCandidates = [];
            if (locals.user.username) nameCandidates.push(locals.user.username);
            if (locals.user.name) nameCandidates.push(locals.user.name);

            const [aliasRows] = await db.query(
                'SELECT Name FROM OtherNames WHERE userId = ?',
                [locals.user.id]
            );
            aliasRows.forEach(r => {
                if (r && r.Name) nameCandidates.push(r.Name);
            });

            const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
            normalisedNames = Array.from(new Set(nameCandidates.map(norm).filter(Boolean)));
        } catch (e) {
            console.warn('Failed to load user aliases; falling back to username/name only', e?.message || e);
            const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
            normalisedNames = [(locals.user.name || locals.user.username || '').trim()].filter(Boolean).map(norm);
        }

        const quarteredSet = new Set();
        const pealedSet = new Set();
        if (normalisedNames.length > 0) {
            const [perfRows] = await db.query(
                'SELECT towerID, changes, Ringers FROM Performance WHERE Ringers IS NOT NULL'
            );

            perfRows.forEach(r => {
                try {
                    const raw = r.Ringers;
                    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    const ringersArr = Array.isArray(parsed?.ringers) ? parsed.ringers
                        : Array.isArray(parsed) ? parsed
                        : parsed && parsed.ringers ? parsed.ringers : [];

                    const matched = ringersArr.some(x => {
                        if (!x || !x.name) return false;
                        const rname = String(x.name).trim().toLowerCase().replace(/\s+/g, ' ');
                        return normalisedNames.some(n => n && rname.includes(n));
                    });

                    if (matched) {
                        const key = String(r.towerID);
                        const changes = Number(r.changes || 0);
                        if (changes >= 1200 && changes < 5000) quarteredSet.add(key);
                        if (changes >= 5000) pealedSet.add(key);
                    }
                } catch (err) {
                    console.warn('Failed to parse Performance.Ringers JSON for one row:', err?.message || err);
                }
            });
        }

        const towerdata = towers.map(tower => {
            const towerKey = String(tower.TowerID);
            return {
                ...tower,
                grabbed: userGrabs.has(towerKey),
                quartered: quarteredSet.has(towerKey),
                pealed: pealedSet.has(towerKey)
            };
        });
        
        return {
            user: locals.user,
            towers: towerdata
        };
    } catch (error) {
        console.error('Failed to fetch tower data:', error);
        return {
            user: locals.user,
            towers: [],
            error: 'Failed to load tower data'
        };
    }
}