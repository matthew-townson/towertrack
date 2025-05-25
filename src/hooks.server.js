import { initialiseDatabase } from '$lib/db.js';
import { getSession } from '$lib/session.js';

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
				permission: session.permissionLevel
			};
		}
	}

	return await resolve(event);
};
