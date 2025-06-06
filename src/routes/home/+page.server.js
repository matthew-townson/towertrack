import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
  // Check if user is logged in and has admin permission (0)
  if (!locals.user) {
    console.error('User not logged in');
    throw redirect(303, '/');
  }
  
  return {
    user: locals.user
  };
}
