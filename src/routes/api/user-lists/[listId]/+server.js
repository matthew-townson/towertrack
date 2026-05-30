import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// Get list details with members
export async function GET({ params, locals }) {
    const { listId } = params;

    try {
        // Verify list exists and get ownership info
        const [lists] = await db.execute(`
            SELECT ul.id, ul.userId, ul.name, ul.description, ul.createdAt, ul.updatedAt
            FROM UserList ul
            WHERE ul.id = ?
        `, [listId]);

        if (lists.length === 0) {
            throw error(404, 'List not found');
        }

        const list = lists[0];

        // Get all members with their info
        const [members] = await db.execute(`
            SELECT 
                u.id,
                u.username,
                u.profileImage,
                u.otherNames,
                lm.addedAt
            FROM ListMember lm
            JOIN User u ON lm.memberId = u.id
            WHERE lm.listId = ?
            ORDER BY u.username ASC
        `, [listId]);

        return json({
            ...list,
            members,
            isOwner: locals.user?.id === list.userId
        });
    } catch (err) {
        console.error('Error fetching list:', err);
        if (err.status) throw err;
        throw error(500, 'Failed to fetch list');
    }
}

// Update list
export async function PUT({ params, request, locals }) {
    const { listId } = params;
    const { name, description } = await request.json();

    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Verify ownership
        const [lists] = await db.execute(
            'SELECT userId FROM UserList WHERE id = ?',
            [listId]
        );

        if (lists.length === 0) {
            throw error(404, 'List not found');
        }

        if (lists[0].userId !== locals.user.id) {
            throw error(403, 'You can only edit your own lists');
        }

        // Update list
        await db.execute(
            'UPDATE UserList SET name = ?, description = ? WHERE id = ?',
            [name || lists[0].name, description, listId]
        );

        return json({ success: true });
    } catch (err) {
        console.error('Error updating list:', err);
        if (err.status) throw err;
        throw error(500, 'Failed to update list');
    }
}

// Delete list
export async function DELETE({ params, locals }) {
    const { listId } = params;

    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Verify ownership
        const [lists] = await db.execute(
            'SELECT userId FROM UserList WHERE id = ?',
            [listId]
        );

        if (lists.length === 0) {
            throw error(404, 'List not found');
        }

        if (lists[0].userId !== locals.user.id) {
            throw error(403, 'You can only delete your own lists');
        }

        // Delete list (members will cascade delete)
        await db.execute('DELETE FROM UserList WHERE id = ?', [listId]);

        return json({ success: true });
    } catch (err) {
        console.error('Error deleting list:', err);
        if (err.status) throw err;
        throw error(500, 'Failed to delete list');
    }
}
