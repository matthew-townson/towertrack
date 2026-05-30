import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

// Get all lists a user appears in
export async function GET({ url }) {
    const memberId = url.searchParams.get('memberId');
    
    if (!memberId) {
        throw error(400, 'Member ID is required');
    }

    try {
        const [lists] = await db.execute(`
            SELECT 
                ul.id,
                ul.userId,
                ul.name,
                ul.description,
                u.username,
                u.profileImage,
                COUNT(lm.id) as memberCount
            FROM ListMember lm
            JOIN UserList ul ON lm.listId = ul.id
            JOIN User u ON ul.userId = u.id
            WHERE lm.memberId = ?
            GROUP BY ul.id
            ORDER BY u.username ASC, ul.name ASC
        `, [memberId]);

        return json({ lists });
    } catch (err) {
        console.error('Error fetching user lists:', err);
        throw error(500, 'Failed to fetch lists');
    }
}
