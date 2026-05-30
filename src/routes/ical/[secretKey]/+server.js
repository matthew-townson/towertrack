import db from '$lib/server/db.js';
import { ensurePresetCalendars } from '$lib/server/calendar.js';

export async function GET({ params }) {
    const { secretKey } = params;

    try {
        // Find user by secret key
        const [secrets] = await db.query(`
            SELECT userId FROM CalendarSecret WHERE secretKey = ?
        `, [secretKey]);

        if (secrets.length === 0) {
            return new Response('Invalid calendar link', { status: 404 });
        }

        const userId = secrets[0].userId;

        // Update last accessed timestamp
        await db.query(`
            UPDATE CalendarSecret SET lastAccessed = CURRENT_TIMESTAMP WHERE secretKey = ?
        `, [secretKey]);

        // Ensure preset calendars exist
        await ensurePresetCalendars(db, userId);

        // Get user info
        const [users] = await db.query(`
            SELECT username FROM User WHERE id = ?
        `, [userId]);

        if (users.length === 0) {
            return new Response('User not found', { status: 404 });
        }

        const username = users[0].username;

        // Get all calendars and events
        const [events] = await db.query(`
            SELECT 
                e.id,
                e.title,
                e.description,
                e.method,
                e.composition,
                e.location,
                e.startDate,
                e.endDate,
                e.allDay,
                e.recurrenceType,
                e.recurrenceInterval,
                e.recurrenceEndDate,
                c.name as calendarName,
                t.Place as towerPlace,
                t.Dedicn as towerDedication
            FROM CalendarEvent e
            JOIN UserCalendar c ON e.calendarId = c.id
            LEFT JOIN Tower t ON e.towerID = t.TowerID
            WHERE e.userId = ?
            ORDER BY e.startDate ASC
        `, [userId]);

        // Get invitations for all events
        const eventIds = events.map(e => e.id);
        let invitationsByEventId = {};
        
        if (eventIds.length > 0) {
            const [invitations] = await db.query(`
                SELECT 
                    i.eventId,
                    i.invitedUserId,
                    i.guestName,
                    i.status,
                    u.username,
                    u.email
                FROM EventInvitation i
                LEFT JOIN User u ON i.invitedUserId = u.id
                WHERE i.eventId IN (${eventIds.map(() => '?').join(',')})
            `, eventIds);
            
            // Group invitations by eventId
            invitations.forEach(inv => {
                if (!invitationsByEventId[inv.eventId]) {
                    invitationsByEventId[inv.eventId] = [];
                }
                invitationsByEventId[inv.eventId].push(inv);
            });
        }

        // Generate iCal content
        const ical = generateICal(username, events, invitationsByEventId);

        return new Response(ical, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="${username}-calendar.ics"`
            }
        });
    } catch (err) {
        console.error('Error generating iCal:', err);
        return new Response('Failed to generate calendar', { status: 500 });
    }
}

function generateICal(username, events, invitationsByEventId = {}) {
    const now = new Date();
    const timestamp = formatICalDate(now);

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TowerTrack//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICalText(username)}'s Bell Ringing Calendar
X-WR-TIMEZONE:UTC
X-PUBLISHED-TTL:PT5M
REFRESH-INTERVAL;VALUE=DURATION:PT5M
`;

    for (const event of events) {
        const uid = `event-${event.id}@towertrack`;
        const startDate = new Date(event.startDate);
        const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour

        let location = event.location || '';
        if (event.towerPlace && event.towerDedication) {
            location = `${event.towerDedication}, ${event.towerPlace}`;
        }

        // Prefix title with calendar name
        const title = event.calendarName 
            ? `[${event.calendarName}] ${event.title}`
            : event.title;

        ical += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${timestamp}
`;

        if (event.allDay) {
            ical += `DTSTART;VALUE=DATE:${formatICalDateOnly(startDate)}
DTEND;VALUE=DATE:${formatICalDateOnly(endDate)}
`;
        } else {
            ical += `DTSTART:${formatICalDate(startDate)}
DTEND:${formatICalDate(endDate)}
`;
        }

        ical += `SUMMARY:${escapeICalText(title)}
`;

        const fullDescription = formatEventDescription(event.description, event.method, event.composition);
        if (fullDescription) {
            ical += `DESCRIPTION:${escapeICalText(fullDescription)}
`;
        }

        if (location) {
            ical += `LOCATION:${escapeICalText(location)}
`;
        }

        // Add attendees (invited ringers)
        const invitations = invitationsByEventId[event.id] || [];
        for (const invitation of invitations) {
            const attendeeLine = buildAttendeeProperty(invitation);
            if (attendeeLine) {
                ical += attendeeLine + '\n';
            }
        }

        // Add recurrence rule if event is recurring
        if (event.recurrenceType && event.recurrenceType !== 'none') {
            const rrule = generateRRule(event);
            if (rrule) {
                ical += `${rrule}
`;
            }
        }

        ical += `END:VEVENT
`;
    }

    ical += `END:VCALENDAR`;

    return ical;
}

function formatICalDate(date) {
    // Format as UTC with Z suffix (required for RRULE UNTIL)
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
}

function formatICalDateOnly(date) {
    // Format as YYYYMMDD for all-day events (local date, not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function formatEventDescription(description, method, composition) {
    const parts = [];
    
    if (method) {
        parts.push(`Method: ${method}`);
    }
    
    if (composition) {
        parts.push(`Composition: ${composition}`);
    }
    
    if (description) {
        // If method or composition present, add a 'Notes:' label before the free-text description
        if (method || composition) {
            parts.push('Notes:');
        }
        parts.push(description);
    }
    
    return parts.join('\n');
}

function escapeICalText(text) {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

function generateRRule(event) {
    const { recurrenceType, recurrenceInterval, recurrenceEndDate, startDate } = event;
    
    if (!recurrenceType || recurrenceType === 'none') return null;
    
    let freq;
    let byDay = '';
    
    switch (recurrenceType) {
        case 'daily':
            freq = 'DAILY';
            break;
        case 'weekly':
            freq = 'WEEKLY';
            break;
        case 'monthly':
            freq = 'MONTHLY';
            break;
        case 'monthly_nth': {
            freq = 'MONTHLY';
            // Calculate the nth weekday
            const start = new Date(startDate);
            const dayOfWeek = start.getDay();
            const nth = Math.ceil(start.getDate() / 7);
            const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
            byDay = `;BYDAY=${nth}${weekdays[dayOfWeek]}`;
            break;
        }
        case 'yearly':
            freq = 'YEARLY';
            break;
        default:
            return null;
    }
    
    let rrule = `RRULE:FREQ=${freq}`;
    
    if (recurrenceInterval && recurrenceInterval > 1) {
        rrule += `;INTERVAL=${recurrenceInterval}`;
    }
    
    if (byDay) {
        rrule += byDay;
    }
    
    if (recurrenceEndDate) {
        try {
            const endDate = new Date(recurrenceEndDate);
            // Make sure we're using a valid date
            if (!isNaN(endDate.getTime())) {
                // Set to end of day in UTC
                endDate.setUTCHours(23, 59, 59, 0);
                rrule += `;UNTIL=${formatICalDate(endDate)}`;
            }
        } catch (e) {
            // Skip UNTIL if date parsing fails
            console.warn('Invalid recurrenceEndDate:', recurrenceEndDate);
        }
    }
    
    return rrule;
}

function buildAttendeeProperty(invitation) {
    // Map TowerTrack status to iCal PARTSTAT
    let partstat = 'NEEDS-ACTION'; // Default
    
    if (invitation.status === 'accepted') {
        partstat = 'ACCEPTED';
    } else if (invitation.status === 'declined') {
        partstat = 'DECLINED';
    } else if (invitation.status === 'maybe') {
        partstat = 'TENTATIVE';
    } else if (invitation.status === 'pending' || invitation.status === null) {
        partstat = 'NEEDS-ACTION';
    } else if (invitation.status === 'guest') {
        partstat = 'NEEDS-ACTION';
    }
    
    // Determine RSVP flag: if user hasn't responded, request RSVP
    const rsvp = (partstat === 'NEEDS-ACTION') ? 'TRUE' : 'FALSE';

    if (invitation.guestName) {
        // Guest attendee
        return `ATTENDEE;CN=${escapeICalText(invitation.guestName)};PARTSTAT=${partstat};ROLE=REQ-PARTICIPANT;RSVP=${rsvp}:mailto:guest@${invitation.guestName.toLowerCase().replace(/\\s+/g, '-')}.local`;
    } else if (invitation.email) {
        // Registered user attendee
        return `ATTENDEE;CN=${escapeICalText(invitation.username)};PARTSTAT=${partstat};ROLE=REQ-PARTICIPANT;RSVP=${rsvp}:mailto:${invitation.email}`;
    }
    
    return null;
}
