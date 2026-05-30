import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// GET - Fetch notifications for user
export async function GET({ url, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

    try {
        let query = `
            SELECT id, type, title, message, data, isRead, createdAt
            FROM Notification
            WHERE userId = ?
        `;
        const params = [locals.user.id];

        if (unreadOnly) {
            query += ' AND isRead = FALSE';
        }

        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [notifications] = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM Notification WHERE userId = ?';
        const countParams = [locals.user.id];
        if (unreadOnly) {
            countQuery += ' AND isRead = FALSE';
        }
        const [[{ total }]] = await db.query(countQuery, countParams);

        // Get unread count
        const [[{ unreadCount }]] = await db.query(
            'SELECT COUNT(*) as unreadCount FROM Notification WHERE userId = ? AND isRead = FALSE',
            [locals.user.id]
        );

        return json({
            notifications,
            total,
            unreadCount
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        throw error(500, 'Failed to fetch notifications');
    }
}

// POST - Create a notification (internal use)
export async function POST({ request, locals }) {
    // This endpoint is for internal use - creating notifications
    // In production, you might want to restrict this or use a server-side function
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { userId, type, title, message, data } = await request.json();

        const [result] = await db.query(`
            INSERT INTO Notification (userId, type, title, message, data)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, type, title, message, JSON.stringify(data)]);

        return json({ id: result.insertId });
    } catch (err) {
        console.error('Error creating notification:', err);
        throw error(500, 'Failed to create notification');
    }
}
