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

// GET - List all invitations for a shared event
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) throw error(404, 'Shared calendar not found');

        // Verify event exists
        const [events] = await db.query(`
            SELECT id FROM SharedCalendarEvent 
            WHERE id = ? AND sharedCalendarId = ?
        `, [params.eventId, params.calendarId]);
        
        if (events.length === 0) throw error(404, 'Event not found');

        // Get all invitations for this event
        const [invitations] = await db.query(`
            SELECT 
                i.id,
                i.invitedUserId,
                i.guestName,
                i.invitedBy,
                i.instanceDate,
                i.status,
                i.createdAt,
                i.respondedAt,
                u.username,
                u.email
            FROM SharedEventInvitation i
            LEFT JOIN User u ON i.invitedUserId = u.id
            WHERE i.sharedEventId = ?
            ORDER BY i.instanceDate ASC, i.createdAt DESC
        `, [params.eventId]);

        return json(invitations);
    } catch (err) {
        console.error('Error fetching invitations:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to fetch invitations');
    }
}

// POST - Add an invitation for a shared event
export async function POST({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) throw error(404, 'Shared calendar not found');

        // Only editors and owners can invite
        if (calendar.role === 'viewer') {
            throw error(403, 'Viewers cannot invite users');
        }

        // Verify event exists
        const [events] = await db.query(`
            SELECT id FROM SharedCalendarEvent 
            WHERE id = ? AND sharedCalendarId = ?
        `, [params.eventId, params.calendarId]);
        
        if (events.length === 0) throw error(404, 'Event not found');

        const body = await request.json();
        const { invitedUserId, guestName, instanceDate, status = 'pending' } = body;

        if (!invitedUserId && !guestName) {
            throw error(400, 'Either invitedUserId or guestName is required');
        }

        if (status && !['pending', 'accepted', 'declined'].includes(status)) {
            throw error(400, 'Invalid status');
        }

        // Check if invitation already exists
        const [existingInvitations] = await db.query(`
            SELECT id FROM SharedEventInvitation 
            WHERE sharedEventId = ? 
            AND (invitedUserId = ? OR (guestName = ? AND invitedUserId IS NULL))
            AND (instanceDate <=> ?)
        `, [
            params.eventId,
            invitedUserId || null,
            guestName || null,
            instanceDate || null
        ]);

        if (existingInvitations.length > 0) {
            throw error(400, 'This user has already been invited to this event instance');
        }

        // Insert invitation
        await db.query(`
            INSERT INTO SharedEventInvitation 
            (sharedEventId, invitedUserId, guestName, invitedBy, instanceDate, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [
            params.eventId,
            invitedUserId || null,
            guestName || null,
            locals.user.id,
            instanceDate || null,
            status
        ]);

        return json({ success: true });
    } catch (err) {
        console.error('Error creating invitation:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to create invitation');
    }
}

// PUT - Update invitation status (respond to invitation)
export async function PUT({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const body = await request.json();
        const { invitationId, status } = body;

        if (!invitationId || !status) {
            throw error(400, 'invitationId and status are required');
        }

        if (!['pending', 'accepted', 'declined'].includes(status)) {
            throw error(400, 'Invalid status');
        }

        // Verify the invitation exists and is for a user who can respond
        const [invitations] = await db.query(`
            SELECT i.id, i.invitedUserId
            FROM SharedEventInvitation i
            WHERE i.id = ? AND i.sharedEventId = ?
        `, [invitationId, params.eventId]);

        if (invitations.length === 0) {
            throw error(404, 'Invitation not found');
        }

        const invitation = invitations[0];
        
        // Only the invited user or the event creator can update status
        if (invitation.invitedUserId !== locals.user.id && 
            invitation.invitedUserId !== null) {
            throw error(403, 'Cannot update this invitation');
        }

        // Update invitation status
        await db.query(`
            UPDATE SharedEventInvitation SET
                status = ?,
                respondedAt = NOW()
            WHERE id = ?
        `, [status, invitationId]);

        return json({ success: true });
    } catch (err) {
        console.error('Error updating invitation:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update invitation');
    }
}

// DELETE - Remove an invitation
export async function DELETE({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) throw error(404, 'Shared calendar not found');

        // Only editors and owners can remove invitations
        if (calendar.role === 'viewer') {
            throw error(403, 'Viewers cannot manage invitations');
        }

        const body = await request.json();
        const { invitationId } = body;

        if (!invitationId) {
            throw error(400, 'invitationId is required');
        }

        // Verify invitation exists
        const [invitations] = await db.query(`
            SELECT id FROM SharedEventInvitation 
            WHERE id = ? AND sharedEventId = ?
        `, [invitationId, params.eventId]);

        if (invitations.length === 0) {
            throw error(404, 'Invitation not found');
        }

        // Delete invitation
        await db.query(`
            DELETE FROM SharedEventInvitation WHERE id = ?
        `, [invitationId]);

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting invitation:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to delete invitation');
    }
}
