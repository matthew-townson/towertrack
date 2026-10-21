import { error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ params, locals }) {
    let [rows] = await db.execute(
        'SELECT id, username FROM User WHERE username = ? LIMIT 1',
        [params.username]
    );

    if ((!rows || rows.length === 0) && params.username.includes('-')) {
        [rows] = await db.execute(
            'SELECT id, username FROM User WHERE username = ? LIMIT 1',
            [params.username.replace(/-/g, ' ')]
        );
    }

    if (!rows?.length) throw error(404, 'User not found');
    return {
        targetUser: rows[0],
        user: locals.user || null,
        isOwnProfile: locals.user?.id === rows[0].id
    };
}
