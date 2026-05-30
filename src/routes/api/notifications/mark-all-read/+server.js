import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// POST - Mark all notifications as read
export async function POST({ locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        await db.query(`
            UPDATE Notification
            SET isRead = TRUE
            WHERE userId = ? AND isRead = FALSE
        `, [locals.user.id]);

        return json({ success: true });
    } catch (err) {
        console.error('Error marking all notifications as read:', err);
        throw error(500, 'Failed to mark notifications as read');
    }
}
