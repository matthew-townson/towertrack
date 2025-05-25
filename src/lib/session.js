import { randomBytes } from 'crypto';

// TODO: Use DB or other storage for session
const sessions = new Map();

export function createSession(userId, username, permission) {
  const sessionId = randomBytes(32).toString('hex');
  const sessionData = {
    userId,
    username,
    permission,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
  
  sessions.set(sessionId, sessionData);
  return sessionId;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}
