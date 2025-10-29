import { error } from '@sveltejs/kit';
import pool from '$lib/server/db.js';

export async function load({ params }) {
	const { username } = params;
	if (!username) {
		throw error(400, 'Missing username');
	}

	try {
		// try an exact first
		let [userRows] = await pool.execute(
			'SELECT `id`, `username`, `email`, `permission`, `otherNames` FROM `User` WHERE `username` = ? LIMIT 1',
			[username]
		);

		// Ifallback, use hyphens
		if ((!userRows || userRows.length === 0) && username.includes('-')) {
			const alt = username.replace(/-/g, ' ');
			[userRows] = await pool.execute(
				'SELECT `id`, `username`, `email`, `permission`, `otherNames` FROM `User` WHERE `username` = ? LIMIT 1',
				[alt]
			);
		}

		if (!userRows || userRows.length === 0) {
			throw error(404, 'User not found');
		}

		const user = userRows[0];

		const [settingsRows] = await pool.execute(
			'SELECT `profileVisibility`, `dataVisibility`, `bellsPercent`, `exShort` FROM `UserSettings` WHERE `userId` = ? LIMIT 1',
			[user.id]
		);

		const settings = settingsRows && settingsRows.length ? settingsRows[0] : {
			profileVisibility: 1,
			dataVisibility: 1,
			bellsPercent: 100,
			exShort: 1
		};

		const isPublic = !!settings.profileVisibility;

		if (!isPublic) {
			// private: only expose username and a private flag
			return {
				profile: {
					username: user.username,
					isPrivate: true
				}
			};
		}

		// public: return sanitized user data and settings
		return {
			profile: {
				username: user.username,
				email: user.email,
				permission: user.permission,
				otherNames: user.otherNames || null,
				isPrivate: false
			},
			settings
		};
	} catch (err) {
		if (err?.status) throw err;
		console.error('Profile load error:', err);
		throw error(500, 'Failed to load profile');
	}
}