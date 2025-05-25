import db from '$lib/db.js';
import argon2 from 'argon2';

export async function validateUser(username, password) {
    try {
        const [users] = await db.execute('SELECT * FROM User WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return { success: false, message: 'Invalid username or password' };
        }
        
        const user = users[0];
        
        const isValidPassword = await argon2.verify(user.password, password);
        
        if (!isValidPassword) {
            return { success: false, message: 'Invalid username or password' };
        }
        
        return { success: true, user: { id: user.id, username: user.username, email: user.email, permission: user.permission} };
    } catch (error) {
        console.error('User validation error:', error);
        return { success: false, message: 'Authentication failed' };
    }
}
