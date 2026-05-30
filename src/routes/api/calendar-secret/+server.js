import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import crypto from 'crypto';

// GET - Get user's calendar secret (or create if doesn't exist)
export async function GET({ locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        // Check if user has a secret key
        const [existing] = await db.query(`
            SELECT secretKey, createdAt, lastAccessed
            FROM CalendarSecret
            WHERE userId = ?
        `, [locals.user.id]);

        if (existing.length > 0) {
            return json({
                secretKey: existing[0].secretKey,
                createdAt: existing[0].createdAt,
                lastAccessed: existing[0].lastAccessed
            });
        }

        // Create new secret key
        const secretKey = crypto.randomBytes(32).toString('hex');
        
        await db.query(`
            INSERT INTO CalendarSecret (userId, secretKey)
            VALUES (?, ?)
        `, [locals.user.id, secretKey]);

        return json({
            secretKey,
            createdAt: new Date(),
            lastAccessed: null
        });
    } catch (err) {
        console.error('Error fetching calendar secret:', err);
        throw error(500, 'Failed to fetch calendar secret');
    }
}

// POST - Regenerate secret key
export async function POST({ locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const secretKey = crypto.randomBytes(32).toString('hex');

        await db.query(`
            INSERT INTO CalendarSecret (userId, secretKey)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE secretKey = ?, createdAt = CURRENT_TIMESTAMP, lastAccessed = NULL
        `, [locals.user.id, secretKey, secretKey]);

        return json({
            secretKey,
            createdAt: new Date(),
            lastAccessed: null
        });
    } catch (err) {
        console.error('Error regenerating calendar secret:', err);
        throw error(500, 'Failed to regenerate calendar secret');
    }
}
