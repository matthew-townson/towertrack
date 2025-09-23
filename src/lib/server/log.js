import db from '$lib/server/db.js';

// ANSI colour codes
const colours = {
    INFO: '\x1b[36m',    // Cyan
    ERROR: '\x1b[31m',   // Red
    SUCCESS: '\x1b[32m', // Green
    DEBUG: '\x1b[35m',   // Magenta
    WARN: '\x1b[33m',    // Yellow
    RESET: '\x1b[0m'
};

async function log(type, message) {
    const timestamp = new Date().toISOString();
    const colour = colours[type] || '';
    const isDevProfile = process.env.DOCKER_PROFILE === 'dev';
    const ignoreDebug = false;

    /*console.log(isDevProfile);

    if (isDevProfile && type === 'DEBUG') {
        return;
    } else {
        }
    */


    if (type === 'DEBUG' && ignoreDebug) {
        return;
    }
       
    console.log(`${timestamp} ${colour}[ ${type} ]${colours.RESET} ${message}`);
       
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

function warn(message) {
    log('WARN', message);
}

export default {
    log,
    info,
    error,
    success,
    debug,
    warn
};