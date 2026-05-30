import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import crypto from 'crypto';

// Helper to check user's access to a shared calendar
async function getCalendarAccess(calendarId, userId) {
    const [rows] = await db.query(`
        SELECT sc.id, sc.ownerId, sc.name, sc.colour, sc.secretKey,
            CASE 
                WHEN sc.ownerId = ? THEN 'owner'
                ELSE (SELECT role FROM SharedCalendarMember WHERE sharedCalendarId = sc.id AND userId = ?)
            END as role
        FROM SharedCalendar sc
        WHERE sc.id = ?
    `, [userId, userId, calendarId]);

    if (rows.length === 0) return null;
    if (!rows[0].role) return null;
    return rows[0];
}

// GET - Fetch shared calendar details including members
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        // Get members
        const [members] = await db.query(`
            SELECT 
                scm.id as membershipId,
                scm.userId,
                scm.role,
                scm.addedAt,
                u.username,
                u.profileImage
            FROM SharedCalendarMember scm
            JOIN User u ON scm.userId = u.id
            WHERE scm.sharedCalendarId = ?
            ORDER BY scm.addedAt ASC
        `, [params.calendarId]);

        // Get owner info
        const [owner] = await db.query(`
            SELECT id, username, profileImage FROM User WHERE id = ?
        `, [calendar.ownerId]);

        return json({
            ...calendar,
            owner: owner[0],
            members,
            // Only show secret key to owner
            secretKey: calendar.role === 'owner' ? calendar.secretKey : undefined
        });
    } catch (err) {
        console.error('Error fetching shared calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to fetch shared calendar');
    }
}

// PUT - Update shared calendar (owner or editor)
export async function PUT({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        // Only owner can rename
        const { name, colour } = await request.json();
        
        if (name && calendar.role !== 'owner') {
            throw error(403, 'Only the owner can rename the calendar');
        }

        const updates = [];
        const values = [];

        if (name) {
            if (name.trim().length === 0 || name.trim().length > 100) {
                throw error(400, 'Calendar name must be between 1 and 100 characters');
            }
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (colour) {
            updates.push('colour = ?');
            values.push(colour);
        }

        if (updates.length > 0) {
            values.push(params.calendarId);
            await db.query(`
                UPDATE SharedCalendar SET ${updates.join(', ')} WHERE id = ?
            `, values);
        }

        return json({ success: true });
    } catch (err) {
        console.error('Error updating shared calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update shared calendar');
    }
}

// DELETE - Delete shared calendar (owner only)
export async function DELETE({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        if (calendar.role !== 'owner') {
            throw error(403, 'Only the owner can delete this calendar');
        }

        await db.query('DELETE FROM SharedCalendar WHERE id = ?', [params.calendarId]);

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting shared calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to delete shared calendar');
    }
}

// PATCH - Special actions: transfer ownership, regenerate secret key
export async function PATCH({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        if (calendar.role !== 'owner') {
            throw error(403, 'Only the owner can perform this action');
        }

        const { action, newOwnerId } = await request.json();

        if (action === 'transfer') {
            if (!newOwnerId) {
                throw error(400, 'New owner ID is required');
            }

            // Verify the new owner is a current member
            const [memberCheck] = await db.query(`
                SELECT id FROM SharedCalendarMember 
                WHERE sharedCalendarId = ? AND userId = ?
            `, [params.calendarId, newOwnerId]);

            if (memberCheck.length === 0) {
                throw error(400, 'New owner must be an existing member of the calendar');
            }

            // Transfer: update owner, remove new owner from members, add old owner as editor
            await db.query('START TRANSACTION');
            try {
                await db.query('UPDATE SharedCalendar SET ownerId = ? WHERE id = ?', [newOwnerId, params.calendarId]);
                await db.query('DELETE FROM SharedCalendarMember WHERE sharedCalendarId = ? AND userId = ?', [params.calendarId, newOwnerId]);
                await db.query(`
                    INSERT INTO SharedCalendarMember (sharedCalendarId, userId, role) VALUES (?, ?, 'editor')
                `, [params.calendarId, locals.user.id]);
                await db.query('COMMIT');
            } catch (txErr) {
                await db.query('ROLLBACK');
                throw txErr;
            }

            // Send notification to new owner
            await db.query(`
                INSERT INTO Notification (userId, type, title, message, data)
                VALUES (?, 'shared_calendar_transfer', ?, ?, ?)
            `, [
                newOwnerId,
                'Calendar ownership transferred',
                `${locals.user.username} transferred ownership of "${calendar.name}" to you.`,
                JSON.stringify({ sharedCalendarId: parseInt(params.calendarId) })
            ]);

            return json({ success: true, action: 'transferred' });
        }

        if (action === 'regenerate_secret') {
            const newKey = crypto.randomBytes(32).toString('hex');
            await db.query('UPDATE SharedCalendar SET secretKey = ? WHERE id = ?', [newKey, params.calendarId]);
            return json({ success: true, secretKey: newKey });
        }

        throw error(400, 'Invalid action');
    } catch (err) {
        console.error('Error patching shared calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update shared calendar');
    }
}
