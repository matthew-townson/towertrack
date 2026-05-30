import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// GET - Get invitations for an event
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Check if user is either the event owner or an invitee
        const [event] = await db.query(`
            SELECT e.id, e.userId, e.sourceEventId
            FROM CalendarEvent e
            WHERE e.id = ?
        `, [params.eventId]);

        if (event.length === 0) {
            throw error(404, 'Event not found');
        }

        const isOwner = event[0].userId === locals.user.id;
        
        // Check if user is invited to this event
        const [invitation] = await db.query(`
            SELECT id FROM EventInvitation 
            WHERE eventId = ? AND invitedUserId = ?
        `, [params.eventId, locals.user.id]);

        const isInvited = invitation.length > 0;

        if (!isOwner && !isInvited) {
            throw error(403, 'You do not have permission to view invitations for this event');
        }

        // Get all invitations for this event
        const [invitations] = await db.query(`
            SELECT 
                i.id,
                i.invitedUserId,
                i.guestName,
                i.status,
                i.createdAt,
                u.username,
                u.profileImage
            FROM EventInvitation i
            LEFT JOIN User u ON i.invitedUserId = u.id
            WHERE i.eventId = ?
            ORDER BY i.createdAt ASC
        `, [params.eventId]);

        return json(invitations);
    } catch (err) {
        console.error('Error fetching invitations:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to fetch invitations');
    }
}

// POST - Create an invitation
export async function POST({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { invitedUserId, guestName, instanceDate } = await request.json();

        // Verify event exists and user is the owner
        const [event] = await db.query(`
            SELECT id, userId FROM CalendarEvent WHERE id = ?
        `, [params.eventId]);

        if (event.length === 0) {
            throw error(404, 'Event not found');
        }

        if (event[0].userId !== locals.user.id) {
            throw error(403, 'You do not have permission to invite people to this event');
        }

        // Check if invitation already exists for this user/guest
        const [existingInvitations] = await db.query(`
            SELECT id FROM EventInvitation 
            WHERE eventId = ? 
            AND (invitedUserId = ? OR (guestName = ? AND invitedUserId IS NULL))
        `, [
            params.eventId,
            invitedUserId || null,
            guestName || null
        ]);

        if (existingInvitations.length > 0) {
            throw error(400, 'This user has already been invited to this event');
        }

        // Insert invitation
        const [result] = await db.query(`
            INSERT INTO EventInvitation (eventId, invitedUserId, guestName, status, invitedBy)
            VALUES (?, ?, ?, 'pending', ?)
        `, [params.eventId, invitedUserId || null, guestName || null, locals.user.id]);

        // Get the created invitation
        const [invitation] = await db.query(`
            SELECT 
                i.id,
                i.invitedUserId,
                i.guestName,
                i.status,
                i.createdAt,
                u.username,
                u.profileImage
            FROM EventInvitation i
            LEFT JOIN User u ON i.invitedUserId = u.id
            WHERE i.id = ?
        `, [result.insertId]);

        return json(invitation[0], { status: 201 });
    } catch (err) {
        console.error('Error creating invitation:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to create invitation');
    }
}

// DELETE - Delete an invitation
export async function DELETE({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { invitationId } = await request.json();

        // Verify event exists and user is the owner
        const [event] = await db.query(`
            SELECT id, userId FROM CalendarEvent WHERE id = ?
        `, [params.eventId]);

        if (event.length === 0) {
            throw error(404, 'Event not found');
        }

        if (event[0].userId !== locals.user.id) {
            throw error(403, 'You do not have permission to manage invitations for this event');
        }

        // Delete invitation
        await db.query(`
            DELETE FROM EventInvitation WHERE id = ? AND eventId = ?
        `, [invitationId, params.eventId]);

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting invitation:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to delete invitation');
    }
}
