import { redirect, error } from '@sveltejs/kit';

export function load({ locals }) {
  // Check if user is logged in
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  
  // Check if user has admin permission (0)
  if (locals.user.permission !== 0) {
    throw error(403, 'Access denied. Admin privileges required.');
  }
  
  return {
    user: locals.user
  };
}
