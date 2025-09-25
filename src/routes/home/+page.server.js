import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { getWhatsAppLink } from '$lib/server/secretLinks.js';

export async function load({ locals }) {
  // Check if user is logged in
  if (!locals.user) {
    console.error('User not logged in');
    throw redirect(303, '/');
  }

  // get whatsapp link
  const whatsappLink = getWhatsAppLink();
  
  try {
    const [grabCountResult] = await db.query(
      `SELECT COUNT(*) as count FROM Grab WHERE userId = ?`,
      [locals.user.id]
    );
    
    const grabCount = grabCountResult[0]?.count || 0;
    
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
    
    return {
      user: locals.user,
      grabCount,
      recentGrabs,
      whatsappLink
    };
  } catch (error) {
    console.error('Failed to load user data:', error);
    return {
      user: locals.user,
      grabCount: 0,
      recentGrabs: []
    };
  }
}
