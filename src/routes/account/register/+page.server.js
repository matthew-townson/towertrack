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

    // ...existing validation code...

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
    throw redirect(303, '/account/login');
  }
};
