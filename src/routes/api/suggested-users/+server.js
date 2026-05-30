import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '8');

		// Get users who have performed the most (leading ringers)
		const [results] = await db.query(`
			SELECT 
				u.id,
				u.username,
				u.profileImage,
				COUNT(DISTINCT p.PerformanceID) as performanceCount
			FROM User u
			LEFT JOIN Performance p ON JSON_CONTAINS(p.Ringers, JSON_OBJECT('UserID', u.id))
			WHERE u.id != ?
			GROUP BY u.id
			HAVING performanceCount > 0
			ORDER BY performanceCount DESC
			LIMIT ?
		`, [locals.user?.id || 0, limit]);

		return json(results);
	} catch (error) {
		console.error('Error fetching suggested users:', error);
		return json({ error: 'Failed to fetch suggested users' }, { status: 500 });
	}
}
