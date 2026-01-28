import { json } from '@sveltejs/kit';
import { importProgress } from '$lib/server/bbImport.js';

export function GET({ locals }) {
    if (!locals.user) {
        return json({ stage: 'unauthenticated', message: 'Not authenticated' }, { status: 401 });
    }
    const p = importProgress.get(locals.user.id) || { stage: 'idle', message: '', total: 0, processed: 0, percent: 0 };
    return json(p);
}
