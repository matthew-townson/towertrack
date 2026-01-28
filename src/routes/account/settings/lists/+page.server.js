import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    // Get user's lists with member count
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
    `, [locals.user.id]);

    return {
        lists: lists || []
    };
}
