import { redirect } from '@sveltejs/kit';

export async function load({ locals, fetch }) {
	if (!locals.user) {
		throw redirect(303, '/account/login');
	}

	let changelog = [];
	let error = null;

	try {
		const res = await fetch('https://mtownson.com/dovedata/changelog.json');
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
