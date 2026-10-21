import db from '$lib/server/db.js';
import log from '$lib/server/log.js';

export async function getUserStats(userId) {
    // first get user's username and aliases
    try {
        const [userNames] = await db.execute(
            'SELECT username FROM User WHERE id = ?',
            [userId]
        );

        if (userNames.length === 0) {
            log.warn(`User with ID ${userId} not found.`);
            return null;
        }

        const username = userNames[0].username;

        const [aliases] = await db.execute(
            'SELECT Name FROM OtherNames WHERE userId = ?',
            [userId]
        );

        // add aliases into userNames
        const allNames = [username, ...aliases.map(a => a.Name)];

        // ! Get user stats !

        // get total number of performances logged
        const nameConditions = allNames.map(() => 
            `LOWER(Ringers) LIKE LOWER(CONCAT('%"name":%"', ?, '%"%'))`
        ).join(' OR ');

        let performanceCount, pealCount, quarterCount, halfPealCount, dateTouchCount, leadingQPRingers, leadingQPConductors, leadingQPLocations, leadingQPMethods, leadingPealRingers, leadingPealConductors, leadingPealMethods, leadingPealLocations, totalChanges;

        // get number of performances
        try {
            const [performanceResult] = await db.execute(`
                SELECT COUNT(*) as count FROM (
                    SELECT DISTINCT PerformanceID
                    FROM Performance
                    WHERE (${nameConditions})
                ) AS matched
                `, allNames);
            performanceCount = performanceResult[0].count;
        } catch (queryError) {
            log.error('Error executing performance count query:', queryError);
            throw queryError;
        }

        // get number of peals
        try {
            const [pealResult] = await db.execute(`
                SELECT COUNT(*) as count FROM (
                    SELECT DISTINCT PerformanceID
                    FROM Performance
                    WHERE (${nameConditions}) AND CAST(Changes AS SIGNED) >= 5000
                ) AS matched
            `, allNames);
            pealCount = pealResult[0].count;
        } catch (queryError) {
            log.error('Error executing peal count query:', queryError);
            throw queryError;
        }
        
        // get number of quarters
        try {
            const [quarterResult] = await db.execute(`
                SELECT COUNT(*) as count FROM (
                    SELECT DISTINCT PerformanceID
                    FROM Performance
                    WHERE (${nameConditions}) AND CAST(Changes AS SIGNED) >= 1250 AND CAST(Changes AS SIGNED) < 5000
                ) AS matched
            `, allNames);
            quarterCount = quarterResult[0].count;
        } catch (queryError) {
            log.error('Error executing quarter count query:', queryError);
            throw queryError;
        }

        // get number of half peals
        try {
            const [halfPealResult] = await db.execute(`
                SELECT COUNT(*) as count FROM (
                    SELECT DISTINCT PerformanceID
                    FROM Performance
                    WHERE (${nameConditions}) AND CAST(Changes AS SIGNED) >= 2500 AND CAST(Changes AS SIGNED) < 5000
                ) AS matched
            `, allNames);
            halfPealCount = halfPealResult[0].count;
        } catch (queryError) {
            log.error('Error executing half peal count query:', queryError);
            throw queryError;
        }

        // get number of date touches (changes equal to year when it was rung)
        try {
            const [dateTouchResult] = await db.execute(`
                SELECT COUNT(*) as count FROM (
                    SELECT DISTINCT PerformanceID
                    FROM Performance
                    WHERE (${nameConditions}) AND CAST(Changes AS SIGNED) = YEAR(Date)
                ) AS matched
            `, allNames);
            dateTouchCount = dateTouchResult[0].count;
        } catch (queryError) {
            log.error('Error executing date touch count query:', queryError);
            throw queryError;
        }

        // get leading ringers (QUARTER PEALS) - restrict to deduplicated PerformanceIDs
        try {
            const [leadingQPRingerResult] = await db.execute(`
                SELECT 
                    TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1)) as RingerName,
                    COUNT(*) as count
                FROM Performance p
                CROSS JOIN JSON_TABLE(
                    p.Ringers,
                    '$.ringers[*]' COLUMNS(
                        value JSON PATH '$'
                    )
                ) as ringer
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 1250 AND CAST(p.Changes AS SIGNED) < 5000
                    AND LOWER(TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1))) NOT IN (${allNames.map(() => 'LOWER(?)').join(', ')})
                GROUP BY RingerName
                ORDER BY count DESC
                LIMIT 10
            `, [...allNames, ...allNames]);
            leadingQPRingers = leadingQPRingerResult;
        } catch (queryError) {
            log.error('Error executing leading ringers query:', queryError);
            throw queryError;
        }

        // get leading conductors (QUARTER PEALS)
        try {
            const [leadingQPConductorResult] = await db.execute(`
                SELECT 
                    TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1)) as ConductorName,
                    COUNT(*) as count
                FROM Performance p
                CROSS JOIN JSON_TABLE(
                    p.Ringers,
                    '$.ringers[*]' COLUMNS(
                        value JSON PATH '$'
                    )
                ) as ringer
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 1250 AND CAST(p.Changes AS SIGNED) < 2500
                    AND JSON_EXTRACT(ringer.value, '$.conductor') = 1
                GROUP BY ConductorName
                ORDER BY count DESC
                LIMIT 10
                `, allNames);
            leadingQPConductors = leadingQPConductorResult;
        } catch (queryError) {
            log.error('Error executing leading quarter peal conductors query:', queryError);
            throw queryError;
        }

        // get leading locations (QUARTER PEALS)
        try {
            const [leadingQPLocationResult] = await db.execute(`
                SELECT 
                    CONCAT_WS(', ',
                        NULLIF(TRIM(p.Place), ''),
                        NULLIF(TRIM(p.Dedication), ''),
                        NULLIF(TRIM(p.County), '')
                    ) AS Location,
                    COUNT(*) AS count
                FROM Performance p
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 1250 AND CAST(p.Changes AS SIGNED) < 5000
                GROUP BY p.Place, p.Dedication, p.County
                ORDER BY count DESC
                LIMIT 10
            `, allNames);
            leadingQPLocations = leadingQPLocationResult;
        } catch (queryError) {
            log.error(`Error executing leading QP locations query: ${queryError.message}`, queryError);
            throw queryError;
        }

        // get leading methods (QUARTER PEALS)
        try {
            const [leadingQPMethodResult] = await db.execute(`
                SELECT 
                    p.Method,
                    COUNT(*) as count
                FROM Performance p
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 1250 AND CAST(p.Changes AS SIGNED) < 5000
                GROUP BY p.Method
                ORDER BY count DESC
                LIMIT 10
            `, allNames);
            leadingQPMethods = leadingQPMethodResult;
        } catch (queryError) {
            log.error('Error executing leading QP methods query:', queryError);
            throw queryError;
        }

        // get leading ringers (PEALS)
        try {
            const [leadingPealRingerResult] = await db.execute(`
                SELECT 
                    TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1)) as RingerName,
                    COUNT(*) as count
                FROM Performance p
                CROSS JOIN JSON_TABLE(
                    p.Ringers,
                    '$.ringers[*]' COLUMNS(
                        value JSON PATH '$'
                    )
                ) as ringer
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 5000
                    AND LOWER(TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1))) NOT IN (${allNames.map(() => 'LOWER(?)').join(', ')})
                GROUP BY RingerName
                ORDER BY count DESC
                LIMIT 10
            `, [...allNames, ...allNames]);
            leadingPealRingers = leadingPealRingerResult;
        } catch (queryError) {
            log.error('Error executing leading ringers query:', queryError);
            throw queryError;
        }

        // get leading conductors (PEALS)
        try {
            const [leadingPealConductorResult] = await db.execute(`
                SELECT 
                    TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1)) as ConductorName,
                    COUNT(*) as count
                FROM Performance p
                CROSS JOIN JSON_TABLE(
                    p.Ringers,
                    '$.ringers[*]' COLUMNS(
                        value JSON PATH '$'
                    )
                ) as ringer
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 5000
                    AND JSON_EXTRACT(ringer.value, '$.conductor') = 1
                GROUP BY ConductorName
                ORDER BY count DESC
                LIMIT 10
                `, allNames);
            leadingPealConductors = leadingPealConductorResult;
        } catch (queryError) {
            log.error('Error executing leading peal conductors query:', queryError);
            throw queryError;
        }

        // get leading locations (PEALS)
        try {
            const [leadingPealLocationResult] = await db.execute(`
                SELECT 
                    CONCAT_WS(', ',
                        NULLIF(TRIM(p.Place), ''),
                        NULLIF(TRIM(p.Dedication), ''),
                        NULLIF(TRIM(p.County), '')
                    ) AS Location,
                    COUNT(*) as count
                FROM Performance p
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 5000
                GROUP BY p.Place, p.Dedication, p.County
                ORDER BY count DESC
                LIMIT 10
            `, allNames);
            leadingPealLocations = leadingPealLocationResult;
        } catch (queryError) {
            log.error('Error executing leading peal locations query:', queryError);
            throw queryError;
        }

        // get leading methods (PEALS)
        try {
            const [leadingPealMethodResult] = await db.execute(`
                SELECT 
                    p.Method,
                    COUNT(*) as count
                FROM Performance p
                WHERE p.PerformanceID IN (
                    SELECT PerformanceID FROM (
                        SELECT DISTINCT PerformanceID FROM Performance WHERE (${nameConditions})
                    ) AS matched
                )
                    AND CAST(p.Changes AS SIGNED) >= 5000
                GROUP BY p.Method
                ORDER BY count DESC
                LIMIT 10
            `, allNames);
            leadingPealMethods = leadingPealMethodResult;
        } catch (queryError) {
            log.error('Error executing leading peal methods query:', queryError);
            throw queryError;
        }

        // get total number of changes rung in performances
        try {
            const [totalChangesResult] = await db.execute(`
                SELECT SUM(CAST(Changes AS SIGNED)) as totalChanges
                FROM Performance
                WHERE (${nameConditions})
            `, allNames);
            totalChanges = totalChangesResult[0].totalChanges || 0;
        } catch (queryError) {
            log.error('Error executing total changes query:', queryError);
            throw queryError;
        }

        return { performanceCount, pealCount, quarterCount, halfPealCount, dateTouchCount, leadingQPRingers, leadingQPConductors, leadingQPLocations, leadingQPMethods, leadingPealRingers, leadingPealConductors, leadingPealMethods, leadingPealLocations, totalChanges };
    } catch (error) {
        log.error('Error getting user stats', error);
        return null;
    }
}

export async function getUserDashboardStats(userId) {
    try {
        const [userRows] = await db.execute('SELECT username FROM User WHERE id = ?', [userId]);
        if (!userRows.length) return null;
        const [aliasRows] = await db.execute('SELECT Name FROM OtherNames WHERE userId = ?', [userId]);
        const names = [userRows[0].username, ...aliasRows.map((row) => row.Name)].filter(Boolean);
        const nameConditions = names.map(() => 'LOWER(p.Ringers) LIKE LOWER(CONCAT(\'%\', ?, \'%\'))').join(' OR ');
        const [performances] = await db.execute(`
            SELECT p.PerformanceID, p.Date, p.Changes, p.Duration, p.Place,
                p.Method, p.Ringers, p.towerID, p.ringID, p.TenorWeightLbs,
                t.Place AS TowerPlace, t.Dedicn, t.Wt
            FROM Performance p
            LEFT JOIN Tower t ON p.towerID = t.TowerID
            WHERE p.Ringers IS NOT NULL AND (${nameConditions})
        `, names);
        const [grabs] = await db.execute(
            `SELECT g.dateGrabbed, g.monthGrabbed, g.yearGrabbed, g.towerID, t.Place, t.Dedicn,
                    gb.bellID, gb.bellRole, b.WeightLbs
             FROM Grab g
             LEFT JOIN Tower t ON g.towerID = t.TowerID
             LEFT JOIN GrabBell gb ON gb.userID = g.userID AND gb.towerID = g.towerID AND gb.ringID = g.ringID
             LEFT JOIN Bell b ON b.BellID = gb.bellID
             WHERE g.userID = ?`,
            [userId]
        );

        const parseWeight = (weight) => {
            if (!weight) return 0;
            const parts = String(weight).split('-');
            if (parts.length === 3) {
                return (Number(parts[0]) || 0) * 112
                    + (Number(parts[1]) || 0) * 28
                    + (Number(parts[2]) || 0);
            }
            return Number(weight) || 0;
        };
        const poundsToHundredweight = (pounds) => {
            const rounded = Math.round(pounds);
            const cwt = Math.floor(rounded / 112);
            const remainder = rounded % 112;
            return `${cwt}-${Math.floor(remainder / 28)}-${remainder % 28}`;
        };
        const parseDuration = (duration) => {
            const value = String(duration || '').trim().toLowerCase();
            if (!value) return 0;

            if (/^\d+(?::\d{1,2}){1,2}$/.test(value)) {
                const parts = value.split(':').map(Number);
                if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
                return parts[0] * 60 + parts[1];
            }

            const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/)?.[1] || 0);
            const explicitMinutes = value.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
            const explicitSeconds = value.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/);
            const minutes = explicitMinutes
                ? Number(explicitMinutes[1])
                : explicitSeconds
                    ? 0
                    : Number(value.match(/(?:hours?|hrs?|h)\s+(\d{1,2})(?:\s|$)/)?.[1] || 0);
            const seconds = Number(explicitSeconds?.[1] || 0);
            return hours * 3600 + minutes * 60 + seconds;
        };
        const normaliseName = (name) => String(name || '')
            .replace(/\s*\(.*?\)\s*$/, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        const userNames = names.map(normaliseName);
        const parseRingers = (raw) => {
            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                return Array.isArray(parsed?.ringers) ? parsed.ringers : [];
            } catch {
                return [];
            }
        };
        const bellRowsByTower = new Map();
        const getBellRows = async (towerID, ringID) => {
            const key = `${towerID}:${ringID || 'null'}`;
            if (!bellRowsByTower.has(key)) {
                const [rows] = await db.execute(
                    'SELECT BellID, BellRole, WeightLbs FROM Bell WHERE TowerID = ? AND (RingID = ? OR (? IS NULL AND RingID IS NULL)) ORDER BY CAST(BellRole AS SIGNED)',
                    [towerID, ringID, ringID]
                );
                bellRowsByTower.set(key, rows);
            }
            return bellRowsByTower.get(key);
        };
        const performanceRecord = (performance, bell) => ({
            performanceId: performance.PerformanceID,
            place: performance.TowerPlace || performance.Place,
            dedication: performance.Dedicn,
            date: performance.Date,
            duration: performance.Duration,
            changes: Number(performance.Changes || 0),
            method: performance.Method,
            weightPounds: parseWeight(bell?.WeightLbs),
            weight: poundsToHundredweight(parseWeight(bell?.WeightLbs))
        });
        const resolvePerformanceBell = (towerBells, ringers, ringer, ringerIndex) => {
            const numericBellRows = towerBells.filter((bell) => /^\d+$/.test(String(bell.BellRole || '').trim()));
            const bellsForMapping = numericBellRows.length ? numericBellRows : towerBells;
            const startIndex = Math.max(0, bellsForMapping.length - ringers.length);
            const bellNumber = Number(ringer?.bell);

            if (Number.isFinite(bellNumber) && bellNumber > 0) {
                const targetIndex = startIndex + bellNumber - 1;
                if (numericBellRows.length && numericBellRows[targetIndex]) {
                    const physicalIndex = towerBells.indexOf(numericBellRows[targetIndex]);
                    return towerBells[physicalIndex] || null;
                }
                return bellsForMapping[targetIndex] || null;
            }

            return bellsForMapping[startIndex + ringerIndex] || null;
        };
        const heaviestPerformance = async (items) => {
            const records = [];
            for (const performance of items) {
                const ringers = parseRingers(performance.Ringers);
                const towerBells = await getBellRows(performance.towerID, performance.ringID);
                for (const [ringerIndex, ringer] of ringers.entries()) {
                    if (!userNames.includes(normaliseName(ringer?.name))) continue;
                    const bell = resolvePerformanceBell(towerBells, ringers, ringer, ringerIndex);
                    if (bell) records.push(performanceRecord(performance, bell));
                }
            }
            return records.filter((record) => record.weightPounds > 0)
                .sort((a, b) => b.weightPounds - a.weightPounds)[0] || null;
        };
        const fastestPerformance = (items) => items
            .map((performance) => {
                const durationSeconds = parseDuration(performance.Duration);
                return {
                    performanceId: performance.PerformanceID,
                    place: performance.TowerPlace || performance.Place,
                    dedication: performance.Dedicn,
                    date: performance.Date,
                    duration: performance.Duration,
                    durationSeconds,
                    changes: Number(performance.Changes || 0),
                    method: performance.Method
                };
            })
            .filter((item) => item.durationSeconds > 0)
            .sort((a, b) => a.durationSeconds - b.durationSeconds)[0] || null;
        const pealPerformances = performances.filter((performance) => Number(performance.Changes || 0) >= 5000);
        const quarterPerformances = performances.filter((performance) => {
            const changes = Number(performance.Changes || 0);
            return changes >= 1250 && changes < 2500;
        });
        const grabRecords = grabs
            .map((grab) => ({
                towerId: grab.towerID,
                place: grab.Place,
                dedication: grab.Dedicn,
                date: grab.yearGrabbed
                    ? `${grab.yearGrabbed}-${String(grab.monthGrabbed || 1).padStart(2, '0')}-${String(grab.dateGrabbed || 1).padStart(2, '0')}`
                    : null,
                bellRole: grab.bellRole,
                weightPounds: parseWeight(grab.WeightLbs),
                weight: poundsToHundredweight(parseWeight(grab.WeightLbs))
            }))
            .filter((grab) => grab.weightPounds > 0)
            .sort((a, b) => b.weightPounds - a.weightPounds);
        const pealHeaviest = await heaviestPerformance(pealPerformances);
        const quarterHeaviest = await heaviestPerformance(quarterPerformances);
        const byMonth = new Map();
        const byYear = new Map();
        let totalChanges = 0;
        let totalDurationSeconds = 0;
        let longestPerformance = null;
        let mostChanges = null;

        for (const performance of performances) {
            const date = new Date(performance.Date);
            const changes = Number(performance.Changes || 0);
            const durationMinutes = parseDuration(performance.Duration);
            totalChanges += changes;
            totalDurationSeconds += durationMinutes;
            if (!mostChanges || changes > Number(mostChanges.Changes || 0)) mostChanges = performance;
            if (durationMinutes > 0 && (!longestPerformance || durationMinutes > parseDuration(longestPerformance.Duration))) {
                longestPerformance = performance;
            }
            if (Number.isNaN(date.getTime())) continue;

            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const year = String(date.getFullYear());
            byMonth.set(month, {
                period: month,
                label: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
                performances: (byMonth.get(month)?.performances || 0) + 1,
                changes: (byMonth.get(month)?.changes || 0) + changes
            });
            byYear.set(year, {
                period: year,
                label: year,
                performances: (byYear.get(year)?.performances || 0) + 1,
                changes: (byYear.get(year)?.changes || 0) + changes
            });
        }

        const grabsByMonth = new Map();
        const grabsByYear = new Map();
        for (const grab of grabs) {
            const year = Number(grab.yearGrabbed);
            if (!year) continue;
            const key = String(year);
            grabsByYear.set(key, {
                period: key,
                label: key,
                grabs: (grabsByYear.get(key)?.grabs || 0) + 1
            });
            if (grab.monthGrabbed) {
                const monthKey = `${year}-${String(grab.monthGrabbed).padStart(2, '0')}`;
                const monthDate = new Date(year, Number(grab.monthGrabbed) - 1, 1);
                grabsByMonth.set(monthKey, {
                    period: monthKey,
                    label: monthDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
                    grabs: (grabsByMonth.get(monthKey)?.grabs || 0) + 1
                });
            }
        }

        const countInRange = (min, max = Infinity) => performances.filter((performance) => {
            const changes = Number(performance.Changes || 0);
            return changes >= min && changes <= max;
        }).length;
        const currentYear = new Date().getFullYear();
        const uniqueGrabKeys = new Set(grabs.map((grab) => `${grab.towerID}:${grab.ringID || ''}`));
        const uniqueTowers = new Set(grabs.map((grab) => grab.towerID));
        const uniqueBells = new Set(grabs.filter((grab) => grab.bellID).map((grab) => grab.bellID));
        const performancesThisYear = performances.filter((performance) => {
            const date = new Date(performance.Date);
            return !Number.isNaN(date.getTime()) && date.getFullYear() === currentYear;
        }).length;

        return {
            summary: {
                performanceCount: performances.length,
                pealCount: countInRange(5000),
                halfPealCount: countInRange(2500, 4999),
                quarterCount: countInRange(1250, 2499),
                totalChanges,
                totalDurationSeconds,
                performancesThisYear,
                grabCount: uniqueGrabKeys.size,
                uniqueTowerCount: uniqueTowers.size,
                individualBellCount: grabs.filter((grab) => grab.bellID).length,
                uniqueBellCount: uniqueBells.size,
                grabsThisYear: new Set(grabs
                    .filter((grab) => Number(grab.yearGrabbed) === currentYear)
                    .map((grab) => `${grab.towerID}:${grab.ringID || ''}`)).size
            },
            performanceByMonth: Array.from(byMonth.values())
                .sort((a, b) => a.period.localeCompare(b.period)),
            performanceByYear: Array.from(byYear.values()).sort((a, b) => a.period.localeCompare(b.period)),
            grabsByMonth: Array.from(grabsByMonth.values()).sort((a, b) => a.period.localeCompare(b.period)),
            grabsByYear: Array.from(grabsByYear.values()).sort((a, b) => a.period.localeCompare(b.period)),
            records: {
                grabs: {
                    heaviestBell: grabRecords[0] || null
                },
                peals: {
                    heaviestBell: pealHeaviest,
                    fastestPerformance: fastestPerformance(pealPerformances)
                },
                quarterPeals: {
                    heaviestBell: quarterHeaviest,
                    fastestPerformance: fastestPerformance(quarterPerformances)
                }
            }
        };
    } catch (error) {
        log.error('Error getting user dashboard stats', error);
        throw error;
    }
}