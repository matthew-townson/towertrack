import { fail, redirect } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import log from '$lib/server/log.js';
import argon2 from 'argon2';

export const actions = {
    default: async ({ request, cookies }) => {
        const data = await request.formData();
        const username = data.get('username');
        const password = data.get('password');
        const email = data.get('email');
        const confirmEmail = data.get('confirmEmail');
        
        // remove whitespace from username and email
        const tUsername = username.trim();
        const tEmail = email.trim();
        const tConfEmail = confirmEmail.trim();

        // check if values exist
        if (!tUsername || !password || !tEmail || !tConfEmail) {
            return fail(400, { error: true, message: 'All fields are required' });
        }
        // check if username is valid - only letters, spaces, and hyphens
        if (!/^[a-zA-Z0-9\s-]{3,50}$/.test(tUsername)) {
            return fail(400, { error: true, message: 'Username must be 3-50 characters long and can only contain letters, numbers, spaces, and hyphens', tEmail, tConfEmail });
        }
        // check if password is valid - at least 8 characters, less than 250, at least one letter and one number
        if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,250}$/.test(password)) {
            return fail(400, { error: true, message: 'Password must be at least 8 characters long and contain at least one letter and one number', tUsername, tEmail, tConfEmail });
        }
        // check if email is valid
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tEmail) || tEmail.length > 250) {
            return fail(400, { error: true, message: 'Invalid email format', tUsername });
        }
        // check if emails match
        if (tEmail !== tConfEmail) {
            return fail(400, { error: true, message: 'Emails do not match', tUsername, tEmail });
        }
        // check if username already exists
        const [existingUser] = await db.execute('SELECT * FROM User WHERE username = ?', [tUsername]);
        if (existingUser.length > 0) {
            return fail(400, { error: true, message: 'Username already exists', tEmail, tConfEmail });
        }
        // check if email already exists
        const [existingEmail] = await db.execute('SELECT * FROM User WHERE email = ?', [tEmail]);
        if (existingEmail.length > 0) {
            return fail(400, { error: true, message: 'Email already used', tUsername });
        }
        // hash password with argon2
        const hashedPassword = await argon2.hash(password);
        // insert user into database
        try {
            const [result] = await db.execute('INSERT INTO User (username, password, email, permission) VALUES (?, ?, ?, ?)', [trimmedUsername, hashedPassword, trimmedEmail, 3]);
            await db.execute('INSERT INTO UserSettings (userId) VALUES (?)', [result.insertId]);
            log.success(`User "${trimmedUsername}" registered successfully`);
            // redirect to login page
        } catch (error) {
            log.error(`User "${trimmedUsername}" failed to register: ${error.message}`);
            return fail(500, { error: true, message: 'Internal server error' });
        }
        
        // if all well, redirect to login page
        throw redirect(303, '/login');
    }
};