import { redirect } from '@sveltejs/kit';
import { importDoveData, getDoveImportProgress } from '$lib/server/doveImport.js';
import { getLastImportTime, getLastImportStatus, getSchedulerState, enableScheduler, disableScheduler } from '$lib/server/scheduler.js';

export async function load({ locals }) {
    // Check if user is logged in and has admin permission (0)
    if (!locals.user || locals.user.permission !== 0) {
        throw redirect(303, '/');
    }
    
    const [lastImportTime, lastImportStatus] = await Promise.all([
        getLastImportTime(),
        getLastImportStatus()
    ]);
    
    return {
        user: locals.user,
        lastImportTime,
        lastImportStatus,
        schedulerEnabled: getSchedulerState()
    };
}

export const actions = {
    import: async ({ request }) => {
        try {
            return await importDoveData();
        } catch (error) {
            return {
                success: false,
                message: `Import failed: ${error.message}`
            };
        }
    },
    
    enableScheduler: async ({ request }) => {
        try {
            enableScheduler();
            return {
                success: true,
                message: 'Daily import scheduler enabled'
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to enable scheduler: ${error.message}`
            };
        }
    },
    
    disableScheduler: async ({ request }) => {
        try {
            disableScheduler();
            return {
                success: true,
                message: 'Daily import scheduler disabled'
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to disable scheduler: ${error.message}`
            };
        }
    }
};
