import db from '$lib/server/db.js';
import { redirectToLogin } from '$lib/server/auth.js';

export async function load({ locals, url }) {
    if (!locals.user) {
        redirectToLogin(url, '/login', 302);
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
