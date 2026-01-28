import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import log from '$lib/server/log.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }

    // Get user's existing grabs
    let userGrabs = [];
    try {
        const [rows] = await db.query(
            `SELECT g.towerID, g.ringID FROM Grab g WHERE g.userID = ?`,
            [locals.user.id]
        );
        userGrabs = rows;
    } catch (error) {
        log.error('Error loading user grabs:', error);
    }

    return {
        user: locals.user,
        userGrabs
    };
}

export const actions = {
    bulkAddGrabs: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }

        const formData = await request.formData();
        const grabsJson = formData.get('grabsJson');

        if (!grabsJson) {
            return fail(400, {
                error: 'No grabs provided',
                success: false
            });
        }

        let grabs = [];
        try {
            grabs = JSON.parse(grabsJson);
        } catch (error) {
            log.error('Error parsing grabs JSON:', error);
            return fail(400, {
                error: 'Invalid grabs data',
                success: false
            });
        }

        if (!Array.isArray(grabs) || grabs.length === 0) {
            return fail(400, {
                error: 'No grabs to add',
                success: false
            });
        }

        let addedCount = 0;
        let errors = [];

        for (const grab of grabs) {
            const { towerId, ringId, dateGrabbed, selectedBells } = grab;

            if (!towerId) {
                errors.push('Missing tower ID for a grab');
                continue;
            }

            try {
                // Check tower exists
                const [towerRows] = await db.query(
                    `SELECT TowerID, RingID, Place, Dedicn FROM Tower WHERE TowerID = ? AND RingID = ?`,
                    [towerId, ringId || 1]
                );

                if (towerRows.length === 0) {
                    errors.push(`Tower ${towerId} not found`);
                    continue;
                }

                const tower = towerRows[0];

                // Check if already grabbed
                const [existingGrab] = await db.query(
                    `SELECT towerID FROM Grab WHERE userID = ? AND towerID = ?`,
                    [locals.user.id, towerId]
                );

                const alreadyGrabbed = existingGrab.length > 0;

                if (alreadyGrabbed) {
                    errors.push(`Tower ${tower.Place} already grabbed`);
                    continue;
                }

                // Parse date
                let day = null, month = null, year = null;
                if (dateGrabbed) {
                    const date = new Date(dateGrabbed);
                    if (!isNaN(date.getTime())) {
                        day = date.getDate();
                        month = date.getMonth() + 1;
                        year = date.getFullYear();
                    }
                }

                // Insert new grab
                await db.query(
                    `INSERT INTO Grab (userID, towerID, ringID, dateGrabbed, monthGrabbed, yearGrabbed) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [locals.user.id, towerId, ringId || 1, day, month, year]
                );

                addedCount++;

                // Insert bell grabs
                if (selectedBells && selectedBells.length > 0) {
                    const [bellRows] = await db.query(
                        `SELECT BellID, BellRole FROM Bell WHERE BellID IN (${selectedBells.map(() => '?').join(',')})`,
                        selectedBells
                    );

                    const bellRoles = {};
                    bellRows.forEach(row => {
                        bellRoles[row.BellID] = row.BellRole || 'Unknown';
                    });

                    for (const bellId of selectedBells) {
                        await db.query(
                            `INSERT INTO GrabBell (userID, bellID, bellRole, towerID, ringID) 
                             VALUES (?, ?, ?, ?, ?)`,
                            [locals.user.id, bellId, bellRoles[bellId] || 'Unknown', towerId, ringId || 1]
                        );
                    }
                }

            } catch (error) {
                log.error(`Error processing grab for tower ${towerId}:`, error);
                errors.push(`Failed to process tower ${towerId}`);
            }
        }

        log.info(`User ${locals.user.username} (ID: ${locals.user.id}) bulk added ${addedCount} grabs`);

        return {
            success: true,
            message: `Added ${addedCount} new grab${addedCount !== 1 ? 's' : ''}${errors.length > 0 ? `. Errors: ${errors.join(', ')}` : ''}`,
            addedCount,
            errors
        };
    }
};
