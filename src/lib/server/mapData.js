import db from '$lib/server/db.js';
import log from '$lib/server/log.js';

export async function getTowersWithUserData(userId = null) {
    try {
        const [towers] = await db.execute(
            'SELECT TowerID, RingID, Place, PlaceCL, Dedicn, County, Country, Lat, `Long`, Bells, UR, Wt, Note, Practice FROM Tower WHERE Lat IS NOT NULL AND `Long` IS NOT NULL ORDER BY Place'
        );
        
        if (!userId) {
            return towers.map(tower => ({
                ...tower,
                grabbed: false,
                quartered: false,
                pealed: false
            }));
        }
        
        let userGrabs = new Set();
        const [grabRows] = await db.query(
            'SELECT towerID FROM Grab WHERE userID = ?',
            [userId]
        );
        userGrabs = new Set(grabRows.map(row => String(row.towerID)));
        
        let normalisedNames = [];
        try {
            const nameCandidates = [];
            
            const [userRows] = await db.query(
                'SELECT username FROM User WHERE id = ?',
                [userId]
            );
            if (userRows[0]?.username) {
                nameCandidates.push(userRows[0].username);
            }
            
            const [aliasRows] = await db.query(
                'SELECT Name FROM OtherNames WHERE userId = ?',
                [userId]
            );
            aliasRows.forEach(r => {
                if (r?.Name) nameCandidates.push(r.Name);
            });
            
            const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
            normalisedNames = Array.from(new Set(nameCandidates.map(norm).filter(Boolean)));
        } catch (e) {
            log.warn(`Failed to load user aliases for user ${userId}: ${e?.message || e}`);
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
                    log.warn(`Failed to parse Performance.Ringers JSON: ${err?.message || err}`);
                }
            });
        }
        
        return towers.map(tower => {
            const towerKey = String(tower.TowerID);
            return {
                ...tower,
                grabbed: userGrabs.has(towerKey),
                quartered: quarteredSet.has(towerKey),
                pealed: pealedSet.has(towerKey)
            };
        });
    } catch (error) {
        log.error(`Failed to fetch tower data: ${error.message}`);
        throw error;
    }
}

export async function getUserTowerData(userId) {
    try {
        const [grabbedTowers] = await db.query(`
            SELECT DISTINCT t.TowerID, t.RingID, t.Place, t.PlaceCL, t.Dedicn, 
                   t.County, t.Country, t.Lat, t.\`Long\`, t.Bells, t.UR, t.Wt, t.Note
            FROM Tower t
            INNER JOIN Grab g ON t.TowerID = g.towerID
            WHERE g.userID = ? AND t.Lat IS NOT NULL AND t.\`Long\` IS NOT NULL
            ORDER BY t.Place
        `, [userId]);
        
        let normalisedNames = [];
        const nameCandidates = [];
        
        const [userRows] = await db.query(
            'SELECT username FROM User WHERE id = ?',
            [userId]
        );
        if (userRows[0]?.username) {
            nameCandidates.push(userRows[0].username);
        }
        
        const [aliasRows] = await db.query(
            'SELECT Name FROM OtherNames WHERE userId = ?',
            [userId]
        );
        aliasRows.forEach(r => {
            if (r?.Name) nameCandidates.push(r.Name);
        });
        
        const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
        normalisedNames = Array.from(new Set(nameCandidates.map(norm).filter(Boolean)));
        
        const quarteredTowers = [];
        const pealedTowers = [];
        
        if (normalisedNames.length > 0) {
            const [perfRows] = await db.query(`
                SELECT DISTINCT p.towerID, p.changes, p.Ringers,
                       t.RingID, t.Place, t.PlaceCL, t.Dedicn, 
                       t.County, t.Country, t.Lat, t.\`Long\`, t.Bells, t.UR, t.Wt, t.Note
                FROM Performance p
                INNER JOIN Tower t ON p.towerID = t.TowerID
                WHERE p.Ringers IS NOT NULL AND t.Lat IS NOT NULL AND t.\`Long\` IS NOT NULL
            `);
            
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
                        const changes = Number(r.changes || 0);
                        const towerData = {
                            TowerID: r.towerID,
                            RingID: r.RingID,
                            Place: r.Place,
                            PlaceCL: r.PlaceCL,
                            Dedicn: r.Dedicn,
                            County: r.County,
                            Country: r.Country,
                            Lat: r.Lat,
                            Long: r.Long,
                            Bells: r.Bells,
                            UR: r.UR,
                            Wt: r.Wt,
                            Note: r.Note
                        };
                        
                        if (changes >= 1200 && changes < 5000) {
                            // Check if already added
                            if (!quarteredTowers.some(t => t.TowerID === r.towerID)) {
                                quarteredTowers.push(towerData);
                            }
                        }
                        if (changes >= 5000) {
                            // Check if already added
                            if (!pealedTowers.some(t => t.TowerID === r.towerID)) {
                                pealedTowers.push(towerData);
                            }
                        }
                    }
                } catch (err) {
                    log.warn(`Failed to parse Performance.Ringers JSON: ${err?.message || err}`);
                }
            });
        }
        
        return {
            grabbed: grabbedTowers,
            quartered: quarteredTowers,
            pealed: pealedTowers
        };
    } catch (error) {
        log.error(`Failed to fetch user tower data: ${error.message}`);
        throw error;
    }
}
