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
      SELECT DISTINCT p.PerformanceID
      FROM Performance p
      LEFT JOIN (
        -- Use JSON_TABLE to extract names from JSON structure
        SELECT p2.PerformanceID, jt.name
        FROM Performance p2
        JOIN JSON_TABLE(
          p2.Ringers,
          '$.ringers[*]' COLUMNS ( name VARCHAR(255) PATH '$.name' )
        ) AS jt
      ) AS extracted ON p.PerformanceID = extracted.PerformanceID
      LEFT JOIN \`User\` u ON 
        LOWER(TRIM(u.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(extracted.name)) COLLATE utf8mb4_unicode_ci
        OR LOWER(TRIM(u.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(SUBSTRING_INDEX(extracted.name, ' (', 1))) COLLATE utf8mb4_unicode_ci
      LEFT JOIN OtherNames onm ON 
        LOWER(TRIM(onm.Name)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(extracted.name)) COLLATE utf8mb4_unicode_ci
        OR LOWER(TRIM(onm.Name)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(SUBSTRING_INDEX(extracted.name, ' (', 1))) COLLATE utf8mb4_unicode_ci
      WHERE COALESCE(u.id, onm.userId) = ?
      
      UNION
      
      -- Also include performances where name is found in the Ringers JSON as a substring (fallback)
      SELECT DISTINCT p.PerformanceID
      FROM Performance p
      JOIN \`User\` u ON LOWER(JSON_UNQUOTE(p.Ringers)) LIKE CONCAT('%', LOWER(TRIM(u.username)), '%')
      WHERE u.id = ?
      
      UNION
      
      SELECT DISTINCT p.PerformanceID
      FROM Performance p
      JOIN OtherNames onm ON LOWER(JSON_UNQUOTE(p.Ringers)) LIKE CONCAT('%', LOWER(TRIM(onm.Name)), '%')
      WHERE onm.userId = ?
    )
    SELECT
      (SELECT COUNT(*) FROM matched_perfs mp
       JOIN Performance p ON p.PerformanceID = mp.PerformanceID
       WHERE p.Changes >= 5000) AS peal_count,
       
      (SELECT COUNT(*) FROM matched_perfs mp
       JOIN Performance p ON p.PerformanceID = mp.PerformanceID
       WHERE p.Changes >= 2500 AND p.Changes < 5000) AS half_peal_count,
       
      (SELECT COUNT(*) FROM matched_perfs mp
       JOIN Performance p ON p.PerformanceID = mp.PerformanceID
       WHERE p.Changes >= 1250 AND p.Changes < 2500) AS quarter_count,
       
      (SELECT COUNT(*) FROM matched_perfs) AS performance_count
    `;

    const [rows] = await db.query(sql, [locals.user.id, locals.user.id, locals.user.id]);
    const stats = rows?.[0] || { peal_count: 0, half_peal_count: 0, quarter_count: 0, performance_count: 0 };

    // fetch the actual matched performances to print/classify
    const perfSql = `
    WITH matched_perfs AS (
      SELECT DISTINCT p.PerformanceID, p.Changes,
        COALESCE(JSON_LENGTH(p.Ringers, '$.ringers'), 0) AS bell_count,
        p.Date, p.Method, p.Place, p.Dedication, p.County, p.Ringers, p.Duration, p.Association, p.TenorWeightLbs, p.TenorKey, p.Footnotes
      FROM Performance p
      LEFT JOIN (
        -- Use JSON_TABLE to extract names from JSON structure
        SELECT p2.PerformanceID, jt.name
        FROM Performance p2
        JOIN JSON_TABLE(
          p2.Ringers,
          '$.ringers[*]' COLUMNS ( name VARCHAR(255) PATH '$.name' )
        ) AS jt
      ) AS extracted ON p.PerformanceID = extracted.PerformanceID
      LEFT JOIN \`User\` u ON 
        LOWER(TRIM(u.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(extracted.name)) COLLATE utf8mb4_unicode_ci
        OR LOWER(TRIM(extracted.name)) COLLATE utf8mb4_unicode_ci LIKE CONCAT(LOWER(TRIM(u.username)), ' (%') COLLATE utf8mb4_unicode_ci
      LEFT JOIN OtherNames onm ON 
        LOWER(TRIM(onm.Name)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(extracted.name)) COLLATE utf8mb4_unicode_ci
        OR LOWER(TRIM(extracted.name)) COLLATE utf8mb4_unicode_ci LIKE CONCAT(LOWER(TRIM(onm.Name)), ' (%') COLLATE utf8mb4_unicode_ci
      WHERE COALESCE(u.id, onm.userId) = ?
      
      UNION
      
      -- Also include performances where name is found in the Ringers JSON as a substring (fallback)
      SELECT DISTINCT p.PerformanceID, p.Changes,
        COALESCE(JSON_LENGTH(p.Ringers, '$.ringers'), 0) AS bell_count,
        p.Date, p.Method, p.Place, p.Dedication, p.County, p.Ringers, p.Duration, p.Association, p.TenorWeightLbs, p.TenorKey, p.Footnotes
      FROM Performance p
      JOIN \`User\` u ON LOWER(JSON_UNQUOTE(p.Ringers)) LIKE CONCAT('%', LOWER(TRIM(u.username)), '%')
      WHERE u.id = ?
      
      UNION
      
      SELECT DISTINCT p.PerformanceID, p.Changes,
        COALESCE(JSON_LENGTH(p.Ringers, '$.ringers'), 0) AS bell_count,
        p.Date, p.Method, p.Place, p.Dedication, p.County, p.Ringers, p.Duration, p.Association, p.TenorWeightLbs, p.TenorKey, p.Footnotes
      FROM Performance p
      JOIN OtherNames onm ON LOWER(JSON_UNQUOTE(p.Ringers)) LIKE CONCAT('%', LOWER(TRIM(onm.Name)), '%')
      WHERE onm.userId = ?
    )
    SELECT PerformanceID, Changes, bell_count, Date, Method, Place, Dedication, County, Ringers, Duration, Association, TenorWeightLbs, TenorKey, Footnotes
    FROM matched_perfs
    ORDER BY Date DESC, PerformanceID DESC;
    `;

    const [perfRows] = await db.query(perfSql, [locals.user.id, locals.user.id, locals.user.id]);
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
            importBBData(locals.user.id).catch(err => {
                try { console.error('Background importBBData failed:', err); } catch (e) {}
            });
            return { success: true, message: 'BellBoard performances updated.' };
        } catch (error) {
            return fail(500, { error: true, message: 'Failed to update performances: ' + error.message });
        }
    }
};

