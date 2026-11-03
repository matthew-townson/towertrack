export const ICAL_TIMEZONE = 'Europe/London';

export function parseCalendarDate(value) {
    if (value instanceof Date) return new Date(value.getTime());

    const match = String(value || '').match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return new Date(value);

    return new Date(Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4] || 0),
        Number(match[5] || 0),
        Number(match[6] || 0)
    ));
}

export function formatICalDateTime(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

export function formatICalTimestamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
}

export function formatICalDateOnly(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

export function buildLocationProperties(event, escapeICalText) {
    let location = event.location || '';
    if (event.towerPlace || event.towerDedication) {
        location = [event.towerDedication, event.towerPlace].filter(Boolean).join(', ');
    }

    const properties = [];
    if (location) properties.push(`LOCATION:${escapeICalText(location)}`);

    const coordinates = event.towerLat != null && event.towerLong != null
        ? `${event.towerLat},${event.towerLong}`
        : event.coordinates;
    const coordinateMatch = String(coordinates || '').match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinateMatch) {
        const [, latitude, longitude] = coordinateMatch;
        properties.push(`GEO:${latitude};${longitude}`);
        properties.push(`URL:https://www.google.com/maps/dir/?api=1&destination=${latitude}%2C${longitude}`);
    }

    return properties;
}

export function getICalAvailability(event) {
    const isTentative = event.status === 'tentative';
    return `TRANSP:${isTentative ? 'TRANSPARENT' : 'OPAQUE'}
X-MICROSOFT-CDO-BUSYSTATUS:${isTentative ? 'FREE' : 'BUSY'}`;
}