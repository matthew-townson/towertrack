import { error, json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { getUserGrabData } from '$lib/server/userGrabs.js';
import { getTowersWithUserData } from '$lib/server/mapData.js';

async function findUser(username) {
    let [rows] = await db.execute(
        'SELECT id, username FROM User WHERE username = ? LIMIT 1',
        [username]
    );

    if ((!rows || rows.length === 0) && username.includes('-')) {
        [rows] = await db.execute(
            'SELECT id, username FROM User WHERE username = ? LIMIT 1',
            [username.replace(/-/g, ' ')]
        );
    }

    return rows?.[0];
}

export async function GET({ params, locals }) {
    const targetUser = await findUser(params.username);
    if (!targetUser) throw error(404, 'User not found');

    const [settingsRows] = await db.execute(
        'SELECT profileVisibility, dataVisibility FROM UserSettings WHERE userId = ? LIMIT 1',
        [targetUser.id]
    );
    const settings = settingsRows?.[0] || { profileVisibility: 1, dataVisibility: 1 };
    const isOwnProfile = locals.user?.id === targetUser.id;

    if ((!settings.profileVisibility || !settings.dataVisibility) && !isOwnProfile) {
        throw error(404, 'User grab data is not public');
    }

    try {
        return json({
            username: targetUser.username,
            mapTowers: await getTowersWithUserData(targetUser.id),
            ...(await getUserGrabData(targetUser.id, 'full'))
        });
    } catch (err) {
        console.error('Error fetching public user grabs:', err);
        throw error(500, 'Failed to fetch user grabs');
    }
}
