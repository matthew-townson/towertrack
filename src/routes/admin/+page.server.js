import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
  // Check if user is logged in and has admin permission (0)
  if (!locals.user || locals.user.permission !== 0) {
    throw redirect(303, '/');
  }
  
  return {
    user: locals.user
  };
}
