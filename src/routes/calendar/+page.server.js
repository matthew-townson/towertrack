import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { ensurePresetCalendars } from '$lib/server/calendar.js';
import { generateRecurringInstances } from '$lib/server/recurrence.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(302, '/login?redirect=/calendar');
    }

    // Ensure preset calendars exist
    await ensurePresetCalendars(db, locals.user.id);

    // Fetch calendars
    const [calendars] = await db.query(`
        SELECT id, name, colour, isPreset, presetType, requireOrganise, createdAt
        FROM UserCalendar
        WHERE userId = ?
        ORDER BY isPreset DESC, name ASC
    `, [locals.user.id]);

    // Fetch events for current month (with some buffer)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const [rawEvents] = await db.query(`
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
        WHERE e.userId = ? AND (
            (e.recurrenceType = 'none' OR e.recurrenceType IS NULL) AND e.startDate >= ? AND e.startDate <= ?
            OR
            (e.recurrenceType IS NOT NULL AND e.recurrenceType != 'none' AND e.startDate <= ?)
        )
        ORDER BY e.startDate ASC
    `, [locals.user.id, startOfMonth, endOfMonth, endOfMonth]);

    // Expand recurring events
    const events = [];
    for (const event of rawEvents) {
        if (event.recurrenceType && event.recurrenceType !== 'none') {
            const instances = generateRecurringInstances(event, startOfMonth, endOfMonth);
            events.push(...instances);
        } else {
            events.push(event);
        }
    }

    // Sort by start date
    events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // Fetch organised events (events created by user with invitation info)
    // Only include events with at least one invitation and that haven't passed
    const [organisedEvents] = await db.query(`
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
            (SELECT COUNT(*) FROM EventInvitation WHERE eventId = e.id) as invitationCount,
            (SELECT COUNT(*) FROM EventInvitation WHERE eventId = e.id AND status = 'accepted') as acceptedCount
        FROM CalendarEvent e
        JOIN UserCalendar c ON e.calendarId = c.id
        LEFT JOIN Tower t ON e.towerID = t.TowerID
        WHERE e.userId = ? 
            AND e.sourceEventId IS NULL 
            AND e.startDate >= NOW()
            AND (SELECT COUNT(*) FROM EventInvitation WHERE eventId = e.id) > 0
        ORDER BY e.startDate ASC
        LIMIT 20
    `, [locals.user.id]);

    // Fetch invitations for user
    const [invitations] = await db.query(`
        SELECT 
            i.id as invitationId,
            i.status,
            i.createdAt as invitedAt,
            e.id as eventId,
            e.title,
            e.description,
            e.location,
            e.towerID,
            e.method,
            e.composition,
            e.startDate,
            e.endDate,
            e.allDay,
            c.name as calendarName,
            c.colour as calendarColour,
            t.Place as towerPlace,
            t.Dedicn as towerDedication,
            u.username as organiserUsername,
            u.profileImage as organiserProfileImage
        FROM EventInvitation i
        JOIN CalendarEvent e ON i.eventId = e.id
        JOIN UserCalendar c ON e.calendarId = c.id
        JOIN User u ON e.userId = u.id
        LEFT JOIN Tower t ON e.towerID = t.TowerID
        WHERE i.invitedUserId = ? AND e.startDate >= NOW()
        ORDER BY e.startDate ASC
    `, [locals.user.id]);

    // Fetch shared calendars (owned or member)
    const [sharedCalendars] = await db.query(`
        SELECT 
            sc.id, sc.name, sc.colour, sc.ownerId, sc.secretKey,
            o.username as ownerUsername,
            'owner' as role
        FROM SharedCalendar sc
        JOIN User o ON sc.ownerId = o.id
        WHERE sc.ownerId = ?
        
        UNION
        
        SELECT 
            sc.id, sc.name, sc.colour, sc.ownerId, NULL as secretKey,
            o.username as ownerUsername,
            scm.role
        FROM SharedCalendar sc
        JOIN SharedCalendarMember scm ON sc.id = scm.sharedCalendarId
        JOIN User o ON sc.ownerId = o.id
        WHERE scm.userId = ?
        
        ORDER BY name ASC
    `, [locals.user.id, locals.user.id]);

    // Fetch shared calendar events for display
    let sharedEvents = [];
    if (sharedCalendars.length > 0) {
        const sharedCalendarIds = sharedCalendars.map(sc => sc.id);
        const [rawSharedEvents] = await db.query(`
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
                sc.name as calendarName,
                sc.colour as calendarColour,
                u.username as createdByUsername,
                t.Place as towerPlace,
                t.Dedicn as towerDedication,
                t.Bells as towerBells,
                t.Lat as towerLat,
                t.Long as towerLong
            FROM SharedCalendarEvent e
            JOIN SharedCalendar sc ON e.sharedCalendarId = sc.id
            JOIN User u ON e.createdBy = u.id
            LEFT JOIN Tower t ON e.towerID = t.TowerID
            WHERE e.sharedCalendarId IN (${sharedCalendarIds.map(() => '?').join(',')})
            AND (
                (e.recurrenceType = 'none' OR e.recurrenceType IS NULL) AND e.startDate >= ? AND e.startDate <= ?
                OR
                (e.recurrenceType IS NOT NULL AND e.recurrenceType != 'none' AND e.startDate <= ?)
            )
            ORDER BY e.startDate ASC
        `, [...sharedCalendarIds, startOfMonth, endOfMonth, endOfMonth]);

        for (const event of rawSharedEvents) {
            // Mark as shared for UI
            event.isShared = true;
            if (event.recurrenceType && event.recurrenceType !== 'none') {
                const instances = generateRecurringInstances(event, startOfMonth, endOfMonth);
                sharedEvents.push(...instances.map(i => ({ ...i, isShared: true })));
            } else {
                sharedEvents.push(event);
            }
        }
    }

    return {
        user: locals.user,
        calendars,
        events,
        organisedEvents,
        invitations,
        sharedCalendars,
        sharedEvents
    };
}
