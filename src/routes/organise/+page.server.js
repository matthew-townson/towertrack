import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { ensurePresetCalendars } from '$lib/server/calendar.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(302, '/login?redirect=/organise');
    }

    // Ensure preset calendars exist
    await ensurePresetCalendars(db, locals.user.id);

    // Fetch calendars that require or allow organise mode
    const [calendars] = await db.query(`
        SELECT id, name, colour, isPreset, presetType, requireOrganise, createdAt
        FROM UserCalendar
        WHERE userId = ?
        ORDER BY isPreset DESC, name ASC
    `, [locals.user.id]);

    // Fetch recent events organised by this user (for display)
    const [recentEvents] = await db.query(`
        SELECT 
            e.id,
            e.calendarId,
            e.title,
            e.description,
            e.location,
            e.towerID,
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
        WHERE e.userId = ? AND (e.startDate >= NOW() OR (e.recurrenceType IS NOT NULL AND e.recurrenceType != 'none'))
        ORDER BY e.startDate ASC
        LIMIT 20
    `, [locals.user.id]);

    // Fetch events user has been invited to
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

    return {
        user: locals.user,
        calendars,
        recentEvents,
        invitations
    };
}
