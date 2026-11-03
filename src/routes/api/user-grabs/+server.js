import { json, error } from '@sveltejs/kit';
import { getUserGrabData } from '$lib/server/userGrabs.js';

export async function GET({ url, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    const view = url.searchParams.get('view') || 'dashboard';
    if (!['dashboard', 'full', 'existing'].includes(view)) {
        throw error(400, 'Invalid view');
    }

    try {
        return json(await getUserGrabData(locals.user.id, view));
    } catch (err) {
        console.error('Error fetching user grabs:', err);
        throw error(500, 'Failed to fetch user grabs');
    }
}