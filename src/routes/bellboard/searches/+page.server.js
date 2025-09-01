import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import log from '$lib/server/log.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    // Query database to get complete user info
    const [rows] = await db.execute('SELECT id, username, email, permission FROM User WHERE id = ?', [locals.user.id]);
    if (rows.length === 0) {
        throw redirect(303, '/account/login');
    }
    // Get user's aliases
    const [aliases] = await db.execute('SELECT id, Name FROM OtherNames WHERE userId = ?', [locals.user.id]);
    // Get user's saved searches
    const [savedSearches] = await db.execute(
        'SELECT id, name, exShort, exEighth FROM SavedSearches WHERE userId = ? ORDER BY id DESC',
        [locals.user.id]
    );
    return {
        user: rows[0],
        aliases: aliases,
        savedSearches: savedSearches
    };
}

export const actions = {
    import: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }
        const data = await request.formData();
        const username = data.get('username');
        const exShort = data.getAll('exclude-length').includes('short_touches');
        const exEighth = data.getAll('exclude-length').includes('eighth-peals');
        // Prevent duplicate search names
        const [existing] = await db.execute(
            'SELECT id FROM SavedSearches WHERE userId = ? AND name = ?',
            [locals.user.id, username]
        );
        if (existing.length > 0) {
            log.error(`User ${locals.user.username} tried to add duplicate search "${username}"`);
            return fail(400, { error: true, message: 'A search with this name already exists.' });
        }
        // Save search to DB
        try {
            await db.execute(
                'INSERT INTO SavedSearches (userId, name, exShort, exEighth) VALUES (?, ?, ?, ?)',
                [locals.user.id, username, exShort, exEighth]
            );
            log.info(`User ${locals.user.username} added search "${username}" (exShort: ${exShort}, exEighth: ${exEighth})`);
            return { success: true, message: 'Search saved successfully' };
        } catch (error) {
            log.error(`User ${locals.user.username} failed to add search "${username}": ${error.message}`);
            return fail(500, { error: true, message: 'Failed to save search' });
        }
    },

    edit: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }
        const data = await request.formData();
        const searchId = parseInt(data.get('searchId'));
        const exShort = data.getAll('exclude-length').includes('short_touches');
        const exEighth = data.getAll('exclude-length').includes('eighth-peals');
        // Validate ownership
        const [existing] = await db.execute(
            'SELECT id FROM SavedSearches WHERE id = ? AND userId = ?',
            [searchId, locals.user.id]
        );
        if (existing.length === 0) {
            log.error(`User ${locals.user.username} tried to edit non-existent search ID ${searchId}`);
            return fail(400, { error: true, message: 'Search not found.' });
        }
        try {
            await db.execute(
                'UPDATE SavedSearches SET exShort = ?, exEighth = ? WHERE id = ?',
                [exShort, exEighth, searchId]
            );
            log.info(`User ${locals.user.username} edited search ID ${searchId} (exShort: ${exShort}, exEighth: ${exEighth})`);
            return { success: true, message: 'Search updated successfully' };
        } catch (error) {
            log.error(`User ${locals.user.username} failed to edit search ID ${searchId}: ${error.message}`);
            return fail(500, { error: true, message: 'Failed to update search' });
        }
    },

    delete: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }
        const data = await request.formData();
        const searchId = parseInt(data.get('searchId'));
        // Validate ownership
        const [existing] = await db.execute(
            'SELECT id FROM SavedSearches WHERE id = ? AND userId = ?',
            [searchId, locals.user.id]
        );
        if (existing.length === 0) {
            log.error(`User ${locals.user.username} tried to delete non-existent search ID ${searchId}`);
            return fail(400, { error: true, message: 'Search not found.' });
        }
        try {
            await db.execute('DELETE FROM SavedSearches WHERE id = ?', [searchId]);
            log.info(`User ${locals.user.username} deleted search ID ${searchId}`);
            return { success: true, message: 'Search deleted successfully' };
        } catch (error) {
            log.error(`User ${locals.user.username} failed to delete search ID ${searchId}: ${error.message}`);
            return fail(500, { error: true, message: 'Failed to delete search' });
        }
    }
};
