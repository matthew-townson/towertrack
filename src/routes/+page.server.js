import db from '$lib/server/db.js';

export async function load({ locals }) {
  try {
    // Get total number of users
    const [userCountResult] = await db.query('SELECT COUNT(*) as count FROM User');

    // total grabs
    const [grabsCountResult] = await db.query('SELECT COUNT(*) as count FROM Grab');

    // total performances
    const [performancesCountResult] = await db.query('SELECT COUNT(*) as count FROM Performance');

    const [recentPerformanceRows] = await db.query(`
      SELECT PerformanceID, Changes, Date, Method, Place, Dedication, County,
             Ringers, Duration, Association, TenorWeightLbs, TenorKey, Footnotes
      FROM Performance
      WHERE Ringers IS NOT NULL
      ORDER BY Date DESC, PerformanceID DESC
      LIMIT 10
    `);
    const [userRows] = await db.query('SELECT id, username FROM User');
    const [aliasRows] = await db.query('SELECT userId, Name FROM OtherNames');
    const profileNames = new Map();
    const normaliseRingerName = (name) => String(name || '')
      .replace(/\s*\(.*?\)\s*$/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    userRows.forEach((user) => {
      profileNames.set(normaliseRingerName(user.username), user);
    });
    aliasRows.forEach((alias) => {
      const user = userRows.find((candidate) => candidate.id === alias.userId);
      if (user) profileNames.set(normaliseRingerName(alias.Name), user);
    });

    const recentPerformances = recentPerformanceRows.map((performance) => {
      let ringers = [];
      let footnotes = [];
      try {
        const parsed = typeof performance.Ringers === 'string'
          ? JSON.parse(performance.Ringers)
          : performance.Ringers;
        ringers = Array.isArray(parsed?.ringers) ? parsed.ringers : [];
      } catch {
        ringers = [];
      }
      try {
        const parsed = typeof performance.Footnotes === 'string'
          ? JSON.parse(performance.Footnotes)
          : performance.Footnotes;
        footnotes = Array.isArray(parsed) ? parsed : [];
      } catch {
        footnotes = [];
      }
      ringers = ringers.map((ringer) => {
        const profile = profileNames.get(normaliseRingerName(ringer.name));
        return profile
          ? { ...ringer, profile: { username: profile.username } }
          : ringer;
      });
      return { ...performance, ringers, footnotes };
    });

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
      totalChanges,
      recentPerformances
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
      totalChanges: 0,
      recentPerformances: []
    };
  }
}