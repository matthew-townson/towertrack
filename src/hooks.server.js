import { initialiseDatabase } from '$lib/db.js';
import { getSession } from '$lib/session.js';
import log from '$lib/log.js';

// Initialise database when server starts
await initialiseDatabase();

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

			// Debug: log what we're setting
			log.info(`Setting locals.user: ${JSON.stringify(event.locals.user)}`);
		} else {
			// Clean up invalid session cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

	return await resolve(event);
};
