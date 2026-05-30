import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(302, '/login?redirect=/notifications');
    }

    const [notifications] = await db.query(`
        SELECT id, type, title, message, data, isRead, createdAt
        FROM Notification
        WHERE userId = ?
        ORDER BY createdAt DESC
        LIMIT 100
    `, [locals.user.id]);

    return {
        user: locals.user,
        notifications
    };
}
