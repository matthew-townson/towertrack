import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { generateRecurringInstances } from '$lib/server/recurrence.js';

// Helper to check user's access to a shared calendar
async function getCalendarAccess(calendarId, userId) {
    const [rows] = await db.query(`
        SELECT sc.id, sc.ownerId, sc.name,
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

// GET - Fetch events for a shared calendar
export async function GET({ params, url, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');

        let query = `
            SELECT 
                e.id,
                e.sharedCalendarId,
                e.createdBy,
                e.title,
                e.description,
                e.location,
                e.towerID,
                e.method,
                e.composition,
                e.startDate,
                e.endDate,
                e.allDay,
                e.status,
                e.recurrenceType,
                e.recurrenceInterval,
                e.recurrenceEndDate,
                e.createdAt,
                u.username as createdByUsername,
                t.Place as towerPlace,
                t.Dedicn as towerDedication,
                t.Bells as towerBells,
                t.Lat as towerLat,
                t.Long as towerLong
            FROM SharedCalendarEvent e
            JOIN User u ON e.createdBy = u.id
            LEFT JOIN Tower t ON e.towerID = t.TowerID
            WHERE e.sharedCalendarId = ?
        `;
        const queryParams = [params.calendarId];

        if (start && end) {
            query += ` AND (
                (e.recurrenceType = 'none' OR e.recurrenceType IS NULL) AND e.startDate >= ? AND e.startDate <= ?
                OR
                (e.recurrenceType IS NOT NULL AND e.recurrenceType != 'none' AND e.startDate <= ?)
            )`;
            queryParams.push(start, end, end);
        }

        query += ' ORDER BY e.startDate ASC';

        const [rawEvents] = await db.query(query, queryParams);

        // Expand recurring events
        const events = [];
        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;

        for (const event of rawEvents) {
            if (startDate && endDate && event.recurrenceType && event.recurrenceType !== 'none') {
                const instances = generateRecurringInstances(event, startDate, endDate);
                events.push(...instances);
            } else {
                events.push(event);
            }
        }

        // Sort by start date
        events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        return json(events);
    } catch (err) {
        console.error('Error fetching shared calendar events:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to fetch events');
    }
}

// POST - Create an event in a shared calendar (owner or editor)
export async function POST({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const calendar = await getCalendarAccess(params.calendarId, locals.user.id);
        if (!calendar) {
            throw error(404, 'Shared calendar not found');
        }

        if (calendar.role === 'viewer') {
            throw error(403, 'Viewers cannot create events');
        }

        const body = await request.json();
        const { title, description, location, towerID, method, composition, startDate, endDate, allDay, 
                recurrenceType, recurrenceInterval, recurrenceEndDate } = body;

        if (!title || title.trim().length === 0) {
            throw error(400, 'Event title is required');
        }

        if (!startDate) {
            throw error(400, 'Start date is required');
        }

        // Get tower coordinates if towerID is provided
        let coordinates = null;
        if (towerID) {
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
        }

        const [result] = await db.query(`
            INSERT INTO SharedCalendarEvent 
                (sharedCalendarId, createdBy, title, description, location, towerID, method, composition, coordinates,
                 startDate, endDate, allDay, recurrenceType, recurrenceInterval, recurrenceEndDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            params.calendarId,
            locals.user.id,
            title.trim(),
            description || null,
            location || null,
            towerID || null,
            method || null,
            composition || null,
            coordinates || null,
            startDate,
            endDate || null,
            allDay || false,
            recurrenceType || 'none',
            recurrenceInterval || 1,
            recurrenceEndDate || null
        ]);

        return json({ id: result.insertId, success: true }, { status: 201 });
    } catch (err) {
        console.error('Error creating shared calendar event:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to create event');
    }
}
