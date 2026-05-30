import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// Add member to list
export async function POST({ params, request, locals }) {
    const { listId, memberId } = params;

    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    if (!memberId) {
        throw error(400, 'Member ID is required');
    }

    try {
        // Verify list ownership
        const [lists] = await db.execute(
            'SELECT userId FROM UserList WHERE id = ?',
            [listId]
        );

        if (lists.length === 0) {
            throw error(404, 'List not found');
        }

        if (lists[0].userId !== locals.user.id) {
            throw error(403, 'You can only add members to your own lists');
        }

        // Verify member exists
        const [users] = await db.execute(
            'SELECT id FROM User WHERE id = ?',
            [memberId]
        );

        if (users.length === 0) {
            throw error(404, 'User not found');
        }

        // Add member to list
        const [result] = await db.execute(
            'INSERT INTO ListMember (listId, memberId) VALUES (?, ?)',
            [listId, memberId]
        );

        return json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw error(400, 'User is already in this list');
        }
        console.error('Error adding member:', err);
        if (err.status) throw err;
        throw error(500, 'Failed to add member to list');
    }
}

// Remove member from list
export async function DELETE({ params, locals }) {
    const { listId, memberId } = params;

    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Verify list ownership
        const [lists] = await db.execute(
            'SELECT userId FROM UserList WHERE id = ?',
            [listId]
        );

        if (lists.length === 0) {
            throw error(404, 'List not found');
        }

        if (lists[0].userId !== locals.user.id) {
            throw error(403, 'You can only remove members from your own lists');
        }

        // Remove member
        const [result] = await db.execute(
            'DELETE FROM ListMember WHERE listId = ? AND memberId = ?',
            [listId, memberId]
        );

        if (result.affectedRows === 0) {
            throw error(404, 'Member not found in list');
        }

        return json({ success: true });
    } catch (err) {
        console.error('Error removing member:', err);
        if (err.status) throw err;
        throw error(500, 'Failed to remove member from list');
    }
}
