import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/db.js';
import argon2 from 'argon2';

export async function load({ locals }) {
    if (!locals.user || locals.user.permission !== 0) {
        throw redirect(303, '/');
    }

    try {
        // Get all users with their privacy settings
        const [users] = await db.execute(`
            SELECT u.id, u.username, u.email, u.permission, 
                   us.profileVisibility, us.dataVisibility
            FROM User u
            LEFT JOIN UserSettings us ON u.id = us.userId
            ORDER BY u.id
        `);
        
        return {
            user: locals.user,
            users: users
        };
    } catch (error) {
        console.error('Database error:', error);
        return {
            user: locals.user,
            error: 'Failed to load users'
        };
    }
}

export const actions = {
    updatePermission: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            throw redirect(303, '/');
        }

        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const permission = parseInt(data.get('permission'));

        if (isNaN(userId) || isNaN(permission) || permission < 0 || permission > 4) {
            return fail(400, { error: true, message: 'Invalid user ID or permission level' });
        }

        if (userId === locals.user.id) {
            return fail(400, { error: true, message: 'Cannot modify your own permissions' });
        }

        try {
            await db.execute('UPDATE User SET permission = ? WHERE id = ?', [permission, userId]);
            return { success: true, message: 'User permission updated successfully' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Failed to update permission' });
        }
    },

    updatePrivacySettings: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            throw redirect(303, '/');
        }

        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const profileVisibility = data.get('profileVisibility') === '1';
        const dataVisibility = data.get('dataVisibility') === '1';

        if (isNaN(userId)) {
            return fail(400, { error: true, message: 'Invalid user ID' });
        }

        try {
            await db.execute(`
                INSERT INTO UserSettings (userId, profileVisibility, dataVisibility)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                profileVisibility = VALUES(profileVisibility),
                dataVisibility = VALUES(dataVisibility)
            `, [userId, profileVisibility, dataVisibility]);
            
            return { success: true, message: 'Privacy settings updated successfully' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Failed to update privacy settings' });
        }
    },

    updateUsername: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            throw redirect(303, '/');
        }

        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const username = data.get('username');

        if (isNaN(userId) || !username) {
            return fail(400, { error: true, message: 'Invalid user ID or username' });
        }

        if (!/^[a-zA-Z0-9\s-]{3,50}$/.test(username)) {
            return fail(400, { error: true, message: 'Username must be 3-50 characters long and can only contain letters, numbers, spaces, and hyphens' });
        }

        try {
            // Check if username already exists (excluding current user)
            const [existingUser] = await db.execute('SELECT id FROM User WHERE username = ? AND id != ?', [username, userId]);
            if (existingUser.length > 0) {
                return fail(400, { error: true, message: 'Username already exists' });
            }

            await db.execute('UPDATE User SET username = ? WHERE id = ?', [username, userId]);
            return { success: true, message: 'Username updated successfully' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Failed to update username' });
        }
    },

    updateEmail: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            throw redirect(303, '/');
        }

        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const email = data.get('email');

        if (isNaN(userId) || !email) {
            return fail(400, { error: true, message: 'Invalid user ID or email' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250) {
            return fail(400, { error: true, message: 'Invalid email format' });
        }

        try {
            // Check if email already exists (excluding current user)
            const [existingEmail] = await db.execute('SELECT id FROM User WHERE email = ? AND id != ?', [email, userId]);
            if (existingEmail.length > 0) {
                return fail(400, { error: true, message: 'Email already in use' });
            }

            await db.execute('UPDATE User SET email = ? WHERE id = ?', [email, userId]);
            return { success: true, message: 'Email updated successfully' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Failed to update email' });
        }
    },

    updatePassword: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            throw redirect(303, '/');
        }

        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const password = data.get('password');

        if (isNaN(userId) || !password) {
            return fail(400, { error: true, message: 'Invalid user ID or password' });
        }

        if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,250}$/.test(password)) {
            return fail(400, { error: true, message: 'Password must be at least 8 characters long and contain at least one letter and one number' });
        }

        try {
            const hashedPassword = await argon2.hash(password);
            await db.execute('UPDATE User SET password = ? WHERE id = ?', [hashedPassword, userId]);
            return { success: true, message: 'Password updated successfully' };
        } catch (error) {
            console.error('Database error:', error);
            return fail(500, { error: true, message: 'Failed to update password' });
        }
    },

    deleteUser: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            return fail(403, { error: true, message: 'Access denied' });
        }
        
        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        
        // Validate inputs
        if (!userId || isNaN(userId)) {
            return fail(400, { error: true, message: 'Invalid user ID' });
        }
        
        // Prevent admin from deleting themselves
        if (userId === locals.user.id) {
            return fail(400, { error: true, message: 'You cannot delete your own account' });
        }
        
        try {
            // Check if user exists
            const [existingUser] = await db.execute('SELECT id, username, email FROM User WHERE id = ?', [userId]);
            if (existingUser.length === 0) {
                return fail(404, { error: true, message: 'User not found' });
            }
            
            const targetUsername = existingUser[0].username;
            const targetEmail = existingUser[0].email;
            
            // Delete user
            await db.execute('DELETE FROM User WHERE id = ?', [userId]);
            
            // Log the deletion
            console.log(`[USER DELETION] Admin "${locals.user.username}" (ID: ${locals.user.id}) deleted user "${targetUsername}" (ID: ${userId}, Email: ${targetEmail})`);
            
            return {
                success: true,
                message: `Successfully deleted user "${targetUsername}"`
            };
        } catch (error) {
            console.error('Failed to delete user:', error);
            return fail(500, { error: true, message: 'Failed to delete user' });
        }
    }
};
