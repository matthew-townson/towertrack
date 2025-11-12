import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ locals }) {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const [countiesRows] = await db.query(`SELECT DISTINCT County FROM Tower WHERE County IS NOT NULL AND County != '' ORDER BY County`);
        const [countriesRows] = await db.query(`SELECT DISTINCT Country FROM Tower WHERE Country IS NOT NULL AND Country != '' ORDER BY Country`);
        const [dioceseRows] = await db.query(`SELECT DISTINCT Diocese FROM Tower WHERE Diocese IS NOT NULL AND Diocese != '' ORDER BY Diocese`);
        const [wtRows] = await db.query(`SELECT MIN(Wt) AS minWt, MAX(Wt) AS maxWt FROM Tower WHERE Wt IS NOT NULL`);

        const counties = countiesRows.map(r => r.County).filter(Boolean);
        const countries = countriesRows.map(r => r.Country).filter(Boolean);
        const dioceses = dioceseRows.map(r => r.Diocese).filter(Boolean);
        const minWt = wtRows[0]?.minWt ?? null;
        const maxWt = wtRows[0]?.maxWt ?? null;

        return json({ counties, countries, dioceses, minWt, maxWt });
    } catch (err) {
        console.error('Failed to load map filters:', err);
        return json({ error: 'Failed to load filters' }, { status: 500 });
    }
}
