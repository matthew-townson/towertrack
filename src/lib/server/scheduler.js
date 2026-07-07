import { importDoveData } from '$lib/server/doveImport.js';
import { importBBData } from '$lib/server/bbImport.js';
import log from '$lib/server/log.js';
import fs from 'fs';
import pool from '$lib/server/db.js';
import { notifyAdmins } from '$lib/server/notifications.js';

let importInterval = null;
let bbImportInterval = null;
let isSchedulerEnabled = true; // Default enabled
let isBBSchedulerEnabled = true; // Default enabled for BellBoard
let isBBImportRunning = false;
const BB_IMPORT_STALE_MS = 30 * 60 * 1000;

// Delay between importing each user's BB data (to avoid hammering BB servers)
const BB_IMPORT_DELAY_MS = 5000; // 5 seconds between users

// BellBoard import progress tracking
let bbImportProgress = {
    status: 'idle',
    message: '',
    users: [],
    currentUserIndex: -1,
    totalUsers: 0,
    completedUsers: 0,
    successCount: 0,
    failCount: 0,
    lastUpdated: Date.now()
};

function setBBImportProgress(update) {
    bbImportProgress = {
        ...bbImportProgress,
        ...update,
        lastUpdated: Date.now()
    };
}

function resetStaleBBImportIfNeeded() {
    if (bbImportProgress.status !== 'running') {
        return false;
    }

    const lastUpdated = bbImportProgress.lastUpdated || 0;
    if (Date.now() - lastUpdated <= BB_IMPORT_STALE_MS) {
        return false;
    }

    log.warn('BellBoard import appeared stalled; clearing stale running state');
    bbImportProgress = {
        ...bbImportProgress,
        status: 'error',
        message: 'BellBoard import stalled and was marked failed',
        currentUserIndex: -1,
        lastUpdated: Date.now()
    };
    isBBImportRunning = false;
    return true;
}

export function getBBImportProgress() {
    resetStaleBBImportIfNeeded();
    return { ...bbImportProgress };
}

export function startDailyImport() {
	if (!isSchedulerEnabled) {
		log.info('Daily import scheduler is disabled, not starting');
		return;
	}

	// Stop existing interval if running
	if (importInterval) {
		clearInterval(importInterval);
	}

	// Run import every 24 hours (86400000 ms)
	importInterval = setInterval(async () => {  
		try {
			log.info('Starting scheduled daily import');
			await importDoveData();
		} catch (error) {
			log.error(`Scheduled import failed: ${error.message}`);
		}
	}, 24 * 60 * 60 * 1000);

	// Also check if we should run import on startup
	checkAndRunStartupImport();
	
	log.info('Daily import scheduler started');
}

export function startBBImportScheduler() {
	if (!isBBSchedulerEnabled) {
		log.info('BellBoard import scheduler is disabled, not starting');
		return;
	}

	// Stop existing interval if running
	if (bbImportInterval) {
		clearInterval(bbImportInterval);
	}

	// Schedule BB import to run at midnight
	scheduleMidnightBBImport();
	
	log.info('BellBoard import scheduler started');
}

function scheduleMidnightBBImport() {
	const now = new Date();
	const midnight = new Date(now);
	midnight.setHours(24, 0, 0, 0); // Next midnight
	
	const msUntilMidnight = midnight.getTime() - now.getTime();
	
	log.info(`Next BellBoard import scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
	
	// Set timeout for first run at midnight
	setTimeout(async () => {
		try {
			log.info('Starting scheduled midnight BellBoard import for all users');
			await importBBDataForAllUsers();
		} catch (error) {
			log.error(`Scheduled BellBoard import failed: ${error.message}`);
		}
		
		// Then set up daily interval (24 hours)
		bbImportInterval = setInterval(async () => {
			try {
				log.info('Starting scheduled daily BellBoard import for all users');
				await importBBDataForAllUsers();
			} catch (error) {
				log.error(`Scheduled BellBoard import failed: ${error.message}`);
			}
		}, 24 * 60 * 60 * 1000);
	}, msUntilMidnight);
}

export function stopDailyImport() {
	if (importInterval) {
		clearInterval(importInterval);
		importInterval = null;
		log.info('Daily import scheduler stopped');
	}
}

export function stopBBImportScheduler() {
	if (bbImportInterval) {
		clearInterval(bbImportInterval);
		bbImportInterval = null;
		log.info('BellBoard import scheduler stopped');
	}
}

async function checkAndRunStartupImport() {
    try {
        // Get latest import time from database
        const [rows] = await pool.query('SELECT timestamp FROM CSVImportLog ORDER BY timestamp DESC LIMIT 1');
        if (rows.length > 0) {
            const lastImportTime = new Date(rows[0].timestamp);
            const now = new Date();
            const hoursSinceLastImport = (now - lastImportTime) / (1000 * 60 * 60);
            // If more than 24 hours since last import, run it now
            if (hoursSinceLastImport >= 24) {
                log.info('More than 24 hours since last import, running startup import');
                await importDoveData();
            }
        } else {
            // No previous import record, run first import
            log.info('No previous import found in database, running initial import');
            await importDoveData();
        }
    } catch (error) {
        log.error(`Startup import check failed: ${error.message}`);
    }
}

async function importBBDataForAllUsers() {
    if (isBBImportRunning) {
        log.info('BellBoard import is already running, skipping duplicate start');
        return { started: false, alreadyRunning: true };
    }

    isBBImportRunning = true;
    try {
        // Get all users
        const [users] = await pool.query(`SELECT id, username FROM User ORDER BY id`);
        
        if (users.length === 0) {
            log.info('No users to import BellBoard data for');
            setBBImportProgress({
                status: 'complete',
                message: 'No users to import',
                users: [],
                currentUserIndex: -1,
                totalUsers: 0,
                completedUsers: 0,
                successCount: 0,
                failCount: 0
            });
            return { started: true, totalUsers: 0, successCount: 0, failCount: 0 };
        }
        
        log.info(`Starting BellBoard import for ${users.length} users`);
        
        // Initialize progress
        setBBImportProgress({
            status: 'running',
            message: 'Starting BellBoard import...',
            users: users.map(u => ({ id: u.id, username: u.username, status: 'pending' })),
            currentUserIndex: -1,
            totalUsers: users.length,
            completedUsers: 0,
            successCount: 0,
            failCount: 0
        });
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            setBBImportProgress({
                currentUserIndex: i,
                users: bbImportProgress.users.map((entry, index) => index === i ? { ...entry, status: 'importing' } : entry),
                message: `Importing data for ${user.username}...`
            });
            
            try {
                log.info(`Importing BellBoard data for user: ${user.username} (ID: ${user.id})`);
                await importBBData(user.id);
                successCount++;
                setBBImportProgress({
                    users: bbImportProgress.users.map((entry, index) => index === i ? { ...entry, status: 'success' } : entry)
                });
            } catch (error) {
                log.error(`BellBoard import failed for ${user.username}: ${error.message}`);
                failCount++;
                setBBImportProgress({
                    users: bbImportProgress.users.map((entry, index) => index === i ? { ...entry, status: 'error', error: error.message } : entry)
                });
            }
            
            setBBImportProgress({
                completedUsers: i + 1,
                successCount,
                failCount
            });
            
            // Delay between users to be nice to BellBoard servers
            if (i < users.length - 1) {
                setBBImportProgress({ message: 'Waiting before next user...' });
                await new Promise(resolve => setTimeout(resolve, BB_IMPORT_DELAY_MS));
            }
        }
        
        setBBImportProgress({
            status: 'complete',
            message: `Import complete: ${successCount} succeeded, ${failCount} failed`,
            currentUserIndex: -1
        });
        
        log.success(`BellBoard import complete: ${successCount} succeeded, ${failCount} failed`);

        const importStatus = failCount === 0 ? 'success' : successCount === 0 ? 'error' : 'warning';
        try {
            await notifyAdmins(
                'system_import',
                'BellBoard Daily Import Finished',
                `BellBoard import completed with ${successCount} successful and ${failCount} failed user imports.`,
                {
                    source: 'bellboard',
                    status: importStatus,
                    successCount,
                    failCount,
                    totalUsers: users.length,
                    completedAt: new Date().toISOString()
                }
            );
        } catch (notificationError) {
            log.error(`Failed to notify admins about BellBoard import success: ${notificationError.message}`);
        }

        return { started: true, totalUsers: users.length, successCount, failCount };
    } catch (error) {
        log.error(`BellBoard import for all users failed: ${error.message}`);
        setBBImportProgress({ status: 'error', message: error.message, currentUserIndex: -1 });

        try {
            await notifyAdmins(
                'system_import',
                'BellBoard Daily Import Failed',
                `BellBoard import failed: ${error.message}`,
                {
                    source: 'bellboard',
                    status: 'error',
                    error: error.message,
                    failedAt: new Date().toISOString()
                }
            );
        } catch (notificationError) {
            log.error(`Failed to notify admins about BellBoard import failure: ${notificationError.message}`);
        }
        throw error;
    } finally {
        isBBImportRunning = false;
    }
}

export function startManualBBImport() {
    resetStaleBBImportIfNeeded();
    if (isBBImportRunning || bbImportProgress.status === 'running') {
        return {
            started: false,
            message: 'BellBoard import is already running.'
        };
    }

    // Schedule on the next tick so it continues independently of the request lifecycle.
    setTimeout(() => {
        importBBDataForAllUsers().catch((error) => {
            log.error(`Manual BellBoard import failed: ${error.message}`);
        });
    }, 0);

    return {
        started: true,
        message: 'BellBoard import started for all users.'
    };
}

export { importBBDataForAllUsers };

export async function getLastImportTime() {
    try {
        const [rows] = await pool.query('SELECT timestamp FROM CSVImportLog ORDER BY timestamp DESC LIMIT 1');
        if (rows.length > 0) {
            return new Date(rows[0].timestamp);
        }
    } catch (error) {
        log.error(`Failed to get last import time from database: ${error.message}`);
    }
    return null;
}

export async function getLastImportStatus() {
    try {
        // Get the last successful import time
        const [successRows] = await pool.query('SELECT timestamp FROM CSVImportLog ORDER BY timestamp DESC LIMIT 1');
        const lastSuccessTime = successRows.length > 0 ? new Date(successRows[0].timestamp) : null;
        
        // Get the last Dove import error (exclude BellBoard)
        const [errorRows] = await pool.query(
            "SELECT text, timestamp FROM Log WHERE type = 'ERROR' AND text LIKE '%import%' AND text NOT LIKE '%BellBoard%' ORDER BY timestamp DESC LIMIT 1"
        );
        const lastError = errorRows.length > 0 ? {
            message: errorRows[0].text,
            timestamp: new Date(errorRows[0].timestamp)
        } : null;
        
        // Get the last Dove import attempt (success log, exclude BellBoard)
        const [successLogRows] = await pool.query(
            "SELECT text, timestamp FROM Log WHERE type = 'SUCCESS' AND text LIKE '%import%' AND text NOT LIKE '%BellBoard%' ORDER BY timestamp DESC LIMIT 1"
        );
        const lastSuccess = successLogRows.length > 0 ? {
            message: successLogRows[0].text,
            timestamp: new Date(successLogRows[0].timestamp)
        } : null;
        
        // Determine overall status based on which happened most recently
        let status = 'unknown';
        let lastAttemptTime = null;
        let lastMessage = null;
        
        if (lastError && lastSuccess) {
            // Both exist - compare timestamps
            if (lastError.timestamp > lastSuccess.timestamp) {
                status = 'error';
                lastAttemptTime = lastError.timestamp;
                lastMessage = lastError.message;
            } else {
                status = 'success';
                lastAttemptTime = lastSuccess.timestamp;
                lastMessage = lastSuccess.message;
            }
        } else if (lastError) {
            status = 'error';
            lastAttemptTime = lastError.timestamp;
            lastMessage = lastError.message;
        } else if (lastSuccess) {
            status = 'success';
            lastAttemptTime = lastSuccess.timestamp;
            lastMessage = lastSuccess.message;
        } else if (lastSuccessTime) {
            // No log entries but we have CSVImportLog
            status = 'success';
            lastAttemptTime = lastSuccessTime;
            lastMessage = 'Import completed';
        }
        
        return {
            status,
            lastSuccessTime,
            lastAttemptTime,
            lastMessage,
            lastError
        };
    } catch (error) {
        log.error(`Failed to get last import status from database: ${error.message}`);
        return {
            status: 'unknown',
            lastSuccessTime: null,
            lastAttemptTime: null,
            lastMessage: null,
            lastError: null
        };
    }
}

export async function getLastImportError() {
    try {
        const [rows] = await pool.query(
            "SELECT text, timestamp FROM Log WHERE type = 'ERROR' AND text LIKE '%import%' ORDER BY timestamp DESC LIMIT 1"
        );
        if (rows.length > 0) {
            return {
                message: rows[0].text,
                timestamp: new Date(rows[0].timestamp)
            };
        }
    } catch (error) {
        log.error(`Failed to get last import error from database: ${error.message}`);
    }
    return null;
}

export async function getLastBBImportStatus() {
    try {
        // Get the last BB import error
        const [errorRows] = await pool.query(
            "SELECT text, timestamp FROM Log WHERE type = 'ERROR' AND text LIKE '%BellBoard%' ORDER BY timestamp DESC LIMIT 1"
        );
        const lastError = errorRows.length > 0 ? {
            message: errorRows[0].text,
            timestamp: new Date(errorRows[0].timestamp)
        } : null;
        
        // Get the last BB import success log
        const [successLogRows] = await pool.query(
            "SELECT text, timestamp FROM Log WHERE type = 'SUCCESS' AND text LIKE '%BellBoard%' ORDER BY timestamp DESC LIMIT 1"
        );
        const lastSuccess = successLogRows.length > 0 ? {
            message: successLogRows[0].text,
            timestamp: new Date(successLogRows[0].timestamp)
        } : null;
        
        // Determine overall status based on which happened most recently
        let status = 'unknown';
        let lastAttemptTime = null;
        let lastMessage = null;
        
        if (lastError && lastSuccess) {
            if (lastError.timestamp > lastSuccess.timestamp) {
                status = 'error';
                lastAttemptTime = lastError.timestamp;
                lastMessage = lastError.message;
            } else {
                status = 'success';
                lastAttemptTime = lastSuccess.timestamp;
                lastMessage = lastSuccess.message;
            }
        } else if (lastError) {
            status = 'error';
            lastAttemptTime = lastError.timestamp;
            lastMessage = lastError.message;
        } else if (lastSuccess) {
            status = 'success';
            lastAttemptTime = lastSuccess.timestamp;
            lastMessage = lastSuccess.message;
        }
        
        return {
            status,
            lastAttemptTime,
            lastMessage,
            lastError
        };
    } catch (error) {
        log.error(`Failed to get last BB import status: ${error.message}`);
        return {
            status: 'unknown',
            lastAttemptTime: null,
            lastMessage: null,
            lastError: null
        };
    }
}

export function enableScheduler() {
    isSchedulerEnabled = true;
    saveSchedulerState();
    startDailyImport();
    log.info('Daily import scheduler enabled');
}

export function disableScheduler() {
    isSchedulerEnabled = false;
    saveSchedulerState();
    stopDailyImport();
    log.info('Daily import scheduler disabled');
}

export function isSchedulerRunning() {
    return isSchedulerEnabled && importInterval !== null;
}

export function getSchedulerState() {
    return isSchedulerEnabled;
}

function saveSchedulerState() {
    try {
        const archiveDir = 'dovedata/archive';
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }
        fs.writeFileSync(`${archiveDir}/schedulerState.txt`, isSchedulerEnabled.toString());
    } catch (error) {
        log.error(`Failed to save scheduler state: ${error.message}`);
    }
}

function loadSchedulerState() {
    try {
        const archiveDir = 'dovedata/archive';
        const stateFile = `${archiveDir}/schedulerState.txt`;
        
        if (fs.existsSync(stateFile)) {
            const state = fs.readFileSync(stateFile, 'utf-8').trim();
            isSchedulerEnabled = state === 'true';
        }
    } catch (error) {
        log.error(`Failed to load scheduler state: ${error.message}`);
    }
}

// Load state on module initialization
loadSchedulerState();
