import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// Helper to check user's access to a shared calendar
async function getCalendarAccess(calendarId, userId) {
    const [rows] = await db.query(`
        SELECT sc.id, sc.ownerId,
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

// GET - List members of a shared calendar
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

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

        return json(members);
    } catch (err) {
        console.error('Error fetching members:', err);
        throw error(500, 'Failed to fetch members');
    }
}

// POST - Add a member to a shared calendar (owner only)
export async function POST({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        if (calendar.role !== 'owner') {
            throw error(403, 'Only the owner can add members');
        }

        const { userId, role } = await request.json();

        if (!userId) {
            throw error(400, 'User ID is required');
        }

        if (userId === locals.user.id) {
            throw error(400, 'You cannot add yourself as a member');
        }

        const memberRole = role === 'editor' ? 'editor' : 'viewer';

        // Verify user exists
        const [userCheck] = await db.query('SELECT id, username FROM User WHERE id = ?', [userId]);
        if (userCheck.length === 0) {
            throw error(404, 'User not found');
        }

        await db.query(`
            INSERT INTO SharedCalendarMember (sharedCalendarId, userId, role)
            VALUES (?, ?, ?)
        `, [params.calendarId, userId, memberRole]);

        // Send notification
        const [calendarInfo] = await db.query('SELECT name FROM SharedCalendar WHERE id = ?', [params.calendarId]);
        await db.query(`
            INSERT INTO Notification (userId, type, title, message, data)
            VALUES (?, 'shared_calendar_invite', ?, ?, ?)
        `, [
            userId,
            'Added to shared calendar',
            `${locals.user.username} added you to the shared calendar "${calendarInfo[0].name}".`,
            JSON.stringify({ sharedCalendarId: parseInt(params.calendarId) })
        ]);

        return json({
            membershipId: null, // Will be fetched on reload
            userId,
            username: userCheck[0].username,
            role: memberRole
        }, { status: 201 });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw error(400, 'User is already a member of this calendar');
        }
        console.error('Error adding member:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to add member');
    }
}

// DELETE - Remove a member from a shared calendar (owner only, or self-remove)
export async function DELETE({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        const { userId } = await request.json();

        if (!userId) {
            throw error(400, 'User ID is required');
        }

        // Owner can remove anyone; members can only remove themselves
        if (calendar.role !== 'owner' && userId !== locals.user.id) {
            throw error(403, 'Only the owner can remove other members');
        }

        // Owner cannot remove themselves (must transfer ownership first)
        if (userId === calendar.ownerId) {
            throw error(400, 'The owner cannot be removed. Transfer ownership first.');
        }

        await db.query(`
            DELETE FROM SharedCalendarMember 
            WHERE sharedCalendarId = ? AND userId = ?
        `, [params.calendarId, userId]);

        return json({ success: true });
    } catch (err) {
        console.error('Error removing member:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to remove member');
    }
}

// PATCH - Update a member's role (owner only)
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
            throw error(403, 'Only the owner can change member roles');
        }

        const { userId, role } = await request.json();

        if (!userId) {
            throw error(400, 'User ID is required');
        }

        if (!role || !['editor', 'viewer'].includes(role)) {
            throw error(400, 'Invalid role. Must be "editor" or "viewer".');
        }

        // Check member exists
        const [member] = await db.query(`
            SELECT id FROM SharedCalendarMember
            WHERE sharedCalendarId = ? AND userId = ?
        `, [params.calendarId, userId]);

        if (member.length === 0) {
            throw error(404, 'Member not found');
        }

        await db.query(`
            UPDATE SharedCalendarMember
            SET role = ?
            WHERE sharedCalendarId = ? AND userId = ?
        `, [role, params.calendarId, userId]);

        return json({ success: true, role });
    } catch (err) {
        console.error('Error updating member role:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update member role');
    }
}
