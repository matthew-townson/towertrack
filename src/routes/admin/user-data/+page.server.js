import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import argon2 from 'argon2';
import log from '$lib/server/log.js';

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
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to change permissions with invalid data: userId=${userId}, permission=${permission}`);
            return fail(400, { error: true, message: 'Invalid user ID or permission level' });
        }

        if (userId === locals.user.id) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to change their own permissions`);
            return fail(400, { error: true, message: 'Cannot modify your own permissions' });
        }

        try {
            await db.execute('UPDATE User SET permission = ? WHERE id = ?', [permission, userId]);
            log.success(`Admin "${locals.user.username}" (ID: ${locals.user.id}) changed permission of user ID ${userId} to ${permission}`);
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
            log.success(`Admin "${locals.user.username}" (ID: ${locals.user.id}) updated privacy settings for user ID ${userId}`);
            return { success: true, message: 'Privacy settings updated successfully' };
        } catch (error) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) failed to update privacy settings for user ID ${userId}: ${error.message}`);
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
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update username with invalid data: userId=${userId}, username=${username}`);
            return fail(400, { error: true, message: 'Invalid user ID or username' });
        }

        if (!/^[a-zA-Z0-9\s-]{3,50}$/.test(username)) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update username with invalid data: userId=${userId}, username=${username}`);
            return fail(400, { error: true, message: 'Username must be 3-50 characters long and can only contain letters, numbers, spaces, and hyphens' });
        }

        try {
            // Check if username already exists (excluding current user)
            const [existingUser] = await db.execute('SELECT id FROM User WHERE username = ? AND id != ?', [username, userId]);
            if (existingUser.length > 0) {
                log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update username with invalid data: userId=${userId}, username=${username}`);
                return fail(400, { error: true, message: 'Username already exists' });
            }

            await db.execute('UPDATE User SET username = ? WHERE id = ?', [username, userId]);
            log.success(`Admin "${locals.user.username}" (ID: ${locals.user.id}) updated username for user ID ${userId} to "${username}"`);
            return { success: true, message: 'Username updated successfully' };
        } catch (error) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) failed to update username for user ID ${userId}: ${error.message}`);
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
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update email with invalid data: userId=${userId}, email=${email}`);
            return fail(400, { error: true, message: 'Invalid user ID or email' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update email with invalid data: userId=${userId}, email=${email}`);
            return fail(400, { error: true, message: 'Invalid email format' });
        }

        try {
            // Check if email already exists (excluding current user)
            const [existingEmail] = await db.execute('SELECT id FROM User WHERE email = ? AND id != ?', [email, userId]);
            if (existingEmail.length > 0) {
                log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update email with invalid data: userId=${userId}, email=${email}`);
                return fail(400, { error: true, message: 'Email already in use' });
            }

            await db.execute('UPDATE User SET email = ? WHERE id = ?', [email, userId]);
            log.success(`Admin "${locals.user.username}" (ID: ${locals.user.id}) updated email for user ID ${userId} to "${email}"`);
            return { success: true, message: 'Email updated successfully' };
        } catch (error) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) failed to update email for user ID ${userId}: ${error.message}`);
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
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update password with invalid data: userId=${userId}, password=${password}`);
            return fail(400, { error: true, message: 'Invalid user ID or password' });
        }

        if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,250}$/.test(password)) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to update password with invalid data: userId=${userId}, password=${password}`);
            return fail(400, { error: true, message: 'Password must be at least 8 characters long and contain at least one letter and one number' });
        }

        try {
            const hashedPassword = await argon2.hash(password);
            await db.execute('UPDATE User SET password = ? WHERE id = ?', [hashedPassword, userId]);
            log.success(`Admin "${locals.user.username}" (ID: ${locals.user.id}) updated password for user ID ${userId}`);
            return { success: true, message: 'Password updated successfully' };
        } catch (error) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) failed to update password for user ID ${userId}: ${error.message}`);
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
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to delete user with invalid data: userId=${userId}`);
            return fail(400, { error: true, message: 'Invalid user ID' });
        }
        
        // Prevent admin from deleting themselves
        if (userId === locals.user.id) {
            log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to delete their own account... Silly...`);
            return fail(400, { error: true, message: 'You cannot delete your own account' });
        }
        
        try {
            // Check if user exists
            const [existingUser] = await db.execute('SELECT id, username, email FROM User WHERE id = ?', [userId]);
            if (existingUser.length === 0) {
                log.error(`Admin "${locals.user.username}" (ID: ${locals.user.id}) attempted to delete a non-existent user: userId=${userId}`);
                return fail(404, { error: true, message: 'User not found' });
            }
            
            const targetUsername = existingUser[0].username;
            const targetEmail = existingUser[0].email;

            // Delete performances
            try {
                await db.execute(
                    'DELETE FROM Performance WHERE JSON_CONTAINS(ringers, ?, \'$.ringers\');',
                    [JSON.stringify({ name: targetUsername })]
                );
            } catch (error) {
                console.error(`Failed to delete performances for user ID ${userId}:`, error);
            }

            // Delete grabs
            try {
                await db.execute('DELETE FROM GrabBell WHERE userId = ?', [userId]);
            } catch (error) {
                console.error(`Failed to delete bellgrabs for user ID ${userId}:`, error);
            }

            try {
                await db.execute('DELETE FROM Grab WHERE userId = ?', [userId]);
            } catch (error) {
                console.error(`Failed to delete grabs for user ID ${userId}:`, error);
            }

            // Delete user settings
            try {
                await db.execute('DELETE FROM UserSettings WHERE userId = ?', [userId]);
            } catch (error) {
                console.error(`Failed to delete user settings for user ID ${userId}:`, error);
            }

            // Delete aliases
            try {
                await db.execute('DELETE FROM OtherNames WHERE userId = ?', [userId]);
            } catch (error) {
                console.error(`Failed to delete aliases for user ID ${userId}:`, error);
            }

            // Delete User
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
