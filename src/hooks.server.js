import { initialiseDatabase } from '$lib/server/db.js';
import { getSession } from '$lib/server/session.js';
import { startDailyImport } from '$lib/server/scheduler.js';
import { initializeAdmin } from '$lib/server/setup.js';
import { dev } from '$app/environment';
import crypto from 'crypto';

// Initialise database when server starts
await initialiseDatabase();

// Start the daily import scheduler when the server starts
startDailyImport();

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
    
    // Handle POST requests
    if (event.request.method === 'POST') {
        const formData = await event.request.formData();
        const csrfToken = formData.get('csrf_token');
        
        if (csrfToken !== event.cookies.get('csrf_token')) {
            return new Response('CSRF token validation failed', { status: 403 });
        }
    }
	
	// Add CSP headers
	const response = await resolve(event);
	const headers = response.headers;

	headers.set(
		'Content-Security-Policy',
		"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';"
	);

	return response;
};
