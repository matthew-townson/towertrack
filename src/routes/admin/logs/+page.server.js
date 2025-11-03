import db from '$lib/server/db.js';
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
    // Only allow admin users
    if (!locals.user || locals.user.permission !== 0) {
        throw redirect(303, '/');
    }
    try {
        const [rows] = await db.execute('SELECT id, type, timestamp, text FROM Log ORDER BY id DESC');
        return { logs: rows };
    } catch (error) {
        return { logs: [], error: 'Failed to load logs' };
    }
}
