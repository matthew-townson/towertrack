import { initialiseDatabase } from '$lib/server/db.js';
import { getSession } from '$lib/server/session.js';
import { startDailyImport, startBBImportScheduler } from '$lib/server/scheduler.js';
import { initializeAdmin } from '$lib/server/setup.js';
import { dev } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import crypto from 'crypto';

// Initialise database when server starts
await initialiseDatabase();

// Start the daily import schedulers when the server starts
startDailyImport();
startBBImportScheduler();

// Initialize admin user on server start
let adminInitialized = false;

if (!adminInitialized) {
    initializeAdmin();
    adminInitialized = true;
}

export const handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const session = getSession(sessionId);
		if (session) {
			event.locals.user = {
				id: session.userId,
				username: session.username,
				permission: session.permission
			};
			
			if (session.permission === 4) {
				event.cookies.delete('session', { path: '/' });
				throw redirect(303, '/');
			}

		} else {
			// Clean up invalid session cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

    // Set up CSRF token if not already present
    if (!event.cookies.get('csrf_token')) {
        const token = crypto.randomBytes(32).toString('hex');
        event.cookies.set('csrf_token', token, {
            path: '/',
            httpOnly: true,
            secure: !dev,
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 // 24 hours
        });
    }
    
    // CSRF verification removed temporarily

	// Remove CSP headers
	const response = await resolve(event);
	return response;
};
