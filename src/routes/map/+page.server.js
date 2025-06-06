import { redirect } from '@sveltejs/kit';
import db from '$lib/db.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    try {
        const [towers] = await db.execute('SELECT TowerID, Place, PlaceCL, County, Country, Lat, `Long`, Bells FROM Tower WHERE Lat IS NOT NULL AND `Long` IS NOT NULL ORDER BY Place');
        
        return {
            user: locals.user,
            towers: towers
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
