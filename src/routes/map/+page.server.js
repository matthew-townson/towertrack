import { redirect } from '@sveltejs/kit';
import { getTowersWithUserData } from '$lib/server/mapData.js';

// Allow an optional hidden URL parameter `asUser` to view data for another user id.
// This is intended for admin/debugging use only and is only honoured for users
// with admin permission (permission === 0). If present and allowed, the
// server will load tower data for the specified user id instead of the
// currently authenticated user.
export async function load({ locals, url }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }

    // Determine which user id to load data for. By default use the current user.
    let targetUserId = locals.user.id;

    try {
        const asUser = url.searchParams.get('asUser');
        if (asUser) {
            // Only allow if current user is an admin (permission 0)
            if (locals.user && Number(locals.user.permission) === 0) {
                const parsed = parseInt(asUser, 10);
                if (!Number.isNaN(parsed) && parsed > 0) {
                    targetUserId = parsed;
                } else {
                    console.warn(`Invalid asUser parameter ignored: ${asUser}`);
                }
            } else {
                console.warn(`Non-admin user attempted to use asUser param: ${locals.user?.username || 'unknown'}`);
            }
        }

        const towers = await getTowersWithUserData(targetUserId);

        return {
            user: locals.user,
            towers
        };
    } catch (error) {
        console.error('Failed to fetch tower data:', error);
        return {
            user: locals.user,
            towers: [],
            error: 'Failed to load tower data'
        };
    }
}