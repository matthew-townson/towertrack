import { redirect } from '@sveltejs/kit';

export async function load({ locals, fetch }) {
	if (!locals.user) {
		throw redirect(303, '/account/login');
	}

	return {
		user: locals.user
	};
}
