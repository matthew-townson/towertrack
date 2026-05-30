import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import crypto from 'crypto';

// GET - Fetch all shared calendars the user owns or is a member of
export async function GET({ locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const [calendars] = await db.query(`
            SELECT 
                sc.id,
                sc.name,
                sc.colour,
                sc.ownerId,
                sc.secretKey,
                sc.createdAt,
                o.username as ownerUsername,
                'owner' as role
            FROM SharedCalendar sc
            JOIN User o ON sc.ownerId = o.id
            WHERE sc.ownerId = ?
            
            UNION
            
            SELECT 
                sc.id,
                sc.name,
                sc.colour,
                sc.ownerId,
                NULL as secretKey,
                sc.createdAt,
                o.username as ownerUsername,
                scm.role
            FROM SharedCalendar sc
            JOIN SharedCalendarMember scm ON sc.id = scm.sharedCalendarId
            JOIN User o ON sc.ownerId = o.id
            WHERE scm.userId = ?
            
            ORDER BY name ASC
        `, [locals.user.id, locals.user.id]);

        return json(calendars);
    } catch (err) {
        console.error('Error fetching shared calendars:', err);
        throw error(500, 'Failed to fetch shared calendars');
    }
}

// POST - Create a new shared calendar
export async function POST({ request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const { name, colour } = await request.json();

        if (!name || name.trim().length === 0) {
            throw error(400, 'Calendar name is required');
        }

        if (name.trim().length > 100) {
            throw error(400, 'Calendar name must be 100 characters or less');
        }

        const secretKey = crypto.randomBytes(32).toString('hex');

        const [result] = await db.query(`
            INSERT INTO SharedCalendar (ownerId, name, colour, secretKey)
            VALUES (?, ?, ?, ?)
        `, [locals.user.id, name.trim(), colour || '#3788d8', secretKey]);

        return json({
            id: result.insertId,
            name: name.trim(),
            colour: colour || '#3788d8',
            ownerId: locals.user.id,
            ownerUsername: locals.user.username,
            secretKey,
            role: 'owner'
        }, { status: 201 });
    } catch (err) {
        console.error('Error creating shared calendar:', err);
        throw error(err.status || 500, err.body?.message || 'Failed to create shared calendar');
    }
}
