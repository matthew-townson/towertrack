import { redirect } from '@sveltejs/kit';
import { getTowersWithUserData } from '$lib/server/mapData.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    try {
        const towers = await getTowersWithUserData(locals.user.id);
        
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