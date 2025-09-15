import db from '$lib/server/db.js';

export async function load({ locals }) {
  try {
    // Get total number of users
    const [userCountResult] = await db.query('SELECT COUNT(*) as count FROM User');
    const userCount = userCountResult[0]?.count || 0;
    
    return {
      user: locals.user,
      userCount
    };
  } catch (error) {
    console.error('Failed to load user count:', error);
    return {
      user: locals.user,
      userCount: 0
    };
  }
}