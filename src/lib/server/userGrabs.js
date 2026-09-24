import db from '$lib/server/db.js';

const grabDetailsQuery = `
    SELECT g.towerID, g.ringID,
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
     JOIN Tower t ON g.towerID = t.TowerID
     WHERE g.userID = ?`;

async function getGrabDetails(userId, limit = '') {
    const [grabs] = await db.query(
        `${grabDetailsQuery}
         ORDER BY g.yearGrabbed DESC, g.monthGrabbed DESC, g.dateGrabbed DESC, g.lastUpdated DESC
         ${limit}`,
        [userId]
    );

    return grabs;
}

export async function getUserGrabData(userId, view = 'dashboard') {
    if (view === 'existing') {
        const [grabs] = await db.query(
            'SELECT towerID, ringID FROM Grab WHERE userID = ?',
            [userId]
        );
        return { userGrabs: grabs };
    }

    const [grabCountResult] = await db.query(
        'SELECT COUNT(*) as count FROM Grab WHERE userID = ?',
        [userId]
    );
    const grabCount = grabCountResult[0]?.count || 0;

    if (view === 'full') {
        const grabs = await getGrabDetails(userId);

        for (const grab of grabs) {
            const [bellRows] = await db.query(
                `SELECT gb.bellID, b.BellRole, b.BellName
                 FROM GrabBell gb
                 JOIN Bell b ON gb.bellID = b.BellID
                 WHERE gb.userID = ? AND gb.towerID = ?`,
                [userId, grab.towerID]
            );
            grab.bells = bellRows;
        }

        return {
            grabCount,
            recentGrabs: grabs.slice(0, 3),
            grabs
        };
    }

    return {
        grabCount,
        recentGrabs: await getGrabDetails(userId, 'LIMIT 5')
    };
}