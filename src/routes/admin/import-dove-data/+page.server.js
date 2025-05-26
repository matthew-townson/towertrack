import { redirect } from '@sveltejs/kit';
import { importDoveData } from '$lib/doveImport.js';

export function load({ locals }) {
	// Check if user is logged in and has admin permission (0)
	if (!locals.user || locals.user.permission !== 0) {
		throw redirect(303, '/');
	}
	
	return {
		user: locals.user,
	};
}

export const actions = {
	import: async ({ request }) => {
		try {
			return await importDoveData();
		} catch (error) {
			return {
				success: false,
				message: `Import failed: ${error.message}`
			};
		}
	}
};
