import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/session.js';

export const POST = async ({ cookies }) => {
    const sessionId = cookies.get('session');
    if (sessionId) {
        await deleteSession(sessionId);
    }
    cookies.delete('session', { path: '/' });
    throw redirect(303, '/');
};
