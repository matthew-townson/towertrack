import { redirect } from '@sveltejs/kit';
import pool from '$lib/server/db.js';
import { getUserStats } from '$lib/server/userstats.js';
import log from '$lib/server/log.js';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/account/login');
	}

	try {
		const userId = locals.user.id;
		
		// Get basic user stats
		const userStats = await getUserStats(userId);
		
		// Get user's normalised names for performance matching
		let normalisedNames = [];
		const nameCandidates = [];
		
		const [userRows] = await pool.query(
			'SELECT username FROM User WHERE id = ?',
			[userId]
		);
		if (userRows[0]?.username) {
			nameCandidates.push(userRows[0].username);
		}
		
		const [aliasRows] = await pool.query(
			'SELECT Name FROM OtherNames WHERE userId = ?',
			[userId]
		);
		aliasRows.forEach(r => {
			if (r?.Name) nameCandidates.push(r.Name);
		});
		
		const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
		normalisedNames = Array.from(new Set(nameCandidates.map(norm).filter(Boolean)));
		
		// Get all performances where user participated
		const [allPerformances] = await pool.query(`
			SELECT p.*, t.Place, t.Dedicn, t.County, t.Bells, t.Wt
			FROM Performance p
			LEFT JOIN Tower t ON p.towerID = t.TowerID
			WHERE p.Ringers IS NOT NULL
		`);
		
		// Filter performances where user participated
		const userPerformances = allPerformances.filter(perf => {
			try {
				const raw = perf.Ringers;
				const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
				const ringersArr = Array.isArray(parsed?.ringers) ? parsed.ringers
					: Array.isArray(parsed) ? parsed
					: parsed && parsed.ringers ? parsed.ringers : [];
				
				return ringersArr.some(x => {
					if (!x || !x.name) return false;
					const rname = String(x.name).trim().toLowerCase().replace(/\s+/g, ' ');
					return normalisedNames.some(n => n && rname.includes(n));
				});
			} catch (err) {
				return false;
			}
		});
		
		// Helper to parse duration "Xh Ym" to minutes
		const parseDuration = (duration) => {
			if (!duration) return 0;
			const hourMatch = duration.match(/(\d+)h/);
			const minMatch = duration.match(/(\d+)m/);
			const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
			const mins = minMatch ? parseInt(minMatch[1]) : 0;
			return hours * 60 + mins;
		};
		
		// Helper to parse weight "X-Y-Z" (cwt-qtr-lb) to total pounds
		const parseWeight = (weight) => {
			if (!weight) return 0;
			const parts = String(weight).split('-');
			if (parts.length === 3) {
				const cwt = parseInt(parts[0]) || 0;
				const qtr = parseInt(parts[1]) || 0;
				const lb = parseInt(parts[2]) || 0;
				return cwt * 112 + qtr * 28 + lb;
			}
			return parseFloat(weight) || 0;
		};
		
		// Helper to convert pounds to cwt-qtr-lb format
		const poundsToHundredweight = (totalPounds) => {
			if (!totalPounds || totalPounds <= 0) return '0-0-0';
			const pounds = Math.round(totalPounds);
			const cwt = Math.floor(pounds / 112);
			const remaining = pounds % 112;
			const qtr = Math.floor(remaining / 28);
			const lb = remaining % 28;
			return `${cwt}-${qtr}-${lb}`;
		};
		
		// Categorize and analyze performances
		const quarterPeals = [];
		const peals = [];
		const other = [];
		
		userPerformances.forEach(perf => {
			const changes = Number(perf.Changes || perf.changes || 0);
			if (changes >= 1200 && changes < 5000) {
				quarterPeals.push(perf);
			} else if (changes >= 5000) {
				peals.push(perf);
			} else if (changes >= 720) {
				other.push(perf);
			}
		});
		
		// Calculate stats for each category
		const calculateCategoryStats = (performances) => {
			if (performances.length === 0) {
				return {
					count: 0,
					heaviestBell: null,
					lightestBell: null,
					longestDuration: null,
					shortestDuration: null,
					mostChanges: null
				};
			}
			
			let heaviest = null;
			let heaviestWeight = 0;
			
			let lightest = null;
			let lightestWeight = Infinity;
			
			let longest = null;
			let longestMins = 0;
			
			let shortest = null;
			let shortestMins = Infinity;
			
			let mostChanges = null;
			let maxChanges = 0;
			
			performances.forEach(perf => {
				// Check weight
				const weight = parseWeight(perf.Wt);
				if (weight > heaviestWeight) {
					heaviestWeight = weight;
					heaviest = perf;
				}
				if (weight > 0 && weight < lightestWeight) {
					lightestWeight = weight;
					lightest = perf;
				}
				
				// Check duration
				const duration = parseDuration(perf.Duration || perf.duration);
				if (duration > longestMins) {
					longestMins = duration;
					longest = perf;
				}
				if (duration > 0 && duration < shortestMins) {
					shortestMins = duration;
					shortest = perf;
				}
				
				// Check changes
				const changes = Number(perf.Changes || perf.changes || 0);
				if (changes > maxChanges) {
					maxChanges = changes;
					mostChanges = perf;
				}
			});
			
			return {
				count: performances.length,
				heaviestBell: heaviestWeight > 0 ? {
					performanceId: heaviest.PerformanceID,
					weight: poundsToHundredweight(heaviestWeight),
					weightPounds: heaviestWeight,
					place: heaviest.Place,
					dedicn: heaviest.Dedicn,
					county: heaviest.County,
					date: heaviest.Date || heaviest.date,
					title: heaviest.Method || heaviest.title
				} : null,
				lightestBell: lightestWeight < Infinity ? {
					performanceId: lightest.PerformanceID,
					weight: poundsToHundredweight(lightestWeight),
					weightPounds: lightestWeight,
					place: lightest.Place,
					dedicn: lightest.Dedicn,
					county: lightest.County,
					date: lightest.Date || lightest.date,
					title: lightest.Method || lightest.title
				} : null,
				longestDuration: longestMins > 0 ? {
					performanceId: longest.PerformanceID,
					duration: longest.Duration || longest.duration,
					durationMinutes: longestMins,
					place: longest.Place,
					dedicn: longest.Dedicn,
					county: longest.County,
					date: longest.Date || longest.date,
					title: longest.Method || longest.title,
					changes: longest.Changes || longest.changes
				} : null,
				shortestDuration: shortestMins < Infinity ? {
					performanceId: shortest.PerformanceID,
					duration: shortest.Duration || shortest.duration,
					durationMinutes: shortestMins,
					place: shortest.Place,
					dedicn: shortest.Dedicn,
					county: shortest.County,
					date: shortest.Date || shortest.date,
					title: shortest.Method || shortest.title,
					changes: shortest.Changes || shortest.changes
				} : null,
				mostChanges: maxChanges > 0 ? {
					performanceId: mostChanges.PerformanceID,
					changes: mostChanges.Changes || mostChanges.changes,
					place: mostChanges.Place,
					dedicn: mostChanges.Dedicn,
					county: mostChanges.County,
					date: mostChanges.Date || mostChanges.date,
					title: mostChanges.Method || mostChanges.title,
					duration: mostChanges.Duration || mostChanges.duration
				} : null
			};
		};
		
		const quarterPealStats = calculateCategoryStats(quarterPeals);
		const pealStats = calculateCategoryStats(peals);
		const otherStats = calculateCategoryStats(other);
		
		// Get grab statistics
		const [grabTowers] = await pool.query(`
			SELECT g.*, t.Place, t.Dedicn, t.County, t.Bells, t.Wt
			FROM Grab g
			LEFT JOIN Tower t ON g.towerID = t.TowerID
			WHERE g.userId = ?
		`, [userId]);
		
		const calculateGrabStats = (grabs) => {
			if (grabs.length === 0) {
				return {
					count: 0,
					heaviestBell: null,
					lightestBell: null
				};
			}
			
			let heaviest = null;
			let heaviestWeight = 0;
			
			let lightest = null;
			let lightestWeight = Infinity;
			
			grabs.forEach(grab => {
				const weight = parseWeight(grab.Wt);
				if (weight > heaviestWeight) {
					heaviestWeight = weight;
					heaviest = grab;
				}
				if (weight > 0 && weight < lightestWeight) {
					lightestWeight = weight;
					lightest = grab;
				}
			});
			
			return {
				count: grabs.length,
				heaviestBell: heaviestWeight > 0 ? {
					towerId: heaviest.towerID,
					weight: poundsToHundredweight(heaviestWeight),
					weightPounds: heaviestWeight,
					place: heaviest.Place,
					dedicn: heaviest.Dedicn,
					county: heaviest.County
				} : null,
				lightestBell: lightestWeight < Infinity ? {
					towerId: lightest.towerID,
					weight: poundsToHundredweight(lightestWeight),
					weightPounds: lightestWeight,
					place: lightest.Place,
					dedicn: lightest.Dedicn,
					county: lightest.County
				} : null
			};
		};
		
		const grabStats = calculateGrabStats(grabTowers);
		
		return {
			user: locals.user,
			stats: userStats,
			quarterPealStats,
			pealStats,
			otherStats,
			grabStats
		};
	} catch (err) {
		log.error(`Statistics load error: ${err.message}`);
		console.error('Statistics load error:', err);
		return {
			user: locals.user,
			error: 'Failed to load statistics'
		};
	}
}
