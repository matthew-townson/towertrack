import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// GET - Fetch calendar details
export async function GET({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const [calendars] = await db.query(`
            SELECT id, name, colour, isPreset, presetType
            FROM UserCalendar
            WHERE id = ? AND userId = ?
        `, [params.calendarId, locals.user.id]);

        if (calendars.length === 0) {
            throw error(404, 'Calendar not found');
        }

        return json(calendars[0]);
    } catch (err) {
        console.error('Error fetching calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to fetch calendar');
    }
}

// PUT - Update calendar
export async function PUT({ params, request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { name, colour } = await request.json();

        // Check calendar exists and belongs to user
        const [existing] = await db.query(`
            SELECT id, isPreset FROM UserCalendar
            WHERE id = ? AND userId = ?
        `, [params.calendarId, locals.user.id]);

        if (existing.length === 0) {
            throw error(404, 'Calendar not found');
        }

        // Can only update colour for preset calendars
        if (existing[0].isPreset && name) {
            throw error(400, 'Cannot rename preset calendars');
        }

        const updates = [];
        const values = [];

        if (name && !existing[0].isPreset) {
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (colour) {
            updates.push('colour = ?');
            values.push(colour);
        }

        if (updates.length > 0) {
            values.push(params.calendarId, locals.user.id);
            await db.query(`
                UPDATE UserCalendar
                SET ${updates.join(', ')}
                WHERE id = ? AND userId = ?
            `, values);
        }

        return json({ success: true });
    } catch (err) {
        console.error('Error updating calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update calendar');
    }
}

// DELETE - Delete calendar (only non-preset)
export async function DELETE({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Check calendar exists, belongs to user, and is not preset
        const [existing] = await db.query(`
            SELECT id, isPreset FROM UserCalendar
            WHERE id = ? AND userId = ?
        `, [params.calendarId, locals.user.id]);

        if (existing.length === 0) {
            throw error(404, 'Calendar not found');
        }

        if (existing[0].isPreset) {
            throw error(400, 'Cannot delete preset calendars');
        }

        // Delete calendar (events will cascade delete)
        await db.query(`
            DELETE FROM UserCalendar
            WHERE id = ? AND userId = ?
        `, [params.calendarId, locals.user.id]);

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to delete calendar');
    }
}
