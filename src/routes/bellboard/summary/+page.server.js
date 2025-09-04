import { redirect, fail } from '@sveltejs/kit';
import { importBBData } from '$lib/server/bbImport.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    // ...existing code to load summary data...
    return {
        user: locals.user,
        // ...other summary data...
    };
}

export const actions = {
    importBBData: async ({ locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }
        try {
            await importBBData(locals.user.id);
            return { success: true, message: 'BellBoard performances updated.' };
        } catch (error) {
            return fail(500, { error: true, message: 'Failed to update performances: ' + error.message });
        }
    }
};
