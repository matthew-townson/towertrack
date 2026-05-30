import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { ensurePresetCalendars, PRESET_CALENDARS } from '$lib/server/calendar.js';

// GET - Fetch all calendars for user
export async function GET({ locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Ensure preset calendars exist
        await ensurePresetCalendars(db, locals.user.id);

        const [calendars] = await db.query(`
            SELECT id, name, colour, isPreset, presetType, createdAt
            FROM UserCalendar
            WHERE userId = ?
            ORDER BY isPreset DESC, name ASC
        `, [locals.user.id]);

        return json(calendars);
    } catch (err) {
        console.error('Error fetching calendars:', err);
        throw error(500, 'Failed to fetch calendars');
    }
}

// POST - Create a new calendar
export async function POST({ request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { name, colour } = await request.json();

        if (!name || name.trim().length === 0) {
            throw error(400, 'Calendar name is required');
        }

        if (name.trim().length > 100) {
            throw error(400, 'Calendar name must be 100 characters or less');
        }

        // Check if name conflicts with preset
        const presetNames = PRESET_CALENDARS.map(p => p.name.toLowerCase());
        if (presetNames.includes(name.trim().toLowerCase())) {
            throw error(400, 'Cannot create calendar with preset name');
        }

        const [result] = await db.query(`
            INSERT INTO UserCalendar (userId, name, colour, isPreset)
            VALUES (?, ?, ?, FALSE)
        `, [locals.user.id, name.trim(), colour || '#3788d8']);

        return json({
            id: result.insertId,
            name: name.trim(),
            colour: colour || '#3788d8',
            isPreset: false
        }, { status: 201 });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw error(400, 'A calendar with this name already exists');
        }
        console.error('Error creating calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to create calendar');
    }
}
