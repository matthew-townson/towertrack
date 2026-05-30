import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { notifyEventInvitation } from '$lib/server/notifications.js';

// GET - Fetch single event
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const [events] = await db.query(`
            SELECT 
                e.*,
                c.name as calendarName,
                c.colour as calendarColour
            FROM CalendarEvent e
            JOIN UserCalendar c ON e.calendarId = c.id
            WHERE e.id = ? AND e.userId = ?
        `, [params.eventId, locals.user.id]);

        if (events.length === 0) {
            throw error(404, 'Event not found');
        }

        return json(events[0]);
    } catch (err) {
        console.error('Error fetching event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to fetch event');
    }
}

// PUT - Update event
export async function PUT({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { 
            calendarId, 
            title, 
            description, 
            location, 
            towerID,
            method,
            composition, 
            startDate, 
            endDate, 
            allDay,
            recurrenceType,
            recurrenceInterval,
            recurrenceEndDate,
            invitedUsers,
            guestInvites,
            editScope,
            originalStartDate
        } = await request.json();

        // Verify event belongs to user and check if it's from an invitation
        const [existing] = await db.query(`
            SELECT id, sourceEventId, recurrenceType, startDate as origStart, calendarId
            FROM CalendarEvent WHERE id = ? AND userId = ?
        `, [params.eventId, locals.user.id]);

        if (existing.length === 0) {
            throw error(404, 'Event not found');
        }

        // Prevent editing events that came from invitations
        if (existing[0].sourceEventId) {
            throw error(403, 'Cannot edit an event from an invitation. Contact the organiser to make changes.');
        }

        // If changing calendar, verify new calendar belongs to user
        if (calendarId) {
            const [calendar] = await db.query(`
                SELECT id FROM UserCalendar WHERE id = ? AND userId = ?
            `, [calendarId, locals.user.id]);

            if (calendar.length === 0) {
                throw error(404, 'Calendar not found');
            }
        }

        const isRecurring = existing[0].recurrenceType && existing[0].recurrenceType !== 'none';
        
        // Handle different edit scopes for recurring events
        if (isRecurring && editScope === 'single') {
            // Create a new non-recurring event for this single occurrence
            // and add an exception to the original series (we'll handle this by creating a standalone event)
            const [result] = await db.query(`
                INSERT INTO CalendarEvent (userId, calendarId, title, description, location, towerID, method, composition, startDate, endDate, allDay, recurrenceType, recurrenceInterval, recurrenceEndDate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', 1, NULL)
            `, [
                locals.user.id,
                calendarId || existing[0].calendarId,
                title?.trim(),
                description,
                location,
                towerID,
                method,
                composition,
                startDate,
                endDate,
                allDay
            ]);
            
            // Note: The original recurring event remains unchanged
            // The new event will appear on the edited date
            // For a complete solution, you'd also track exceptions in the recurring event
            
            return json({ success: true, newEventId: result.insertId });
        } else if (isRecurring && editScope === 'future') {
            // End the current series before this date and create a new series from this date
            const occurrenceDate = originalStartDate ? new Date(originalStartDate) : new Date(startDate);
            const dayBefore = new Date(occurrenceDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            
            // Update original event to end before this occurrence
            await db.query(`
                UPDATE CalendarEvent
                SET recurrenceEndDate = ?
                WHERE id = ? AND userId = ?
            `, [dayBefore.toISOString().slice(0, 10), params.eventId, locals.user.id]);
            
            // Create new recurring event starting from this occurrence
            const [result] = await db.query(`
                INSERT INTO CalendarEvent (userId, calendarId, title, description, location, towerID, method, composition, startDate, endDate, allDay, recurrenceType, recurrenceInterval, recurrenceEndDate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                locals.user.id,
                calendarId || existing[0].calendarId,
                title?.trim(),
                description,
                location,
                towerID,
                method,
                composition,
                startDate,
                endDate,
                allDay,
                recurrenceType,
                recurrenceInterval,
                recurrenceEndDate
            ]);
            
            return json({ success: true, newEventId: result.insertId });
        }
        
        // Default: edit all events in series (or single non-recurring event)
        // Update the main event
        await db.query(`
            UPDATE CalendarEvent
            SET 
                calendarId = COALESCE(?, calendarId),
                title = COALESCE(?, title),
                description = ?,
                location = ?,
                towerID = ?,
                method = ?,
                composition = ?,
                startDate = COALESCE(?, startDate),
                endDate = ?,
                allDay = COALESCE(?, allDay),
                recurrenceType = COALESCE(?, recurrenceType),
                recurrenceInterval = COALESCE(?, recurrenceInterval),
                recurrenceEndDate = ?
            WHERE id = ? AND userId = ?
        `, [
            calendarId,
            title?.trim(),
            description,
            location,
            towerID,
            method,
            composition,
            startDate,
            endDate,
            allDay,
            recurrenceType,
            recurrenceInterval,
            recurrenceEndDate,
            params.eventId,
            locals.user.id
        ]);

        // Propagate changes to all linked events (from invitations)
        // These are events where sourceEventId points to this event
        await db.query(`
            UPDATE CalendarEvent
            SET 
                title = ?,
                description = ?,
                location = ?,
                towerID = ?,
                method = ?,
                composition = ?,
                startDate = ?,
                endDate = ?,
                allDay = ?,
                recurrenceType = ?,
                recurrenceInterval = ?,
                recurrenceEndDate = ?
            WHERE sourceEventId = ?
        `, [
            title?.trim(),
            description,
            location,
            towerID,
            method,
            composition,
            startDate,
            endDate,
            allDay,
            recurrenceType,
            recurrenceInterval,
            recurrenceEndDate,
            params.eventId
        ]);

        // Handle invitation updates if provided
        if (invitedUsers !== undefined || guestInvites !== undefined) {
            // Get current invitations
            const [currentInvitations] = await db.query(`
                SELECT id, invitedUserId, guestName FROM EventInvitation WHERE eventId = ?
            `, [params.eventId]);

            // Build sets of current and new invitations
            const currentUserIds = new Set(currentInvitations.filter(i => i.invitedUserId).map(i => i.invitedUserId));
            const currentGuestNames = new Set(currentInvitations.filter(i => i.guestName).map(i => i.guestName));
            
            // invitedUsers is an array of user IDs, guestInvites is an array of guest names
            const newUserIds = new Set(invitedUsers || []);
            const newGuestNames = new Set(guestInvites || []);

            // Find invitations to remove (in current but not in new)
            const userIdsToRemove = [...currentUserIds].filter(id => !newUserIds.has(id));
            const guestNamesToRemove = [...currentGuestNames].filter(name => !newGuestNames.has(name));

            // Find invitations to add (in new but not in current)
            const userIdsToAdd = [...newUserIds].filter(id => !currentUserIds.has(id));
            const guestNamesToAdd = [...newGuestNames].filter(name => !currentGuestNames.has(name));

            // Remove invitations and their linked calendar events
            for (const userId of userIdsToRemove) {
                // Delete the linked calendar event for this user
                await db.query(`
                    DELETE FROM CalendarEvent WHERE sourceEventId = ? AND userId = ?
                `, [params.eventId, userId]);
                
                // Delete the invitation
                await db.query(`
                    DELETE FROM EventInvitation WHERE eventId = ? AND invitedUserId = ?
                `, [params.eventId, userId]);
            }

            // Remove guest invitations
            for (const guestName of guestNamesToRemove) {
                await db.query(`
                    DELETE FROM EventInvitation WHERE eventId = ? AND guestName = ?
                `, [params.eventId, guestName]);
            }

            // Add new user invitations
            for (const userId of userIdsToAdd) {
                await db.query(`
                    INSERT INTO EventInvitation (eventId, invitedUserId, invitedBy, status)
                    VALUES (?, ?, ?, 'pending')
                `, [params.eventId, userId, locals.user.id]);
            }
            
            // Send notifications for new invitations
            if (userIdsToAdd.length > 0) {
                await notifyEventInvitation(
                    parseInt(params.eventId),
                    title?.trim() || 'Event',
                    locals.user.id,
                    locals.user.username,
                    userIdsToAdd
                );
            }

            // Add new guest invitations
            for (const guestName of guestNamesToAdd) {
                await db.query(`
                    INSERT INTO EventInvitation (eventId, guestName, invitedBy, status)
                    VALUES (?, ?, ?, 'guest')
                `, [params.eventId, guestName, locals.user.id]);
            }
        }

        return json({ success: true });
    } catch (err) {
        console.error('Error updating event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update event');
    }
}

// DELETE - Delete event
export async function DELETE({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Check if this is an event from an invitation
        const [existing] = await db.query(`
            SELECT id, sourceEventId FROM CalendarEvent WHERE id = ? AND userId = ?
        `, [params.eventId, locals.user.id]);

        if (existing.length === 0) {
            throw error(404, 'Event not found');
        }

        // If this is an event that was created from an invitation (invitee's copy),
        // update the EventInvitation status to 'declined' for this user instead
        if (existing[0].sourceEventId) {
            // Mark the invitation as declined
            await db.query(`
                UPDATE EventInvitation
                SET status = 'declined'
                WHERE eventId = ? AND invitedUserId = ?
            `, [existing[0].sourceEventId, locals.user.id]);

            // Remove the invitee's calendar event copy
            const [result] = await db.query(`
                DELETE FROM CalendarEvent
                WHERE id = ? AND userId = ?
            `, [params.eventId, locals.user.id]);

            if (result.affectedRows === 0) {
                throw error(404, 'Event not found');
            }

            return json({ success: true, status: 'declined' });
        }

        // The linked events will be automatically deleted via CASCADE when source is deleted
        const [result] = await db.query(`
            DELETE FROM CalendarEvent
            WHERE id = ? AND userId = ?
        `, [params.eventId, locals.user.id]);

        if (result.affectedRows === 0) {
            throw error(404, 'Event not found');
        }

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to delete event');
    }
}
