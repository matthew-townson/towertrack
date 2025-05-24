import { fail, redirect } from '@sveltejs/kit';
//import sqlite3 from 'sqlite3';
//import { open } from 'sqlite';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');

    // TODO: Replace with DB query
    if (username === 'admin' && password === 'password') {

      // set cookie
      cookies.set('session', 'some-session-token', {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24
      });
      throw redirect(303, '/');
    }

    return fail(400, { error: true, message: 'Invalid username or password' });
  }
};