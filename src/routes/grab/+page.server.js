import { redirect } from '@sveltejs/kit';

export async function load({ locals, fetch }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    try {
        const response = await fetch('/api/user-grabs?view=full');
        if (!response.ok) throw new Error(`User grabs request failed: ${response.status}`);
        const { grabCount, recentGrabs, grabs } = await response.json();
        
        return {
            user: locals.user,
            grabCount,
            recentGrabs,
            grabs
        };
    } catch (error) {
        console.error('Failed to load grab data:', error);
        return {
            user: locals.user,
            grabCount: 0,
            recentGrabs: [],
            grabs: []
        };
    }
}
