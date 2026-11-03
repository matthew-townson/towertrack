import { redirectToLogin } from '$lib/server/auth.js';

export async function load({ locals, fetch, url }) {
	if (!locals.user) {
		redirectToLogin(url);
	}

	let changelog = [];
	let error = null;

	try {
		const res = await fetch('https://towertracker.co.uk/changelog.json');
		if (!res.ok) {
			throw new Error(`Failed to fetch changelog: ${res.status}`);
		}
		changelog = await res.json();
	} catch (err) {
		console.warn('Could not load changelog:', err);
		error = 'Failed to load updates. Please try again later.';
	}

	return {
		user: locals.user,
		changelog,
		error
	};
}
