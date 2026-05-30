import { randomBytes } from 'crypto';
import db from '$lib/server/db.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId, username, permission) {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.execute(
        `INSERT INTO Session (sessionId, userId, username, permission, expiresAt)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, userId, username, permission, expiresAt]
    );

    return sessionId;
}

export async function getSession(sessionId) {
    const [rows] = await db.execute(
        `SELECT userId, username, permission, expiresAt
         FROM Session
         WHERE sessionId = ?
         LIMIT 1`,
        [sessionId]
    );

    const session = rows[0];
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
        await db.execute('DELETE FROM Session WHERE sessionId = ?', [sessionId]);
        return null;
    }

    return session;
}

export async function deleteSession(sessionId) {
    await db.execute('DELETE FROM Session WHERE sessionId = ?', [sessionId]);
}
