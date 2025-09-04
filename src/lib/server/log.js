import db from '$lib/server/db.js';

// ANSI color codes
const colors = {
    INFO: '\x1b[36m',    // Cyan
    ERROR: '\x1b[31m',   // Red
    SUCCESS: '\x1b[32m', // Green
    DEBUG: '\x1b[35m',   // Magenta
    RESET: '\x1b[0m'
};

async function log(type, message) {
    const timestamp = new Date().toISOString();
    const color = colors[type] || '';
    console.log(`${timestamp} ${color}[ ${type} ]${colors.RESET} ${message}`);
    
    // Save non-debug logs to database
    if (type !== 'DEBUG') {
        try {
            await db.execute('INSERT INTO Log (type, text) VALUES (?, ?)', [type, message]);
        } catch (error) {
            console.error('Error saving log to database:', error);
        }
    }
}

function info(message) {
    log('INFO', message);
}

function error(message) {
    log('ERROR', message);
}

function success(message) {
    log('SUCCESS', message);
}

function debug(message) {
    log('DEBUG', message);
}

export default {
    log,
    info,
    error,
    success,
    debug
};