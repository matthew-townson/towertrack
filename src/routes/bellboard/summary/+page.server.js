import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { importBBData } from '$lib/server/bbImport.js';
import log from '$lib/server/log';

// helper: classify a performance by changes and bell_count
function classifyChanges(changes, bell_count) {
	if (changes >= 5000) return 'peal';
	if (changes >= 2500 && changes < 5000) return 'half-peal';
	if (changes >= 1250 && changes < 2500) return 'quarter'; // TODO: need to consider date touches and maybe eighth peals
	return 'performance';
}

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }

    const sql = `
    WITH matched_perfs AS (
      SELECT DISTINCT p.PerformanceID, p.Changes,
        COALESCE(JSON_LENGTH(p.Ringers, '$.ringers'), 0) AS bell_count
      FROM Performance p
      JOIN JSON_TABLE(
        p.Ringers,
        '$.ringers[*]' COLUMNS ( name VARCHAR(255) PATH '$.name' )
      ) AS jt
      LEFT JOIN \`User\` u ON LOWER(TRIM(u.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(jt.name)) COLLATE utf8mb4_unicode_ci
      LEFT JOIN OtherNames onm ON LOWER(TRIM(onm.Name)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(jt.name)) COLLATE utf8mb4_unicode_ci
      WHERE COALESCE(u.id, onm.userId) = ?
    )
    SELECT
      COALESCE(SUM(CASE WHEN Changes >= 5000 THEN 1 ELSE 0 END), 0) AS peal_count,
      COALESCE(SUM(CASE WHEN Changes >= 2500 AND Changes < 5000 THEN 1 ELSE 0 END), 0) AS half_peal_count,
      COALESCE(SUM(CASE WHEN Changes >= 1250 AND Changes < 2500 THEN 1 ELSE 0 END), 0) AS quarter_count,
      COUNT(*) AS performance_count
    FROM matched_perfs;
    `;

    const [rows] = await db.query(sql, [locals.user.id]);
    const stats = rows?.[0] || { peal_count: 0, half_peal_count: 0, quarter_count: 0, performance_count: 0 };

    // fetch the actual matched performances to print/classify
    const perfSql = `
    WITH matched_perfs AS (
      SELECT DISTINCT p.PerformanceID, p.Changes,
        COALESCE(JSON_LENGTH(p.Ringers, '$.ringers'), 0) AS bell_count,
        p.Date, p.Method, p.Place, p.Dedication, p.County, p.Ringers, p.Duration, p.Association, p.TenorWeightLbs, p.TenorKey, p.Footnotes
      FROM Performance p
      JOIN JSON_TABLE(
        p.Ringers,
        '$.ringers[*]' COLUMNS ( name VARCHAR(255) PATH '$.name' )
      ) AS jt
      LEFT JOIN \`User\` u ON LOWER(TRIM(u.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(jt.name)) COLLATE utf8mb4_unicode_ci
      LEFT JOIN OtherNames onm ON LOWER(TRIM(onm.Name)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(jt.name)) COLLATE utf8mb4_unicode_ci
      WHERE COALESCE(u.id, onm.userId) = ?
    )
    SELECT PerformanceID, Changes, bell_count, Date, Method, Place, Dedication, County, Ringers, Duration, Association, TenorWeightLbs, TenorKey, Footnotes
    FROM matched_perfs
    ORDER BY Date DESC, PerformanceID DESC;
    `;

    const [perfRows] = await db.query(perfSql, [locals.user.id]);
    const performances = (perfRows || []).map(r => {
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
            log.error(`Failed to parse ringers JSON for performance ${r.PerformanceID}:`, r.Ringers);
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

        return {
            PerformanceID: r.PerformanceID,
            Changes: r.Changes,
            bell_count: r.bell_count,
            Date: r.Date,
            Method: r.Method,
            Place: r.Place,
            Dedication: r.Dedication,
            County: r.County,
            Duration: r.Duration,
            Association: r.Association,
            TenorWeightLbs: r.TenorWeightLbs,
            TenorKey: r.TenorKey,
            ringers: ringers,
            footnotes: footnotes,
            classification: classifyChanges(Number(r.Changes || 0), Number(r.bell_count || 0))
        };
    });

    return {
        user: locals.user,
        stats: stats,
        performances
    };
}

export const actions = {
    importBBData: async ({ locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }
        try {
            await importBBData(locals.user.id);
            return { success: true, message: 'BellBoard performances updated.' };
        } catch (error) {
            return fail(500, { error: true, message: 'Failed to update performances: ' + error.message });
        }
    }
};

