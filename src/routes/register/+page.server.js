import { fail, redirect } from '@sveltejs/kit';
import db from '$lib/db.js';
import argon2 from 'argon2';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');
    const email = data.get('email');
    const confirmEmail = data.get('confirmEmail');

    // check if values exist
    if (!username || !password || !email || !confirmEmail) {
      return fail(400, { error: true, message: 'All fields are required' });
    }
    // check if username is valid - only letters, spaces, and hyphens
    if (!/^[a-zA-Z0-9\s-]{3,50}$/.test(username)) {
      return fail(400, { error: true, message: 'Username must be 3-50 characters long and can only contain letters, numbers, spaces, and hyphens', email, confirmEmail });
    }
    // check if password is valid - at least 8 characters, less than 250, at least one letter and one number
    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,250}$/.test(password)) {
      return fail(400, { error: true, message: 'Password must be at least 8 characters long and contain at least one letter and one number', username, email, confirmEmail });
    }
    // check if email is valid
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250) {
      return fail(400, { error: true, message: 'Invalid email format', username });
    }
    // check if emails match
    if (email !== confirmEmail) {
      return fail(400, { error: true, message: 'Emails do not match', username, email });
    }
    // check if username already exists
    const [existingUser] = await db.execute('SELECT * FROM User WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      return fail(400, { error: true, message: 'Username already exists', email, confirmEmail });
    }
    // check if email already exists
    const [existingEmail] = await db.execute('SELECT * FROM User WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return fail(400, { error: true, message: 'Email already used', username });
    }
    // hash password with argon2
    const hashedPassword = await argon2.hash(password);
    // insert user into database
    try {
      await db.execute('INSERT INTO User (username, password, email, permission) VALUES (?, ?, ?, ?)', [username, hashedPassword, email, 3]);
      // redirect to login page
    } catch (error) {
      console.error('Database error:', error);
      return fail(500, { error: true, message: 'Internal server error' });
    }
    
    // if all well, redirect to login page
    throw redirect(303, '/login');
  }
};