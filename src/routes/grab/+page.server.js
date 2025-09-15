import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    try {
        // Get user's grab count
        const [grabCountResult] = await db.query(
            `SELECT COUNT(*) as count FROM Grab WHERE userId = ?`,
            [locals.user.id]
        );
        
        const grabCount = grabCountResult[0]?.count || 0;
        
        // Get latest grabs (limited to 5)
        const [recentGrabs] = await db.query(
            `SELECT g.towerID, g.ringID, 
              DATE_FORMAT(
                STR_TO_DATE(
                  CONCAT(
                    IFNULL(g.yearGrabbed, ''),
                    '-',
                    IFNULL(g.monthGrabbed, '01'),
                    '-',
                    IFNULL(g.dateGrabbed, '01')
                  ),
                  '%Y-%m-%d'
                ),
                '%Y-%m-%d'
              ) as dateGrabbed,
              t.Place, t.Dedicn, t.County, t.Bells, t.Wt
             FROM Grab g
             JOIN Tower t ON g.towerID = t.TowerID AND g.ringID = t.RingID
             WHERE g.userId = ?
             ORDER BY g.yearGrabbed DESC, g.monthGrabbed DESC, g.dateGrabbed DESC, g.lastUpdated DESC
             LIMIT 5`,
            [locals.user.id]
        );
        
        const [grabs] = await db.query(
            `SELECT g.towerID, g.ringID, 
              DATE_FORMAT(
                STR_TO_DATE(
                  CONCAT(
                    IFNULL(g.yearGrabbed, ''),
                    '-',
                    IFNULL(g.monthGrabbed, '01'),
                    '-',
                    IFNULL(g.dateGrabbed, '01')
                  ),
                  '%Y-%m-%d'
                ),
                '%Y-%m-%d'
              ) as dateGrabbed,
              t.Place, t.Dedicn, t.County, t.Bells, t.UR, t.Wt
             FROM Grab g
             JOIN Tower t ON g.towerID = t.TowerID AND g.ringID = t.RingID
             WHERE g.userID = ?
             ORDER BY 
               CASE WHEN g.yearGrabbed IS NULL THEN 1 ELSE 0 END,
               COALESCE(g.yearGrabbed, 9999) DESC,
               COALESCE(g.monthGrabbed, 12) DESC,
               COALESCE(g.dateGrabbed, 31) DESC`,
            [locals.user.id]
        );
        
        for (const grab of grabs) {
            const [bellRows] = await db.query(
                `SELECT gb.bellID, b.BellRole, b.BellName
                 FROM GrabBell gb
                 JOIN Bell b ON gb.bellID = b.BellID
                 WHERE gb.userID = ? AND gb.towerID = ? AND gb.ringID = ?`,
                [locals.user.id, grab.towerID, grab.ringID]
            );
            
            grab.bells = bellRows;
        }
        
        return {
            user: locals.user,
            grabCount,
            recentGrabs,
            grabs
        };
    } catch (error) {
        console.error('Failed to load grab data:', error);
        return {
            user: locals.user,
            grabCount: 0,
            recentGrabs: [],
            grabs: []
        };
    }
}
