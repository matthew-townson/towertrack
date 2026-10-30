import { error, redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';
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

export async function load({ locals, url }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }

    try {
        const requestedUsername = url.searchParams.get('u');
        let targetUser = locals.user;

        if (requestedUsername) {
            targetUser = await findUser(requestedUsername);
            if (!targetUser) {
                throw error(404, 'User not found');
            }

            const isOwnProfile = locals.user.id === targetUser.id;
            if (!isOwnProfile) {
                const [settingsRows] = await db.execute(
                    'SELECT profileVisibility, dataVisibility FROM UserSettings WHERE userId = ? LIMIT 1',
                    [targetUser.id]
                );
                const settings = settingsRows?.[0] || { profileVisibility: 1, dataVisibility: 1 };
                if (!settings.profileVisibility || !settings.dataVisibility) {
                    throw error(404, 'User map data is not public');
                }
            }
        }

        const towers = await getTowersWithUserData(targetUser.id);

        return {
            user: locals.user,
            towers,
            mapUser: targetUser
        };
    } catch (error) {
        if (error?.status) throw error;
        console.error('Failed to fetch tower data:', error);
        return {
            user: locals.user,
            towers: [],
            error: 'Failed to load tower data'
        };
    }
}