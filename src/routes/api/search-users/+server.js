import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
    const query = url.searchParams.get('q');
    
    if (!query || query.trim().length === 0) {
        return json([]);
    }

    try {
        const searchTerm = `%${query}%`;
        const [users] = await db.execute(`
            SELECT 
                id,
                username,
                profileImage,
                otherNames
            FROM User
            WHERE (username LIKE ? OR otherNames LIKE ?)
            AND permission >= 0
            ORDER BY username ASC
            LIMIT 20
        `, [searchTerm, searchTerm]);

        return json(users || []);
    } catch (err) {
        console.error('Error searching users:', err);
        throw error(500, 'Failed to search users');
    }
}
