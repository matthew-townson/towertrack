import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
    // Only allow admin users
    if (!locals.user || locals.user.permission !== 0) {
        throw redirect(303, '/');
    }

    return {
        user: locals.user
    };
}
