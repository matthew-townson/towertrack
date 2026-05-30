import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { ensurePresetCalendars } from '$lib/server/calendar.js';

// GET - Fetch a specific invitation
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const invitationId = params.invitationId;

        const [invitations] = await db.query(`
            SELECT 
                i.id,
                i.eventId,
                i.invitedUserId,
                i.invitedBy,
                i.status,
                i.createdAt,
                i.respondedAt,
                e.title,
                e.description,
                e.location,
                e.startDate,
                e.endDate,
                e.allDay,
                u.username as organiserUsername
            FROM EventInvitation i
            JOIN CalendarEvent e ON i.eventId = e.id
            JOIN User u ON e.userId = u.id
            WHERE i.id = ? AND i.invitedUserId = ?
        `, [invitationId, locals.user.id]);

        if (invitations.length === 0) {
            throw error(404, 'Invitation not found');
        }

        return json(invitations[0]);
    } catch (err) {
        if (err.status) throw err;
        console.error('Error fetching invitation:', err);
        throw error(500, 'Failed to fetch invitation');
    }
}

// PATCH - Update invitation status (respond to invitation)
export async function PATCH({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const invitationId = params.invitationId;
        const { status } = await request.json();

        if (!status || !['accepted', 'declined', 'maybe', 'pending'].includes(status)) {
            throw error(400, 'Valid status is required (accepted, declined, maybe, pending)');
        }

        // Fetch full invitation and event details
        const [invitations] = await db.query(`
            SELECT 
                i.id,
                i.eventId,
                i.invitedUserId,
                e.title,
                e.description,
                e.location,
                e.towerID,
                e.startDate,
                e.endDate,
                e.allDay,
                c.presetType
            FROM EventInvitation i
            JOIN CalendarEvent e ON i.eventId = e.id
            JOIN UserCalendar c ON e.calendarId = c.id
            WHERE i.id = ?
        `, [invitationId]);

        if (invitations.length === 0) {
            throw error(404, 'Invitation not found');
        }

        const invitation = invitations[0];

        if (invitation.invitedUserId !== locals.user.id) {
            throw error(403, 'You do not have permission to respond to this invitation');
        }

        // Update the invitation status
        await db.query(`
            UPDATE EventInvitation 
            SET status = ?, respondedAt = NOW()
            WHERE id = ?
        `, [status, invitationId]);

        // Handle calendar event creation/update based on response
        if (status === 'accepted' || status === 'maybe') {
            // Ensure user has preset calendars
            await ensurePresetCalendars(db, locals.user.id);

            // Find the matching calendar for the invited user based on presetType
            let targetCalendarId = null;
            
            if (invitation.presetType) {
                // Find user's calendar with matching presetType
                const [matchingCalendars] = await db.query(`
                    SELECT id FROM UserCalendar 
                    WHERE userId = ? AND presetType = ?
                `, [locals.user.id, invitation.presetType]);
                
                if (matchingCalendars.length > 0) {
                    targetCalendarId = matchingCalendars[0].id;
                }
            }
            
            // Fallback to first calendar if no matching preset found
            if (!targetCalendarId) {
                const [userCalendars] = await db.query(`
                    SELECT id FROM UserCalendar WHERE userId = ? LIMIT 1
                `, [locals.user.id]);
                
                if (userCalendars.length > 0) {
                    targetCalendarId = userCalendars[0].id;
                }
            }

            if (targetCalendarId) {
                const eventStatus = status === 'accepted' ? 'confirmed' : 'tentative';

                // Check if user already has a linked event for this source event
                const [existingEvents] = await db.query(`
                    SELECT id FROM CalendarEvent 
                    WHERE userId = ? AND sourceEventId = ?
                `, [locals.user.id, invitation.eventId]);

                if (existingEvents.length > 0) {
                    // Update existing linked event
                    await db.query(`
                        UPDATE CalendarEvent 
                        SET status = ?, calendarId = ?
                        WHERE id = ?
                    `, [eventStatus, targetCalendarId, existingEvents[0].id]);
                } else {
                    // Create new linked event in user's calendar
                    await db.query(`
                        INSERT INTO CalendarEvent 
                        (userId, calendarId, title, description, location, towerID, startDate, endDate, allDay, sourceEventId, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        locals.user.id,
                        targetCalendarId,
                        invitation.title,
                        invitation.description,
                        invitation.location,
                        invitation.towerID,
                        invitation.startDate,
                        invitation.endDate,
                        invitation.allDay,
                        invitation.eventId,
                        eventStatus
                    ]);
                }
            }
        } else if (status === 'declined' || status === 'pending') {
            // Remove any linked event if declining or resetting to pending
            await db.query(`
                DELETE FROM CalendarEvent 
                WHERE userId = ? AND sourceEventId = ?
            `, [locals.user.id, invitation.eventId]);
        }

        return json({ success: true, status });
    } catch (err) {
        if (err.status) throw err;
        console.error('Error updating invitation:', err);
        throw error(500, 'Failed to update invitation');
    }
}

// DELETE - Remove an invitation (for event organiser)
export async function DELETE({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const invitationId = params.invitationId;

        // Verify invitation exists and user is the event organiser
        const [invitations] = await db.query(`
            SELECT i.id, e.userId as organiserId
            FROM EventInvitation i
            JOIN CalendarEvent e ON i.eventId = e.id
            WHERE i.id = ?
        `, [invitationId]);

        if (invitations.length === 0) {
            throw error(404, 'Invitation not found');
        }

        if (invitations[0].organiserId !== locals.user.id) {
            throw error(403, 'You do not have permission to remove this invitation');
        }

        await db.query(`
            DELETE FROM EventInvitation WHERE id = ?
        `, [invitationId]);

        return json({ success: true });
    } catch (err) {
        if (err.status) throw err;
        console.error('Error deleting invitation:', err);
        throw error(500, 'Failed to delete invitation');
    }
}
