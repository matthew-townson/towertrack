import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// GET - Fetch events organised by the current user (events with invitations)
export async function GET({ locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const [events] = await db.query(`
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
                e.recurrenceType,
                e.recurrenceInterval,
                e.recurrenceEndDate,
                c.name as calendarName,
                c.colour as calendarColour,
                t.Place as towerPlace,
                t.Dedicn as towerDedication,
                t.County as towerCounty,
                t.Bells as towerBells,
                (SELECT COUNT(*) FROM EventInvitation WHERE eventId = e.id) as invitationCount
            FROM CalendarEvent e
            JOIN UserCalendar c ON e.calendarId = c.id
            LEFT JOIN Tower t ON e.towerID = t.TowerID
            WHERE e.userId = ?
            AND EXISTS (SELECT 1 FROM EventInvitation WHERE eventId = e.id)
            AND e.startDate >= NOW()
            ORDER BY e.startDate ASC
        `, [locals.user.id]);

        return json(events);
    } catch (err) {
        console.error('Error fetching organised events:', err);
        throw error(500, 'Failed to fetch organised events');
    }
}
