import { error, json } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = 'static/uploads/profiles';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST({ request, locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorised');
    }

    try {
        const formData = await request.formData();
        const file = formData.get('image');

        if (!file || !(file instanceof File)) {
            throw error(400, 'No file provided');
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw error(400, 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw error(400, 'File is too large. Maximum size is 5MB.');
        }

        // Create upload directory if it doesn't exist
        await fs.mkdir(UPLOAD_DIR, { recursive: true });

        // Generate unique filename
        const ext = path.extname(file.name);
        const filename = `${locals.user.id}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // Read and write file
        const buffer = await file.arrayBuffer();
        await fs.writeFile(filepath, Buffer.from(buffer));

        // Get old profile image and delete it if exists
        const [rows] = await db.execute(
            'SELECT profileImage FROM User WHERE id = ?',
            [locals.user.id]
        );

        if (rows[0]?.profileImage) {
            try {
                await fs.unlink(path.join('static/uploads/profiles', rows[0].profileImage));
            } catch (err) {
                console.warn('Could not delete old profile image:', err.message);
            }
        }

        // Update database with new profile image filename
        await db.execute(
            'UPDATE User SET profileImage = ? WHERE id = ?',
            [filename, locals.user.id]
        );

        return json({
            success: true,
            filename,
            url: `/uploads/profiles/${filename}`
        });

    } catch (err) {
        console.error('Profile image upload error:', err);
        if (err.status) {
            throw err;
        }
        throw error(500, 'Failed to upload profile image');
    }
}

export async function DELETE({ locals }) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const [rows] = await db.execute(
            'SELECT profileImage FROM User WHERE id = ?',
            [locals.user.id]
        );

        if (rows[0]?.profileImage) {
            try {
                await fs.unlink(path.join(UPLOAD_DIR, rows[0].profileImage));
            } catch (err) {
                console.warn('Could not delete profile image file:', err.message);
            }

            await db.execute(
                'UPDATE User SET profileImage = NULL WHERE id = ?',
                [locals.user.id]
            );
        }

        return json({ success: true });

    } catch (err) {
        console.error('Profile image delete error:', err);
        if (err.status) {
            throw err;
        }
        throw error(500, 'Failed to delete profile image');
    }
}
