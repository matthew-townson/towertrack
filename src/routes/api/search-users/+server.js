import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
    const query = url.searchParams.get('q');
    
    if (!query || query.trim().length === 0) {
        return json([]);
    }

    try {
        // Split query into individual words for more flexible matching
        const words = query.trim().split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 0) {
            return json([]);
        }

        // Build WHERE clause: ALL words must match in username or otherNames
        const whereClauses = words.map(() => '(username LIKE ? OR otherNames LIKE ?)');
        const whereSQL = whereClauses.join(' AND ');
        
        // Build parameters: each word repeated twice (for username and otherNames)
        const params = [];
        words.forEach(word => {
            params.push(`%${word}%`);
            params.push(`%${word}%`);
        });

        const [users] = await db.execute(`
            SELECT 
                id,
                username,
                profileImage,
                otherNames
            FROM User
            WHERE ${whereSQL}
            AND permission >= 0
            ORDER BY username ASC
            LIMIT 20
        `, params);

        return json(users || []);
    } catch (err) {
        console.error('Error searching users:', err);
        throw error(500, 'Failed to search users');
    }
}
