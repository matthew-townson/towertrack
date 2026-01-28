import { redirect } from '@sveltejs/kit';
import { getLastBBImportStatus, importBBDataForAllUsers } from '$lib/server/scheduler.js';

export async function load({ locals }) {
    // Check if user is logged in and has admin permission (0)
    if (!locals.user || locals.user.permission !== 0) {
        throw redirect(303, '/');
    }
    
    const lastImportStatus = await getLastBBImportStatus();
    
    return {
        user: locals.user,
        lastImportStatus
    };
}

export const actions = {
    import: async ({ request }) => {
        try {
            // Run in background so we don't block
            importBBDataForAllUsers().catch(err => {
                console.error('BellBoard import error:', err);
            });
            return {
                success: true,
                message: 'BellBoard import started for all users.'
            };
        } catch (error) {
            return {
                success: false,
                message: `BellBoard import failed: ${error.message}`
            };
        }
    }
};
