import { fail, redirect } from '@sveltejs/kit';
import { validateUser } from '$lib/validation.js';
import { createSession } from '$lib/session.js';
import log from '$lib/log.js';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');

    if (!username || !password) {
      return fail(400, { error: true, message: 'Please enter your username and password', username });
    }

    const result = await validateUser(username, password);
    
    if (!result.success) {
      return fail(400, { error: true, message: result.message, username });
    }

    const sessionId = createSession(result.user.id, result.user.username, result.user.permission);
    
    cookies.set('session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    //debug print session information
    log.info(`User logged in: ${result.user.username}, Session ID: ${sessionId}, Permission Level: ${result.user.permission}`);

    throw redirect(303, '/home');
  }
};
