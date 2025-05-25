export function load({ locals, url }) {
  return {
    user: locals.user || null
  };
}
