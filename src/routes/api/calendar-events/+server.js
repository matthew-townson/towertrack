import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { generateRecurringInstances } from '$lib/server/recurrence.js';
import { notifyEventInvitation } from '$lib/server/notifications.js';

// GET - Fetch all events for user (optionally filtered by calendar)
export async function GET({ url, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendarId = url.searchParams.get('calendarId');
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');

        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;

        let query = `
            SELECT 
                e.id,
                e.calendarId,
                e.title,
                e.description,
                e.location,
                e.towerID,
                e.method,
                e.composition,
                e.startDate,
                e.endDate,
                e.allDay,
                e.sourceEventId,
                e.status,
                e.recurrenceType,
                e.recurrenceInterval,
                e.recurrenceEndDate,
                c.name as calendarName,
                c.colour as calendarColour,
                t.Place as towerPlace,
                t.Dedicn as towerDedication,
                t.Bells as towerBells,
                t.Lat as towerLat,
                t.Long as towerLong,
                organiser.id as organiserId,
                organiser.username as organiserUsername,
                organiser.profileImage as organiserProfileImage
            FROM CalendarEvent e
            JOIN UserCalendar c ON e.calendarId = c.id
            LEFT JOIN Tower t ON e.towerID = t.TowerID
            LEFT JOIN CalendarEvent sourceEvent ON e.sourceEventId = sourceEvent.id
            LEFT JOIN User organiser ON sourceEvent.userId = organiser.id
            WHERE e.userId = ?
        `;
        const params = [locals.user.id];

        if (calendarId) {
            query += ' AND e.calendarId = ?';
            params.push(calendarId);
        }

        // For recurring events, we need different logic
        if (startDate && endDate) {
            query += ` AND (
                (e.recurrenceType = 'none' OR e.recurrenceType IS NULL) AND e.startDate >= ? AND e.startDate <= ?
                OR
                (e.recurrenceType IS NOT NULL AND e.recurrenceType != 'none' AND e.startDate <= ?)
            )`;
            params.push(start, end, end);
        } else if (start) {
            query += ' AND e.startDate >= ?';
            params.push(start);
        } else if (end) {
            query += ' AND e.startDate <= ?';
            params.push(end);
        }

        query += ' ORDER BY e.startDate ASC';

        const [rawEvents] = await db.query(query, params);

        // Expand recurring events if we have a date range
        if (startDate && endDate) {
            const events = [];
            for (const event of rawEvents) {
                if (event.recurrenceType && event.recurrenceType !== 'none') {
                    const instances = generateRecurringInstances(event, startDate, endDate);
                    events.push(...instances);
                } else {
                    events.push(event);
                }
            }
            // Sort by start date
            events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            return json(events);
        }

        return json(rawEvents);
    } catch (err) {
        console.error('Error fetching events:', err);
        throw error(500, 'Failed to fetch events');
    }
}

// POST - Create a new event
export async function POST({ request, locals }) {
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
            guestInvites
        } = await request.json();

        if (!calendarId) {
            throw error(400, 'Calendar is required');
        }

        if (!title || title.trim().length === 0) {
            throw error(400, 'Event title is required');
        }

        if (!startDate) {
            throw error(400, 'Start date is required');
        }

        // Verify calendar belongs to user
        const [calendar] = await db.query(`
            SELECT id FROM UserCalendar WHERE id = ? AND userId = ?
        `, [calendarId, locals.user.id]);

        if (calendar.length === 0) {
            throw error(404, 'Calendar not found');
        }

        const [result] = await db.query(`
            INSERT INTO CalendarEvent (userId, calendarId, title, description, location, towerID, method, composition, startDate, endDate, allDay, recurrenceType, recurrenceInterval, recurrenceEndDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            locals.user.id,
            calendarId,
            title.trim(),
            description || null,
            location || null,
            towerID || null,
            method || null,
            composition || null,
            startDate,
            endDate || null,
            allDay || false,
            recurrenceType || 'none',
            recurrenceInterval || 1,
            recurrenceEndDate || null
        ]);

        const eventId = result.insertId;

        // Create invitations for registered users
        if (invitedUsers && invitedUsers.length > 0) {
            const inviteValues = invitedUsers.map(userId => [eventId, parseInt(userId), null, locals.user.id]);
            await db.query(`
                INSERT INTO EventInvitation (eventId, invitedUserId, guestName, invitedBy)
                VALUES ?
            `, [inviteValues]);
            
            // Send notifications to invited users
            await notifyEventInvitation(
                eventId,
                title.trim(),
                locals.user.id,
                locals.user.username,
                invitedUsers.map(id => parseInt(id))
            );
        }

        // Create invitations for guest names (people not in the system)
        if (guestInvites && guestInvites.length > 0) {
            const guestValues = guestInvites.map(name => [eventId, null, name, locals.user.id, 'guest']);
            await db.query(`
                INSERT INTO EventInvitation (eventId, invitedUserId, guestName, invitedBy, status)
                VALUES ?
            `, [guestValues]);
        }

        return json({
            id: eventId,
            calendarId,
            title: title.trim(),
            description,
            location,
            towerID,
            method,
            composition,
            startDate,
            endDate,
            allDay,
            recurrenceType: recurrenceType || 'none',
            recurrenceInterval: recurrenceInterval || 1,
            recurrenceEndDate
        }, { status: 201 });
    } catch (err) {
        console.error('Error creating event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to create event');
    }
}
