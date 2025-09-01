import { dev } from '$app/environment';

const attempts = new Map();
const lockouts = new Map();

export function checkRateLimit(identifier, maxAttempts = 5, lockoutMinutes = 15) {
    const now = Date.now();
    const userAttempts = attempts.get(identifier) || [];
    const lockoutUntil = lockouts.get(identifier);
    
    // Check if user is locked out
    if (lockoutUntil && lockoutUntil > now) {
        const remainingMinutes = Math.ceil((lockoutUntil - now) / 60000);
        return { 
            limited: true, 
            message: `Too many attempts. Try again in ${remainingMinutes} minutes.` 
        };
    }
    
    // Clean up old attempts (older than 10 minutes)
    const recentAttempts = userAttempts.filter(time => time > now - 600000);
    attempts.set(identifier, recentAttempts);
    
    // Check if too many recent attempts
    if (recentAttempts.length >= maxAttempts) {
        const lockoutTime = now + lockoutMinutes * 60000;
        lockouts.set(identifier, lockoutTime);
        return { 
            limited: true, 
            message: `Too many attempts. Try again in ${lockoutMinutes} minutes.` 
        };
    }
    
    // Record this attempt
    recentAttempts.push(now);
    attempts.set(identifier, recentAttempts);
    
    return { limited: false };
}