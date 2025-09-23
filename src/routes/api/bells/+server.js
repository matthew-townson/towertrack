import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const towerId = url.searchParams.get('towerId');
    const ringId = url.searchParams.get('ringId') || 1;
    
    if (!towerId) {
        return json({ error: 'Tower ID is required' }, { status: 400 });
    }

    try {
        const [rows] = await db.query(
            `SELECT BellID, BellRole, BellName, WeightLbs, Note 
             FROM Bell 
             WHERE TowerID = ? AND RingID = ?
             ORDER BY CASE 
                WHEN BellRole REGEXP '^[0-9]+$' THEN CAST(BellRole AS SIGNED)
                ELSE 99
             END ASC`,
            [towerId, ringId]
        );

        return json(rows);
    } catch (error) {
        console.error('Error fetching bells:', error);
        return json({ error: 'Failed to fetch bells' }, { status: 500 });
    }
}
