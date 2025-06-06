import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
  if (!locals.user) {
    throw redirect(303, '/account/login');
  }
  
  return {
    user: locals.user
  };
}
