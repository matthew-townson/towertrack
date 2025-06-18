import { initialiseDatabase } from '$lib/db.js';
import { getSession } from '$lib/session.js';
import log from '$lib/log.js';
import { startDailyImport } from '$lib/scheduler.js';
import { initializeAdmin } from '$lib/server/setup.js';

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

	return await resolve(event);
};
