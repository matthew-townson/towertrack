import db from '$lib/server/db.js';

export async function GET({ params }) {
    const { sharedKey } = params;

    try {
        // Find shared calendar by its own secret key
        const [calendars] = await db.query(`
            SELECT sc.id, sc.name, sc.colour, sc.ownerId, o.username as ownerUsername
            FROM SharedCalendar sc
            JOIN User o ON sc.ownerId = o.id
            WHERE sc.secretKey = ?
        `, [sharedKey]);

        if (calendars.length === 0) {
            return new Response('Invalid shared calendar link', { status: 404 });
        }

        const calendar = calendars[0];

        // Get all events for this shared calendar (excluding cancelled events)
        const [events] = await db.query(`
            SELECT 
                e.id,
                e.title,
                e.description,
                e.method,
                e.composition,
                e.location,
                e.coordinates,
                e.startDate,
                e.endDate,
                e.allDay,
                e.status,
                e.recurrenceType,
                e.recurrenceInterval,
                e.recurrenceEndDate,
                u.username as createdByUsername,
                t.Place as towerPlace,
                t.Dedicn as towerDedication
            FROM SharedCalendarEvent e
            JOIN User u ON e.createdBy = u.id
            LEFT JOIN Tower t ON e.towerID = t.TowerID
            WHERE e.sharedCalendarId = ? AND e.status != 'cancelled'
            ORDER BY e.startDate ASC
        `, [calendar.id]);

        console.log(`[ DEBUG ] Generated iCal for calendar "${calendar.name}" with ${events.length} events`);
        
        // Debug: log recurring events
        const recurringEvents = events.filter(e => e.recurrenceType && e.recurrenceType !== 'none');
        if (recurringEvents.length > 0) {
            console.log(`[ DEBUG ] Found ${recurringEvents.length} recurring events:`);
            recurringEvents.forEach(e => {
                console.log(`  - ${e.title}: ${e.recurrenceType} (interval: ${e.recurrenceInterval}, until: ${e.recurrenceEndDate})`);
            });
        }

        // Get invitations for all shared events
        const eventIds = events.map(e => e.id);
        let invitationsByEventId = {};
        if (eventIds.length > 0) {
            const [invitations] = await db.query(`
                SELECT
                    i.sharedEventId as eventId,
                    i.invitedUserId,
                    i.guestName,
                    i.status,
                    u.username,
                    u.email
                FROM SharedEventInvitation i
                LEFT JOIN User u ON i.invitedUserId = u.id
                WHERE i.sharedEventId IN (${eventIds.map(() => '?').join(',')})
            `, eventIds);

            invitations.forEach(inv => {
                if (!invitationsByEventId[inv.eventId]) invitationsByEventId[inv.eventId] = [];
                invitationsByEventId[inv.eventId].push(inv);
            });
        }

        // Generate iCal content
        const ical = generateICal(calendar, events, invitationsByEventId);

        return new Response(ical, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(calendar.name)}.ics"`
            }
        });
    } catch (err) {
        console.error('Error generating shared calendar iCal:', err);
        return new Response('Failed to generate calendar', { status: 500 });
    }
}

function generateICal(calendar, events, invitationsByEventId = {}) {
    const now = new Date();
    const timestamp = formatICalDate(now);

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TowerTrack//SharedCalendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICalText(calendar.name)} (Shared)
X-WR-TIMEZONE:UTC
X-PUBLISHED-TTL:PT5M
REFRESH-INTERVAL;VALUE=DURATION:PT5M
`;

    for (const event of events) {
        const uid = `shared-event-${event.id}@towertrack`;
        const startDate = new Date(event.startDate);
        
        // For recurring events, endDate should be the duration of a single event
        // For non-recurring events, use the specified endDate or default to 1 hour
        let endDate;
        if (event.recurrenceType && event.recurrenceType !== 'none' && event.endDate) {
            // For recurring events, calculate duration based on first instance
            const duration = new Date(event.endDate) - startDate;
            endDate = new Date(startDate.getTime() + duration);
        } else if (event.endDate) {
            endDate = new Date(event.endDate);
        } else {
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour
        }

        let location = event.location || '';
        if (event.towerPlace && event.towerDedication) {
            location = `${event.towerDedication}, ${event.towerPlace}`;
        }

        // Add coordinates to location if available (for GPS/navigation apps)
        if (event.coordinates) {
            location += ` (geo:${event.coordinates})`;
        }

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

        ical += `SUMMARY:${escapeICalText(event.title)}
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

        // Add recurrence rule
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
    }

    const rsvp = (partstat === 'NEEDS-ACTION') ? 'TRUE' : 'FALSE';

    if (invitation.guestName) {
        return `ATTENDEE;CN=${escapeICalText(invitation.guestName)};PARTSTAT=${partstat};ROLE=REQ-PARTICIPANT;RSVP=${rsvp}:mailto:guest@${invitation.guestName.toLowerCase().replace(/\\s+/g, '-')}.local`;
    } else if (invitation.email) {
        return `ATTENDEE;CN=${escapeICalText(invitation.username)};PARTSTAT=${partstat};ROLE=REQ-PARTICIPANT;RSVP=${rsvp}:mailto:${invitation.email}`;
    }

    return null;
}

function formatICalDate(date) {
    // Ensure we format as UTC datetime with Z suffix
    const iso = date.toISOString();
    return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
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
        case 'daily': freq = 'DAILY'; break;
        case 'weekly': freq = 'WEEKLY'; break;
        case 'monthly': freq = 'MONTHLY'; break;
        case 'monthly_nth': {
            freq = 'MONTHLY';
            const start = new Date(startDate);
            const dayOfWeek = start.getDay();
            const nth = Math.ceil(start.getDate() / 7);
            const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
            byDay = `;BYDAY=${nth}${weekdays[dayOfWeek]}`;
            break;
        }
        case 'yearly': freq = 'YEARLY'; break;
        default: return null;
    }

    let rrule = `RRULE:FREQ=${freq}`;

    if (recurrenceInterval && recurrenceInterval > 1) {
        rrule += `;INTERVAL=${recurrenceInterval}`;
    }

    if (byDay) rrule += byDay;

    if (recurrenceEndDate) {
        try {
            const endDate = new Date(recurrenceEndDate);
            // Make sure we're using a valid date
            if (!isNaN(endDate.getTime())) {
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
