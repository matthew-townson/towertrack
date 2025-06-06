import { redirect, fail } from '@sveltejs/kit';
import db from '$lib/db.js';
import argon2 from 'argon2';

export async function load({ locals }) {
    if (!locals.user || locals.user.permission !== 0) {
        throw redirect(303, '/');
    }
    
    try {
        const [users] = await db.execute('SELECT id, username, email, permission FROM User ORDER BY username');
        
        return {
            user: locals.user,
            users: users
        };
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        return {
            user: locals.user,
            users: [],
            error: 'Failed to load user data'
        };
    }
}

export const actions = {
    updatePermission: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            return fail(403, { error: true, message: 'Access denied' });
        }
        
        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const permission = parseInt(data.get('permission'));
        
        // Validate inputs
        if (!userId || isNaN(userId)) {
            return fail(400, { error: true, message: 'Invalid user ID' });
        }
        
        if (![0, 1, 2, 3, 4].includes(permission)) {
            return fail(400, { error: true, message: 'Invalid permission level' });
        }
        
        // Prevent admin from changing their own permission
        if (userId === locals.user.id) {
            return fail(400, { error: true, message: 'You cannot change your own permission level' });
        }
        
        try {
            // Check if user exists and get current permission
            const [existingUser] = await db.execute('SELECT id, username, permission FROM User WHERE id = ?', [userId]);
            if (existingUser.length === 0) {
                return fail(404, { error: true, message: 'User not found' });
            }
            
            const oldPermission = existingUser[0].permission;
            const targetUsername = existingUser[0].username;
            
            // Update permission
            await db.execute('UPDATE User SET permission = ? WHERE id = ?', [permission, userId]);
            
            // Log the change
            console.log(`[PERMISSION CHANGE] Admin "${locals.user.username}" (ID: ${locals.user.id}) changed user "${targetUsername}" (ID: ${userId}) permission from ${oldPermission} to ${permission}`);
            
            return {
                success: true,
                message: `Successfully updated ${targetUsername}'s permission level from ${oldPermission} to ${permission}`
            };
        } catch (error) {
            console.error('Failed to update user permission:', error);
            return fail(500, { error: true, message: 'Failed to update user permission' });
        }
    },
    
    updateUsername: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            return fail(403, { error: true, message: 'Access denied' });
        }
        
        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const username = data.get('username');
        
        // Validate inputs
        if (!userId || isNaN(userId)) {
            return fail(400, { error: true, message: 'Invalid user ID' });
        }
        
        if (!username || typeof username !== 'string') {
            return fail(400, { error: true, message: 'Username is required' });
        }
        
        // Check if username is valid
        if (!/^[a-zA-Z0-9\s-]{3,50}$/.test(username)) {
            return fail(400, { error: true, message: 'Username must be 3-50 characters long and can only contain letters, numbers, spaces, and hyphens' });
        }
        
        try {
            // Check if user exists
            const [existingUser] = await db.execute('SELECT id, username FROM User WHERE id = ?', [userId]);
            if (existingUser.length === 0) {
                return fail(404, { error: true, message: 'User not found' });
            }
            
            const oldUsername = existingUser[0].username;
            
            // Check if username already exists (excluding current user)
            const [duplicateUser] = await db.execute('SELECT * FROM User WHERE username = ? AND id != ?', [username, userId]);
            if (duplicateUser.length > 0) {
                return fail(400, { error: true, message: 'Username already exists' });
            }
            
            // Update username
            await db.execute('UPDATE User SET username = ? WHERE id = ?', [username, userId]);
            
            // Log the change
            console.log(`[USERNAME CHANGE] Admin "${locals.user.username}" (ID: ${locals.user.id}) changed user ID ${userId} username from "${oldUsername}" to "${username}"`);
            
            return {
                success: true,
                message: `Successfully updated username from "${oldUsername}" to "${username}"`
            };
        } catch (error) {
            console.error('Failed to update username:', error);
            return fail(500, { error: true, message: 'Failed to update username' });
        }
    },
    
    updatePassword: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            return fail(403, { error: true, message: 'Access denied' });
        }
        
        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const password = data.get('password');
        
        // Validate inputs
        if (!userId || isNaN(userId)) {
            return fail(400, { error: true, message: 'Invalid user ID' });
        }
        
        if (!password || typeof password !== 'string') {
            return fail(400, { error: true, message: 'Password is required' });
        }
        
        // Check if password is valid
        if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,250}$/.test(password)) {
            return fail(400, { error: true, message: 'Password must be at least 8 characters long and contain at least one letter and one number' });
        }
        
        try {
            // Check if user exists
            const [existingUser] = await db.execute('SELECT id, username FROM User WHERE id = ?', [userId]);
            if (existingUser.length === 0) {
                return fail(404, { error: true, message: 'User not found' });
            }
            
            const targetUsername = existingUser[0].username;
            
            // Hash new password
            const hashedPassword = await argon2.hash(password);
            
            // Update password
            await db.execute('UPDATE User SET password = ? WHERE id = ?', [hashedPassword, userId]);
            
            // Log the change
            console.log(`[PASSWORD CHANGE] Admin "${locals.user.username}" (ID: ${locals.user.id}) changed password for user "${targetUsername}" (ID: ${userId})`);
            
            return {
                success: true,
                message: `Successfully updated password for user "${targetUsername}"`
            };
        } catch (error) {
            console.error('Failed to update password:', error);
            return fail(500, { error: true, message: 'Failed to update password' });
        }
    },
    
    updateEmail: async ({ request, locals }) => {
        if (!locals.user || locals.user.permission !== 0) {
            return fail(403, { error: true, message: 'Access denied' });
        }
        
        const data = await request.formData();
        const userId = parseInt(data.get('userId'));
        const email = data.get('email');
        
        // Validate inputs
        if (!userId || isNaN(userId)) {
            return fail(400, { error: true, message: 'Invalid user ID' });
        }
        
        if (!email || typeof email !== 'string') {
            return fail(400, { error: true, message: 'Email is required' });
        }
        
        // Check if email is valid
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250) {
            return fail(400, { error: true, message: 'Invalid email format' });
        }
        
        try {
            // Check if user exists
            const [existingUser] = await db.execute('SELECT id, username, email FROM User WHERE id = ?', [userId]);
            if (existingUser.length === 0) {
                return fail(404, { error: true, message: 'User not found' });
            }
            
            const oldEmail = existingUser[0].email;
            const targetUsername = existingUser[0].username;
            
            // Check if email already exists (excluding current user)
            const [duplicateEmail] = await db.execute('SELECT * FROM User WHERE email = ? AND id != ?', [email, userId]);
            if (duplicateEmail.length > 0) {
                return fail(400, { error: true, message: 'Email already in use' });
            }
            
            // Update email
            await db.execute('UPDATE User SET email = ? WHERE id = ?', [email, userId]);
            
            // Log the change
            console.log(`[EMAIL CHANGE] Admin "${locals.user.username}" (ID: ${locals.user.id}) changed user "${targetUsername}" (ID: ${userId}) email from "${oldEmail}" to "${email}"`);
            
            return {
                success: true,
                message: `Successfully updated email for "${targetUsername}" from "${oldEmail}" to "${email}"`
            };
        } catch (error) {
            console.error('Failed to update email:', error);
            return fail(500, { error: true, message: 'Failed to update email' });
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
