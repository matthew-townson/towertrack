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

// Helper to get event and verify shared calendar access
async function getEventWithAccess(calendarId, eventId, userId) {
    const calendar = await getCalendarAccess(calendarId, userId);
    if (!calendar) return { calendar: null, event: null };

    const [events] = await db.query(`
        SELECT 
            e.*,
            t.Place as towerPlace,
            t.Dedicn as towerDedication,
            t.Bells as towerBells,
            t.Lat as towerLat,
            t.Long as towerLong
        FROM SharedCalendarEvent e
        LEFT JOIN Tower t ON e.towerID = t.TowerID
        WHERE e.id = ? AND e.sharedCalendarId = ?
    `, [eventId, calendarId]);

    return { calendar, event: events.length > 0 ? events[0] : null };
}

// GET - Fetch a single shared calendar event
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { calendar, event } = await getEventWithAccess(params.calendarId, params.eventId, locals.user.id);
        if (!calendar) throw error(404, 'Shared calendar not found');
        if (!event) throw error(404, 'Event not found');

        return json(event);
    } catch (err) {
        console.error('Error fetching event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to fetch event');
    }
}

// PUT - Update a shared calendar event (owner or editor)
export async function PUT({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { calendar, event } = await getEventWithAccess(params.calendarId, params.eventId, locals.user.id);
        if (!calendar) throw error(404, 'Shared calendar not found');
        if (!event) throw error(404, 'Event not found');

        if (calendar.role === 'viewer') {
            throw error(403, 'Viewers cannot edit events');
        }

        const body = await request.json();
        const { title, description, location, towerID, method, composition, startDate, endDate, allDay,
                recurrenceType, recurrenceInterval, recurrenceEndDate } = body;

        if (title !== undefined && (!title || title.trim().length === 0)) {
            throw error(400, 'Event title is required');
        }

        // Get tower coordinates if towerID is provided
        let coordinates = event.coordinates;
        if (towerID !== undefined && towerID) {
            const [towerRows] = await db.query(`
                SELECT Lat, \`Long\` FROM Tower WHERE TowerID = ?
            `, [towerID]);
            if (towerRows.length > 0) {
                const lat = towerRows[0].Lat;
                const lon = towerRows[0].Long;
                if (lat && lon) {
                    coordinates = `${lat},${lon}`;
                }
            }
        } else if (towerID === null) {
            coordinates = null;
        }

        await db.query(`
            UPDATE SharedCalendarEvent SET
                title = COALESCE(?, title),
                description = ?,
                location = ?,
                towerID = ?,
                method = ?,
                composition = ?,
                coordinates = ?,
                startDate = COALESCE(?, startDate),
                endDate = ?,
                allDay = COALESCE(?, allDay),
                recurrenceType = COALESCE(?, recurrenceType),
                recurrenceInterval = COALESCE(?, recurrenceInterval),
                recurrenceEndDate = ?
            WHERE id = ? AND sharedCalendarId = ?
        `, [
            title?.trim() || null,
            description !== undefined ? description : event.description,
            location !== undefined ? location : event.location,
            towerID !== undefined ? towerID : event.towerID,
            method !== undefined ? method : event.method,
            composition !== undefined ? composition : event.composition,
            coordinates,
            startDate || null,
            endDate !== undefined ? endDate : event.endDate,
            allDay !== undefined ? allDay : null,
            recurrenceType || null,
            recurrenceInterval || null,
            recurrenceEndDate !== undefined ? recurrenceEndDate : event.recurrenceEndDate,
            params.eventId,
            params.calendarId
        ]);

        return json({ success: true });
    } catch (err) {
        console.error('Error updating event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update event');
    }
}

// DELETE - Delete a shared calendar event (owner, editor, or creator)
export async function DELETE({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { calendar, event } = await getEventWithAccess(params.calendarId, params.eventId, locals.user.id);
        if (!calendar) throw error(404, 'Shared calendar not found');
        if (!event) throw error(404, 'Event not found');

        if (calendar.role === 'viewer') {
            throw error(403, 'Viewers cannot delete events');
        }

        // Delete any invitations for this event first
        await db.query('DELETE FROM SharedEventInvitation WHERE sharedEventId = ?', [params.eventId]);
        
        // Then delete the event
        await db.query('DELETE FROM SharedCalendarEvent WHERE id = ?', [params.eventId]);

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to delete event');
    }
}
