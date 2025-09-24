import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const query = url.searchParams.get('query');
    
    if (!query || query.length < 2) {
        return json([]);
    }

    try {
        const parts = query.split(',').map(part => part.trim()).filter(Boolean);
        
        if (parts.length > 1) {
            const place = parts[0];
            const dedication = parts[1];
            
            // Allow St or S
            let dedicationQuery = dedication;
            if (dedication.toLowerCase().startsWith('st ')) {
                dedicationQuery = dedication.replace(/^st\s+/i, 'S ');
            } else if (dedication.toLowerCase().startsWith('s ')) {
                dedicationQuery = dedication.replace(/^s\s+/i, 'St ');
            }

            const [rows] = await db.query(
                `SELECT TowerID, RingID, Place, Dedicn, County, Country, Bells, UR, Wt, Note
                 FROM Tower
                 WHERE (Place LIKE ? OR Place LIKE ?)
                 AND (Dedicn LIKE ? OR Dedicn LIKE ? OR Dedicn LIKE ? OR Dedicn LIKE ?)
                 ORDER BY Place
                 `,
                [
                    `%${place}%`, 
                    `${place}%`,            // Prioritise starts-with matches
                    `%${dedication}%`,
                    `%${dedicationQuery}%`,
                    `${dedication}%`,       // Prioritise starts-with matches
                    `${dedicationQuery}%`   // Prioritise starts-with matches
                ]
            );
            
            return json(rows);
        } else {
            let stQuery = query;
            if (query.toLowerCase().startsWith('st ')) {
                stQuery = query.replace(/^st\s+/i, 'S ');
            } else if (query.toLowerCase().startsWith('s ')) {
                stQuery = query.replace(/^s\s+/i, 'St ');
            }

            const [rows] = await db.query(
                `SELECT TowerID, RingID, Place, Dedicn, County, Country, Bells, UR, Wt, Note
                 FROM Tower
                 WHERE Place LIKE ? OR Place LIKE ?
                 OR Dedicn LIKE ? OR Dedicn LIKE ?
                 OR Dedicn LIKE ? OR Dedicn LIKE ? 
                 OR County LIKE ?
                 ORDER BY 
                    CASE WHEN Place LIKE ? THEN 1
                         WHEN Dedicn LIKE ? THEN 2
                         WHEN Place LIKE ? THEN 3
                         WHEN Dedicn LIKE ? THEN 4
                         ELSE 5 END,
                    Place
                 `,
                [
                    `%${query}%`,
                    `${query}%`,        // Prioritise starts-with matches for Place
                    `%${query}%`, 
                    `%${stQuery}%`,
                    `${query}%`,        // Prioritise starts-with matches for Dedicn
                    `${stQuery}%`,      // Prioritise starts-with matches for Dedicn with st variation
                    `%${query}%`,
                    `${query}%`,        // For ordering - starts with for Place
                    `${query}%`,        // For ordering - starts with for Dedicn
                    `%${query}%`,       // For ordering - contains for Place
                    `%${stQuery}%`      // For ordering - contains for Dedicn with st variation
                ]
            );

            return json(rows);
        }
    } catch (error) {
        console.error('Error searching towers:', error);
        return json({ error: 'Failed to search towers' }, { status: 500 });
    }
}
