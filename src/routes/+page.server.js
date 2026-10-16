import db from '$lib/server/db.js';

export async function load({ locals }) {
  try {
    // Get total number of users
    const [userCountResult] = await db.query('SELECT COUNT(*) as count FROM User');

    // total grabs
    const [grabsCountResult] = await db.query('SELECT COUNT(*) as count FROM Grab');

    // total performances
    const [performancesCountResult] = await db.query('SELECT COUNT(*) as count FROM Performance');

    // total peals
    const [pealCountResult] = await db.query('SELECT COUNT(*) as count FROM Performance WHERE CAST(Changes AS SIGNED) >= 5000');

    // total quarter peals
    const [quarterPealCountResult] = await db.query('SELECT COUNT(*) as count FROM Performance WHERE CAST(Changes AS SIGNED) >= 1250 AND CAST(Changes AS SIGNED) < 2500');

    // total time spent ringing
    const [durationResult] = await db.query('SELECT Duration FROM Performance');
    const totalTimeSpent = durationResult.reduce((total, row) => {
      const duration = String(row.Duration || '').trim().toLowerCase();
      if (!duration) return total;

      const hours = Number(duration.match(/(\d+)\s*h/)?.[1] || 0);
      const minutesWithUnit = duration.match(/(\d+)\s*m/)?.[1];
      const seconds = Number(duration.match(/(\d+)\s*s/)?.[1] || 0);

      // Values such as "2h 36" omit the minutes suffix.
      const minutes = minutesWithUnit !== undefined
        ? Number(minutesWithUnit)
        : Number(duration.match(/h\s*(\d+)(?:\s|$)/)?.[1] || 0);

      // Ignore NULL and malformed values such as "43�".
      if (!hours && !minutes && !seconds) return total;
      return total + hours * 3600 + minutes * 60 + seconds;
    }, 0);

    const formatDuration = (totalSeconds) => {
      const units = [
        ['century', 100 * 365 * 24 * 60 * 60],
        ['decade', 10 * 365 * 24 * 60 * 60],
        ['year', 365 * 24 * 60 * 60],
        ['month', 30 * 24 * 60 * 60],
        ['week', 7 * 24 * 60 * 60],
        ['day', 24 * 60 * 60],
        ['hour', 60 * 60],
        ['minute', 60],
        ['second', 1]
      ];

      let remaining = totalSeconds;
      const parts = [];

      for (const [unit, secondsPerUnit] of units) {
        const value = Math.floor(remaining / secondsPerUnit);
        if (value > 0) {
          parts.push(`${value} ${unit}${value === 1 ? '' : 's'}`);
          remaining %= secondsPerUnit;
        }
      }

      return parts.join(', ') || '0 seconds';
    };

    // total changes rung by all users (sum number of changes in all performances)
    const [changesCountResult] = await db.query('SELECT SUM(CAST(Changes AS SIGNED)) as totalChanges FROM Performance');

    const grabCount = grabsCountResult[0]?.count || 0;
    const userCount = userCountResult[0]?.count || 0;
    const performanceCount = performancesCountResult[0]?.count || 0;
    const pealCount = pealCountResult[0]?.count || 0;
    const quarterPealCount = quarterPealCountResult[0]?.count || 0;
    const totalChanges = changesCountResult[0]?.totalChanges || 0;
    
    return {
      user: locals.user,
      userCount,
      grabCount,
      performanceCount,
      pealCount,
      quarterPealCount,
      totalTimeSpent: formatDuration(totalTimeSpent),
      totalChanges
    };
  } catch (error) {
    console.error('Failed to load user count:', error);
    return {
      user: locals.user,
      userCount: 0,
      grabCount: 0,
      performanceCount: 0,
      pealCount: 0,
      quarterPealCount: 0,
      totalTimeSpent: 0,
      totalChanges: 0
    };
  }
}