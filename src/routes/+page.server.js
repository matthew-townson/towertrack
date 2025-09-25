import db from '$lib/server/db.js';

export async function load({ locals }) {
  try {
    // Get total number of users
    const [userCountResult] = await db.query('SELECT COUNT(*) as count FROM User');

    // total grabs
    const [grabsCountResult] = await db.query('SELECT COUNT(*) as count FROM Grab');

    // total performances
    const [performancesCountResult] = await db.query('SELECT COUNT(*) as count FROM Performance');

    const grabCount = grabsCountResult[0]?.count || 0;
    const userCount = userCountResult[0]?.count || 0;
    const performanceCount = performancesCountResult[0]?.count || 0;
    
    return {
      user: locals.user,
      userCount,
      grabCount,
      performanceCount
    };
  } catch (error) {
    console.error('Failed to load user count:', error);
    return {
      user: locals.user,
      userCount: 0,
      grabCount: 0,
      performanceCount: 0
    };
  }
}