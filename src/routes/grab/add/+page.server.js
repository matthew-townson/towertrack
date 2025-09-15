import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import log from '$lib/server/log.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }

    // on load, get tower list for searching
    let towerList = [];
    try {
        const [rows] = await db.query(
            `SELECT TowerID, RingID, Place, Dedicn, County, Bells, UR FROM Tower ORDER BY Place`
        );
        towerList = rows;
    } catch (error) {
        log.error('Error loading towers:', error);
    }

    // on load, get users grabs to allow for updates
    let userGrabs = [];
    try {
        if (locals.user) {
            const [rows] = await db.query(
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
                  t.Place, t.Dedicn, t.County, t.Bells
                 FROM Grab g
                 JOIN Tower t ON g.towerID = t.TowerID AND g.ringID = t.RingID
                 WHERE g.userID = ?`,
                [locals.user.id]
            );
            userGrabs = rows;
        } else {
            throw new Error('User not logged in');
        }

        // also get grabbed bells (if applicable)
        if (userGrabs.length > 0) {
            for (let grab of userGrabs) {
                const [bellRows] = await db.query(
                    `SELECT bellID FROM GrabBell WHERE userID = ? AND towerID = ? AND ringID = ?`,
                    [locals.user.id, grab.towerID, grab.ringID]
                );
                grab.bells = bellRows.map(row => row.bellID);
            }
        }
    } catch (error) {
        log.error('Error loading user grabs:', error);
    }

    return {
        user: locals.user,
        towerList,
        userGrabs
    };
}

export const actions = {
    searchTower: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }

        const formData = await request.formData();
        const searchQuery = formData.get('searchQuery')?.trim();

        if (!searchQuery || searchQuery.length < 2) {
            return fail(400, {
                error: 'Search query must be at least 2 characters',
                searchResults: [],
                searchQuery
            });
        }

        try {
            const [rows] = await db.query(
                `SELECT TowerID, RingID, Place, Dedicn, County, Country, Bells, UR
                 FROM Tower
                 WHERE Place LIKE ? OR Dedicn LIKE ? OR County LIKE ?
                 ORDER BY Place
                 LIMIT 20`,
                [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]
            );

            return {
                searchResults: rows,
                searchQuery
            };
        } catch (error) {
            log.error('Error searching towers:', error);
            return fail(500, {
                error: 'Failed to search towers',
                searchResults: [],
                searchQuery
            });
        }
    },

    addGrab: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }

        const formData = await request.formData();
        const towerId = formData.get('towerId');
        const ringId = formData.get('ringId') || 1;
        const isGrabbed = formData.get('isGrabbed') === 'true';
        const dateGrabbed = formData.get('dateGrabbed') || '';
        
        // get selected bells JSON (if any)
        let selectedBells = [];
        try {
            const selectedBellsJson = formData.get('selectedBellsJson');
            if (selectedBellsJson) {
                selectedBells = JSON.parse(selectedBellsJson);
            }
        } catch (error) {
            log.error('Error parsing selectedBellsJson:', error);
        }

        if (!towerId) {
            return fail(400, {
                error: 'Tower ID is required',
                success: false
            });
        }

        try {
            // check tower exists
            const [towerRows] = await db.query(
                `SELECT TowerID, RingID, Place, Dedicn, County, Country, Bells, UR FROM Tower WHERE TowerID = ? AND RingID = ?`,
                [towerId, ringId]
            );

            if (towerRows.length === 0) {
                return fail(400, {
                    error: 'Tower not found',
                    success: false
                });
            }

            const selectedTower = towerRows[0];

            // check if tower already grabbed
            const [grabRows] = await db.query(
                `SELECT towerID FROM Grab WHERE userID = ? AND towerID = ? AND ringID = ?`,
                [locals.user.id, towerId, ringId]
            );

            const towerAlreadyGrabbed = grabRows.length > 0;

            // parse
            const bellEntries = [...formData.entries()]
                .filter(([key]) => key.startsWith('bell_'))
                .map(([key]) => {
                    const bellId = key.replace('bell_', '');
                    return parseInt(bellId);
                });

            if (isGrabbed) {
                let day = null, month = null, year = null;
                
                if (dateGrabbed) {
                    const date = new Date(dateGrabbed);
                    if (!isNaN(date.getTime())) {
                        day = date.getDate();
                        month = date.getMonth() + 1;
                        year = date.getFullYear();
                    }
                }

                if (towerAlreadyGrabbed) {
                    // update
                    await db.query(
                        `UPDATE Grab SET 
                         dateGrabbed = ?, 
                         monthGrabbed = ?, 
                         yearGrabbed = ?,
                         lastUpdated = CURRENT_TIMESTAMP 
                         WHERE userID = ? AND towerID = ? AND ringID = ?`,
                        [day, month, year, locals.user.id, towerId, ringId]
                    );
                    
                    await db.query(
                        `DELETE FROM GrabBell WHERE userID = ? AND towerID = ? AND ringID = ?`,
                        [locals.user.id, towerId, ringId]
                    );
                } else {
                    await db.query(
                        `INSERT INTO Grab (userID, towerID, ringID, dateGrabbed, monthGrabbed, yearGrabbed) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [locals.user.id, towerId, ringId, day, month, year]
                    );
                }

                if (bellEntries.length > 0) {
                    const [bellRows] = await db.query(
                        `SELECT BellID, BellRole FROM Bell WHERE BellID IN (${bellEntries.join(',')})`,
                        []
                    );

                    const bellRoles = {};
                    bellRows.forEach(row => {
                        bellRoles[row.BellID] = row.BellRole || 'Unknown';
                    });

                    for (const bellId of bellEntries) {
                        await db.query(
                            `INSERT INTO GrabBell (userID, bellID, bellRole, towerID, ringID) 
                             VALUES (?, ?, ?, ?, ?)`,
                            [locals.user.id, bellId, bellRoles[bellId] || 'Unknown', towerId, ringId]
                        );
                    }
                }

                log.info(`User ${locals.user.username} (ID: ${locals.user.id}) ${towerAlreadyGrabbed ? 'updated' : 'added'} grab for tower ID ${towerId}`);
                
                return {
                    success: true,
                    message: `Tower ${selectedTower.Place} ${towerAlreadyGrabbed ? 'updated' : 'added'} to your grabs.`,
                    selectedTower,
                    isGrabbed,
                    dateGrabbed,
                    selectedBells
                };
            } else if (towerAlreadyGrabbed) {
                await db.query(
                    `DELETE FROM Grab WHERE userID = ? AND towerID = ? AND ringID = ?`,
                    [locals.user.id, towerId, ringId]
                );
                
                await db.query(
                    `DELETE FROM GrabBell WHERE userID = ? AND towerID = ? AND ringID = ?`,
                    [locals.user.id, towerId, ringId]
                );

                log.info(`User ${locals.user.username} (ID: ${locals.user.id}) removed grab for tower ID ${towerId}`);
                
                return {
                    success: true,
                    message: `Tower ${selectedTower.Place} removed from your grabs.`,
                    selectedTower,
                    isGrabbed,
                    dateGrabbed,
                    selectedBells: []
                };
            } else {
                return {
                    success: true,
                    message: `Tower ${selectedTower.Place} was not in your grabs.`,
                    selectedTower,
                    isGrabbed,
                    dateGrabbed,
                    selectedBells: []
                };
            }
        } catch (error) {
            log.error('Error processing grab:', error);
            return fail(500, {
                error: true,
                message: 'Failed to process grab',
                success: false,
                isGrabbed,
                dateGrabbed,
                selectedBells
            });
        }
    }
};