import { json } from '@sveltejs/kit';
import { getBBImportProgress } from '$lib/server/scheduler.js';

export function GET({ locals }) {
    // Only allow admins to check import progress
    if (!locals.user || locals.user.permission !== 0) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return json(getBBImportProgress());
}
