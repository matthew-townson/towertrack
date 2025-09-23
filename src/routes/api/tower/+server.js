import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const towerId = url.searchParams.get('id');
    
    if (!towerId) {
        return json({ error: 'Tower ID is required' }, { status: 400 });
    }

    try {
        const [rows] = await db.query(
            `SELECT TowerID, RingID, Place, Dedicn, County, Country, Bells, UR, Wt, Note
             FROM Tower 
             WHERE TowerID = ?`,
            [towerId]
        );

        if (rows.length === 0) {
            return json({ error: 'Tower not found' }, { status: 404 });
        }

        return json(rows[0]);
    } catch (error) {
        console.error('Error fetching tower:', error);
        return json({ error: 'Failed to fetch tower' }, { status: 500 });
    }
}
