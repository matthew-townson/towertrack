import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
  if (!locals.user || locals.user.permission !== 0) {
    throw redirect(303, '/');
  }
  
  return {
    user: locals.user
  };
}
