import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    try {
        const [towers] = await db.execute('SELECT TowerID, RingID, Place, PlaceCL, Dedicn, County, Country, Lat, `Long`, Bells, UR, Wt, Note, Practice FROM Tower WHERE Lat IS NOT NULL AND `Long` IS NOT NULL ORDER BY Place');
        
        // get user's grabbed towers
        let userGrabs = [];
        if (locals.user) {
            const [grabRows] = await db.query(
                'SELECT towerID, ringID FROM Grab WHERE userID = ?',
                [locals.user.id]
            );
            
            userGrabs = grabRows.map(row => `${row.towerID}-${row.ringID}`);
        }

        // map grabbed towers
        const towersWithGrabs = towers.map(tower => {
            const towerKey = `${tower.TowerID}-${tower.RingID || 1}`;
            return {
                ...tower,
                grabbed: userGrabs.includes(towerKey)
            };
        });
        
        return {
            user: locals.user,
            towers: towersWithGrabs
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
