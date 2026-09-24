import { redirect } from '@sveltejs/kit';
import { getWhatsAppLink } from '$lib/server/secretLinks.js';

export async function load({ locals, fetch }) {
  // Check if user is logged in
  if (!locals.user) {
    console.error('User not logged in');
    throw redirect(303, '/');
  }

  // get whatsapp link
  const whatsappLink = getWhatsAppLink();
  
  try {
    const response = await fetch('/api/user-grabs?view=dashboard');
    if (!response.ok) throw new Error(`User grabs request failed: ${response.status}`);
    const { grabCount, recentGrabs } = await response.json();
    
    return {
      user: locals.user,
      grabCount,
      recentGrabs,
      whatsappLink
    };
  } catch (error) {
    console.error('Failed to load user data:', error);
    return {
      user: locals.user,
      grabCount: 0,
      recentGrabs: []
    };
  }
}
