import { redirect } from '@sveltejs/kit';
import { getLastBBImportStatus, startManualBBImport } from '$lib/server/scheduler.js';

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
            const result = startManualBBImport();
            return {
                success: result.started,
                message: result.message
            };
        } catch (error) {
            return {
                success: false,
                message: `BellBoard import failed: ${error.message}`
            };
        }
    }
};
