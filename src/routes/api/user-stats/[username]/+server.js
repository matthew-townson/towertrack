import { error, json } from '@sveltejs/kit';
import pool from '$lib/server/db.js';
import { getUserDashboardStats, getUserStats } from '$lib/server/userstats.js';

export async function GET({ params }) {
    const username = params.username;
    if (!username) throw error(400, 'Missing username');

    let [rows] = await pool.execute(
        'SELECT id, username FROM User WHERE username = ? LIMIT 1',
        [username]
    );
    if ((!rows || rows.length === 0) && username.includes('-')) {
        [rows] = await pool.execute(
            'SELECT id, username FROM User WHERE username = ? LIMIT 1',
            [username.replace(/-/g, ' ')]
        );
    }
    if (!rows?.length) throw error(404, 'User not found');

    const [settingsRows] = await pool.execute(
        'SELECT profileVisibility, dataVisibility FROM UserSettings WHERE userId = ? LIMIT 1',
        [rows[0].id]
    );
    const settings = settingsRows?.[0] || { profileVisibility: 1, dataVisibility: 1 };
    if (!settings.profileVisibility || !settings.dataVisibility) {
        throw error(404, 'User statistics are not public');
    }

    try {
        const [stats, dashboard] = await Promise.all([
            getUserStats(rows[0].id),
            getUserDashboardStats(rows[0].id)
        ]);
        return json({ stats, dashboard });
    } catch (err) {
        console.error('User dashboard API error:', err);
        throw error(500, 'Failed to load user statistics');
    }
}
