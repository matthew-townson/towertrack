import { redirect } from '@sveltejs/kit';
import { getWhatsAppLink } from '$lib/server/secretLinks.js';
import db from '$lib/server/db.js';

export async function load({ locals, fetch }) {
  // Check if user is logged in
  if (!locals.user) {
    console.error('User not logged in');
    throw redirect(303, '/');
  }

  // get whatsapp link
  const whatsappLink = getWhatsAppLink();
  
  try {
    const response = await fetch('/api/user-grabs?view=dashboard');
    if (!response.ok) throw new Error(`User grabs request failed: ${response.status}`);
    const { grabCount, recentGrabs } = await response.json();

    const [performanceRows] = await db.query(
      `SELECT p.PerformanceID, p.Changes, p.Date, p.Method, p.Place, p.Dedication,
              p.County, p.Ringers, p.Duration, p.Association, p.TenorWeightLbs,
              p.TenorKey, p.Footnotes
       FROM Performance p
       WHERE p.Ringers IS NOT NULL
       ORDER BY p.Date DESC, p.PerformanceID DESC
       LIMIT 10`,
      []
    );

    const recentPerformances = performanceRows.map((performance) => {
      let parsedRingers = [];
      let footnotes = [];
      try {
        const parsed = typeof performance.Ringers === 'string'
          ? JSON.parse(performance.Ringers)
          : performance.Ringers;
        parsedRingers = Array.isArray(parsed?.ringers) ? parsed.ringers : [];
      } catch {
        parsedRingers = [];
      }
      try {
        const parsed = typeof performance.Footnotes === 'string'
          ? JSON.parse(performance.Footnotes)
          : performance.Footnotes;
        footnotes = Array.isArray(parsed) ? parsed : [];
      } catch {
        footnotes = [];
      }
      return { ...performance, ringers: parsedRingers, footnotes };
    });
    
    return {
      user: locals.user,
      grabCount,
      recentGrabs,
      recentPerformances,
      whatsappLink
    };
  } catch (error) {
    console.error('Failed to load user data:', error);
    return {
      user: locals.user,
      grabCount: 0,
      recentGrabs: [],
      recentPerformances: []
    };
  }
}
