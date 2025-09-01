import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    // Query database to get complete user info
    const [rows] = await db.execute('SELECT id, username, email, permission FROM User WHERE id = ?', [locals.user.id]);
    
    if (rows.length === 0) {
        throw redirect(303, '/account/login');
    }
    
    // Get user's aliases
    const [aliases] = await db.execute('SELECT id, Name FROM OtherNames WHERE userId = ?', [locals.user.id]);
    
    return {
        user: rows[0],
        aliases: aliases
    };
}
