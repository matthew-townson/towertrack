import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// PATCH - Mark notification as read
export async function PATCH({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const [result] = await db.query(`
            UPDATE Notification
            SET isRead = TRUE
            WHERE id = ? AND userId = ?
        `, [params.notificationId, locals.user.id]);

        if (result.affectedRows === 0) {
            throw error(404, 'Notification not found');
        }

        return json({ success: true });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to update notification');
    }
}

// DELETE - Delete a notification
export async function DELETE({ params, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const [result] = await db.query(`
            DELETE FROM Notification
            WHERE id = ? AND userId = ?
        `, [params.notificationId, locals.user.id]);

        if (result.affectedRows === 0) {
            throw error(404, 'Notification not found');
        }

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting notification:', err);
        throw error(500, 'Failed to delete notification');
    }
}
