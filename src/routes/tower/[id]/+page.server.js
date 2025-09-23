import { error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ params, locals }) {
    const towerId = params.id;
    
    if (!towerId || isNaN(parseInt(towerId))) {
        throw error(400, 'Invalid tower ID');
    }

    try {
        const [towerRows] = await db.query(
            `SELECT t.*, 
                (SELECT COUNT(*) FROM Grab g WHERE g.towerID = t.TowerID AND g.ringID = t.RingID) AS grabCount
             FROM Tower t 
             WHERE t.TowerID = ?`,
            [towerId]
        );

        if (towerRows.length === 0) {
            throw error(404, 'Tower not found');
        }

        const tower = towerRows[0];

        const [bellRows] = await db.query(
            `SELECT * FROM Bell WHERE TowerID = ? AND RingID = ? ORDER BY BellRole`,
            [tower.TowerID, tower.RingID || 1]
        );

        let userGrab = null;
        if (locals.user) {
            const [grabRows] = await db.query(
                `SELECT g.*, 
                    GROUP_CONCAT(gb.bellID) as bellIDs,
                    GROUP_CONCAT(gb.bellRole) as bellRoles
                 FROM Grab g
                 LEFT JOIN GrabBell gb ON g.userId = gb.userId AND g.towerID = gb.towerID AND g.ringID = gb.ringID
                 WHERE g.userId = ? AND g.towerID = ? AND g.ringID = ?
                 GROUP BY g.userId, g.towerID, g.ringID`,
                [locals.user.id, tower.TowerID, tower.RingID || 1]
            );

            if (grabRows.length > 0) {
                userGrab = grabRows[0];
                
                if (userGrab.bellIDs) {
                    const bellIDs = userGrab.bellIDs.split(',').map(id => parseInt(id));
                    const bellRoles = userGrab.bellRoles.split(',');
                    
                    userGrab.bells = bellIDs.map((id, index) => ({
                        id,
                        role: bellRoles[index] || 'Unknown'
                    }));
                } else {
                    userGrab.bells = [];
                }
            }
        }

        const [perfRows] = await db.query(
            `SELECT * FROM Performance 
             WHERE TowerID = ?
             ORDER BY Date DESC LIMIT 10`,
            [tower.TowerID]
        );

        const performances = perfRows.map(perf => {
            let ringers = [];
            try {
                if (perf.Ringers) {
                    if (typeof perf.Ringers === 'string') {
                        const parsed = JSON.parse(perf.Ringers);
                        ringers = parsed.ringers || [];
                    } else if (typeof perf.Ringers === 'object' && perf.Ringers.ringers) {
                        ringers = perf.Ringers.ringers || [];
                    }
                }
            } catch (err) {
                console.error(`Failed to parse ringers for performance ${perf.PerformanceID}`);
            }
            
            return {
                ...perf,
                ringers
            };
        });

        return {
            user: locals.user,
            tower,
            bells: bellRows,
            userGrab,
            performances
        };
    } catch (err) {
        console.error('Error fetching tower data:', err);
        throw error(500, 'Failed to fetch tower data');
    }
}
