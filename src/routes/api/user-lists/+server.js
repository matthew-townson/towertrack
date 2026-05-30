import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// Get all lists for a user
export async function GET({ url, locals }) {
    const userId = url.searchParams.get('userId');
    
    // If no userId specified, return current user's lists
    let targetUserId = userId;
    if (!targetUserId) {
        if (!locals.user) {
            throw error(401, 'Unauthorized');
        }
        targetUserId = locals.user.id;
    }

    try {
        const [lists] = await db.execute(`
            SELECT 
                ul.id,
                ul.name,
                ul.description,
                ul.createdAt,
                ul.updatedAt,
                COUNT(lm.id) as memberCount
            FROM UserList ul
            LEFT JOIN ListMember lm ON ul.id = lm.listId
            WHERE ul.userId = ?
            GROUP BY ul.id
            ORDER BY ul.name ASC
        `, [targetUserId]);

        return json(lists);
    } catch (err) {
        console.error('Error fetching user lists:', err);
        throw error(500, 'Failed to fetch lists');
    }
}

// Create a new list
export async function POST({ request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    const { name, description } = await request.json();

    if (!name || name.trim().length === 0) {
        throw error(400, 'List name is required');
    }

    if (name.length > 255) {
        throw error(400, 'List name must be 255 characters or less');
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO UserList (userId, name, description) VALUES (?, ?, ?)',
            [locals.user.id, name.trim(), description || null]
        );

        return json({
            success: true,
            id: result.insertId,
            name,
            description
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw error(400, 'A list with this name already exists');
        }
        console.error('Error creating list:', err);
        throw error(500, 'Failed to create list');
    }
}
