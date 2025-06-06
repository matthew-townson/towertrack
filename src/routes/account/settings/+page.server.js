import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/db.js';
import argon2 from 'argon2';

export async function load({ locals }) {
    if (!locals.user) {
        throw redirect(303, '/account/login');
    }
    
    // Query database to get complete user info including email
    const [rows] = await db.execute('SELECT id, username, email, permission FROM User WHERE id = ?', [locals.user.id]);
    
    if (rows.length === 0) {
        throw redirect(303, '/account/login');
    }
    
    return {
        user: rows[0]
    };
}

export const actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }

        const data = await request.formData();
        const username = data.get('username');
        const email = data.get('email');
        const currentPassword = data.get('currentPassword');
        const newPassword = data.get('newPassword');
        const confirmNewPassword = data.get('confirmNewPassword');

        // Validate inputs
        if (!username || !email) {
            return fail(400, { error: true, message: 'Username and email are required' });
        }

        // Check if username is valid
        if (!/^[a-zA-Z0-9\s-]{3,50}$/.test(username)) {
            return fail(400, { error: true, message: 'Username must be 3-50 characters long and can only contain letters, numbers, spaces, and hyphens' });
        }

        // Check if email is valid
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250) {
            return fail(400, { error: true, message: 'Invalid email format' });
        }

        // Check if username already exists (excluding current user)
        const [existingUser] = await db.execute('SELECT * FROM User WHERE username = ? AND id != ?', [username, locals.user.id]);
        if (existingUser.length > 0) {
            return fail(400, { error: true, message: 'Username already exists' });
        }

        // Check if email already exists (excluding current user)
        const [existingEmail] = await db.execute('SELECT * FROM User WHERE email = ? AND id != ?', [email, locals.user.id]);
        if (existingEmail.length > 0) {
            return fail(400, { error: true, message: 'Email already in use' });
        }

        let hashedPassword = null;
        
        // Handle password change if provided
        if (currentPassword || newPassword || confirmNewPassword) {
            if (!currentPassword || !newPassword || !confirmNewPassword) {
                return fail(400, { error: true, message: 'All password fields are required when changing password' });
            }

            // Verify current password
            const [userRows] = await db.execute('SELECT password FROM User WHERE id = ?', [locals.user.id]);
            if (userRows.length === 0) {
                return fail(400, { error: true, message: 'User not found' });
            }

            const isCurrentPasswordValid = await argon2.verify(userRows[0].password, currentPassword);
            if (!isCurrentPasswordValid) {
                return fail(400, { error: true, message: 'Current password is incorrect' });
            }

            // Validate new password
            if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,250}$/.test(newPassword)) {
                return fail(400, { error: true, message: 'New password must be at least 8 characters long and contain at least one letter and one number' });
            }

            // Check if passwords match
            if (newPassword !== confirmNewPassword) {
                return fail(400, { error: true, message: 'New passwords do not match' });
            }

            // Hash new password
            hashedPassword = await argon2.hash(newPassword);
        }

        // Update user data
        try {
            if (hashedPassword) {
                await db.execute('UPDATE User SET username = ?, email = ?, password = ? WHERE id = ?', [username, email, hashedPassword, locals.user.id]);
            } else {
                await db.execute('UPDATE User SET username = ?, email = ? WHERE id = ?', [username, email, locals.user.id]);
            }
            return { success: true, message: 'Settings updated successfully' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Internal server error' });
        }
    }
};
