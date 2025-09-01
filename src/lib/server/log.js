import db from '$lib/server/db.js';

// ANSI color codes
const colors = {
    INFO: '\x1b[36m',    // Cyan
    ERROR: '\x1b[31m',   // Red
    SUCCESS: '\x1b[32m', // Green
    RESET: '\x1b[0m'     // Reset to default
};

async function log(type, message) {
    const timestamp = new Date().toISOString();
    const color = colors[type] || '';
    console.log(`${timestamp} ${color}[ ${type} ]${colors.RESET} ${message}`);
    
    // save to database
    try {
        await db.execute('INSERT INTO Log (type, text) VALUES (?, ?)', [type, message]);
    } catch (error) {
        console.error('Error saving log to database:', error);
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

export default {
    log,
    info,
    error,
    success
};