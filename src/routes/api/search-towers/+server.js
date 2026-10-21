import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const query = url.searchParams.get('query') || url.searchParams.get('q');
    
    if (!query || query.length < 2) {
        return json([]);
    }

    try {
        const search = `%${query.trim()}%`;
        const [rows] = await db.query(
            `SELECT TowerID, RingID, Place, Place2, PlaceCL, Dedicn, County, Country,
                    Bells, UR, Wt, Note, Diocese, Affiliations
             FROM Tower
             WHERE Place LIKE ? OR Place2 LIKE ? OR PlaceCL LIKE ? OR Dedicn LIKE ?
                OR County LIKE ? OR Diocese LIKE ? OR Note LIKE ? OR Affiliations LIKE ?
             ORDER BY
                CASE WHEN Place LIKE ? THEN 1
                     WHEN Place2 LIKE ? OR PlaceCL LIKE ? THEN 2
                     WHEN Dedicn LIKE ? THEN 3
                     ELSE 4 END,
                Place`,
            [search, search, search, search, search, search, search, search,
                search, search, search, search]
        );
        return json(rows);
    } catch (error) {
        console.error('Error searching towers:', error);
        return json({ error: 'Failed to search towers' }, { status: 500 });
    }
}
