import { redirect, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import log from '$lib/server/log';

export async function load({ locals, url }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }

    const performanceId = url.searchParams.get('id');
    if (!performanceId) {
        throw redirect(303, '/bellboard/summary');
    }

    // Fetch performance data
    const perfSql = `
        SELECT PerformanceID, Changes, Date, Method, Place, Dedication, County, 
               Ringers, Duration, Association, TenorWeightLbs, TenorKey, Footnotes, 
               TowerID, Timestamp
        FROM Performance 
        WHERE PerformanceID = ?
    `;

    const [perfRows] = await db.query(perfSql, [performanceId]);
    
    if (!perfRows || perfRows.length === 0) {
        throw error(404, 'Performance not found');
    }

    const r = perfRows[0];
    
    let ringers = [];
    let footnotes = [];

    try {
        if (r.Ringers) {
            if (typeof r.Ringers === 'string') {
                const parsed = JSON.parse(r.Ringers);
                ringers = parsed.ringers || [];
            } else if (typeof r.Ringers === 'object' && r.Ringers.ringers) {
                ringers = r.Ringers.ringers || [];
            } else if (Array.isArray(r.Ringers)) {
                ringers = r.Ringers;
            }
        }
    } catch (err) {
        log.error(`Failed to parse ringers JSON for performance ${r.PerformanceID}:`);
        ringers = [];
    }

    try {
        if (r.Footnotes) {
            if (typeof r.Footnotes === 'string') {
                const parsed = JSON.parse(r.Footnotes);
                footnotes = Array.isArray(parsed) ? parsed : [];
            } else if (Array.isArray(r.Footnotes)) {
                footnotes = r.Footnotes;
            }
        }
    } catch (err) {
        log.error(`Failed to parse footnotes JSON for performance ${r.PerformanceID}:`, r.Footnotes);
        footnotes = [];
    }

    const performance = {
        PerformanceID: r.PerformanceID,
        Changes: r.Changes,
        Date: r.Date,
        Method: r.Method,
        Place: r.Place,
        Dedication: r.Dedication,
        County: r.County,
        Duration: r.Duration,
        Association: r.Association,
        TenorWeightLbs: r.TenorWeightLbs,
        TenorKey: r.TenorKey,
        TowerID: r.TowerID,
        Timestamp: r.Timestamp,
        ringers: ringers,
        footnotes: footnotes
    };

    return {
        user: locals.user,
        performance
    };
}
