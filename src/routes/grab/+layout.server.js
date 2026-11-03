import { redirectToLogin } from '$lib/server/auth.js';

export function load({ locals, url }) {
  if (!locals.user) {
    redirectToLogin(url);
  }
  
  return {
    user: locals.user
  };
}
