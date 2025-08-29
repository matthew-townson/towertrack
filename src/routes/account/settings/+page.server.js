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
    
    // Get user's aliases
    const [aliases] = await db.execute('SELECT id, Name FROM OtherNames WHERE userId = ?', [locals.user.id]);
    
    return {
        user: rows[0],
        aliases: aliases
    };
}

export const actions = {
    updateEmail: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }

        const data = await request.formData();
        const email = data.get('email');

        // Validate inputs
        if (!email) {
            return fail(400, { error: true, message: 'Email is required', action: 'updateEmail' });
        }

        // Check if email is valid
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250) {
            return fail(400, { error: true, message: 'Invalid email format', action: 'updateEmail' });
        }

        // Get current user email to check if there's actually a change
        const [currentUser] = await db.execute('SELECT email FROM User WHERE id = ?', [locals.user.id]);
        if (currentUser.length === 0) {
            return fail(400, { error: true, message: 'User not found', action: 'updateEmail' });
        }

        // Check if email is the same as current
        if (currentUser[0].email === email) {
            return fail(400, { error: true, message: 'New email is the same as current email', action: 'updateEmail' });
        }

        // Check if email already exists (excluding current user)
        const [existingEmail] = await db.execute('SELECT * FROM User WHERE email = ? AND id != ?', [email, locals.user.id]);
        if (existingEmail.length > 0) {
            return fail(400, { error: true, message: 'Email already in use', action: 'updateEmail' });
        }

        try {
            await db.execute('UPDATE User SET email = ? WHERE id = ?', [email, locals.user.id]);
            return { success: true, message: 'Email updated successfully', action: 'updateEmail' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Internal server error', action: 'updateEmail' });
        }
    },

    updateAlias: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }

        const data = await request.formData();
        const addAlias = data.get('addAlias');
        const removeAlias = data.get('removeAlias');

        if (addAlias) {
            const aliasName = addAlias.trim();
            if (!aliasName) {
                return fail(400, { error: true, message: 'Alias name cannot be empty', action: 'updateAlias' });
            }
            
            if (aliasName.length > 255) {
                return fail(400, { error: true, message: 'Alias name is too long', action: 'updateAlias' });
            }
            
            // Check if alias already exists for this user
            const [existingAlias] = await db.execute('SELECT id FROM OtherNames WHERE userId = ? AND Name = ?', [locals.user.id, aliasName]);
            if (existingAlias.length > 0) {
                return fail(400, { error: true, message: 'This alias already exists', action: 'updateAlias' });
            }
            
            try {
                await db.execute('INSERT INTO OtherNames (userId, Name) VALUES (?, ?)', [locals.user.id, aliasName]);
                return { success: true, message: 'Alias added successfully', action: 'updateAlias' };
            } catch (error) {
                console.error('Database error adding alias:', error);
                return fail(500, { error: true, message: 'Failed to add alias', action: 'updateAlias' });
            }
        }

        if (removeAlias) {
            try {
                const result = await db.execute('DELETE FROM OtherNames WHERE id = ? AND userId = ?', [removeAlias, locals.user.id]);
                if (result[0].affectedRows === 0) {
                    return fail(400, { error: true, message: 'Alias not found or already removed', action: 'updateAlias' });
                }
                return { success: true, message: 'Alias removed successfully', action: 'updateAlias' };
            } catch (error) {
                console.error('Database error removing alias:', error);
                return fail(500, { error: true, message: 'Failed to remove alias', action: 'updateAlias' });
            }
        }

        return fail(400, { error: true, message: 'No alias operation specified', action: 'updateAlias' });
    },

    changePassword: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(303, '/account/login');
        }

        const data = await request.formData();
        const currentPassword = data.get('currentPassword');
        const newPassword = data.get('newPassword');
        const confirmNewPassword = data.get('confirmNewPassword');

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return fail(400, { error: true, message: 'All password fields are required', action: 'changePassword' });
        }

        // Verify current password
        const [userRows] = await db.execute('SELECT password FROM User WHERE id = ?', [locals.user.id]);
        if (userRows.length === 0) {
            return fail(400, { error: true, message: 'User not found', action: 'changePassword' });
        }

        const isCurrentPasswordValid = await argon2.verify(userRows[0].password, currentPassword);
        if (!isCurrentPasswordValid) {
            return fail(400, { error: true, message: 'Current password is incorrect', action: 'changePassword' });
        }

        // Validate new password
        if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,250}$/.test(newPassword)) {
            return fail(400, { error: true, message: 'New password must be at least 8 characters long and contain at least one letter and one number', action: 'changePassword' });
        }

        // Check if passwords match
        if (newPassword !== confirmNewPassword) {
            return fail(400, { error: true, message: 'New passwords do not match', action: 'changePassword' });
        }

        // Check if new password is different from current
        const isSamePassword = await argon2.verify(userRows[0].password, newPassword);
        if (isSamePassword) {
            return fail(400, { error: true, message: 'New password must be different from current password', action: 'changePassword' });
        }

        try {
            const hashedPassword = await argon2.hash(newPassword);
            await db.execute('UPDATE User SET password = ? WHERE id = ?', [hashedPassword, locals.user.id]);
            return { success: true, message: 'Password changed successfully', action: 'changePassword' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Internal server error', action: 'changePassword' });
        }
    }
};
