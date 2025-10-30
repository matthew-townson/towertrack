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

        let performanceCount, pealCount, quarterCount, halfPealCount, dateTouchCount, leadingQPRingers, leadingQPConductors, leadingPealRingers, leadingPealConductors;

        // get number of performances
        try {
            const [performanceResult] = await db.execute(`
                SELECT COUNT(DISTINCT PerformanceID) as count
                FROM Performance
                WHERE (${nameConditions})
                `, allNames);
            performanceCount = performanceResult[0].count;
        } catch (queryError) {
            log.error('Error executing performance count query:', queryError);
            throw queryError;
        }

        // get number of peals
        try {
            const [pealResult] = await db.execute(`
                SELECT COUNT(DISTINCT PerformanceID) as count
                FROM Performance
                WHERE (${nameConditions} AND Changes >= 5000)
            `, allNames);
            pealCount = pealResult[0].count;
        } catch (queryError) {
            log.error('Error executing peal count query:', queryError);
            throw queryError;
        }
        
        // get number of quarters
        try {
            const [quarterResult] = await db.execute(`
                SELECT COUNT(DISTINCT PerformanceID) as count
                FROM Performance
                WHERE (${nameConditions} AND Changes >= 1200 AND Changes < 2500)
            `, allNames);
            quarterCount = quarterResult[0].count;
        } catch (queryError) {
            log.error('Error executing quarter count query:', queryError);
            throw queryError;
        }

        // get number of half peals
        try {
            const [halfPealResult] = await db.execute(`
                SELECT COUNT(DISTINCT PerformanceID) as count
                FROM Performance
                WHERE (${nameConditions} AND Changes >= 2500 AND Changes < 5000)
            `, allNames);
            halfPealCount = halfPealResult[0].count;
        } catch (queryError) {
            log.error('Error executing half peal count query:', queryError);
            throw queryError;
        }

        // get number of date touches (changes equal to year when it was rung)
        try {
            const [dateTouchResult] = await db.execute(`
                SELECT COUNT(DISTINCT PerformanceID) as count
                FROM Performance
                WHERE (${nameConditions}) AND Changes = YEAR(Date)
            `, allNames);
            dateTouchCount = dateTouchResult[0].count;
        } catch (queryError) {
            log.error('Error executing date touch count query:', queryError);
            throw queryError;
        }

        // get leading ringers (QUARTER PEALS)
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
                WHERE (${nameConditions})
                    AND p.Changes >= 1200 AND p.Changes < 2500
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
                WHERE (${nameConditions})
                    AND p.Changes >= 1200 AND p.Changes < 2500
                    AND JSON_EXTRACT(ringer.value, '$.conductor') = 1
                    AND LOWER(TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1))) NOT IN (${allNames.map(() => 'LOWER(?)').join(', ')})
                GROUP BY ConductorName
                ORDER BY count DESC
                LIMIT 10
            `, [...allNames, ...allNames]);
            leadingQPConductors = leadingQPConductorResult;
        } catch (queryError) {
            log.error('Error executing leading quarter peal conductors query:', queryError);
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
                WHERE (${nameConditions})
                    AND p.Changes >= 5000
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
                WHERE (${nameConditions})
                    AND p.Changes >= 5000
                    AND JSON_EXTRACT(ringer.value, '$.conductor') = 1
                    AND LOWER(TRIM(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(ringer.value, '$.name')), '(', 1))) NOT IN (${allNames.map(() => 'LOWER(?)').join(', ')})
                GROUP BY ConductorName
                ORDER BY count DESC
                LIMIT 10
            `, [...allNames, ...allNames]);
            leadingPealConductors = leadingPealConductorResult;
        } catch (queryError) {
            log.error('Error executing leading peal conductors query:', queryError);
            throw queryError;
        }

        return { performanceCount, pealCount, quarterCount, halfPealCount, dateTouchCount, leadingQPRingers, leadingQPConductors, leadingPealRingers, leadingPealConductors };
    } catch (error) {
        log.error('Error getting user stats', error);
        return null;
    }
}