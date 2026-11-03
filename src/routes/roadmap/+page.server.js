import { redirectToLogin } from '$lib/server/auth.js';

export async function load({ locals, fetch, url }) {
	if (!locals.user) {
		redirectToLogin(url);
	}

	return {
		user: locals.user
	};
}
