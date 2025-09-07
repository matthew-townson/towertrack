import { importDoveData } from '$lib/server/doveImport.js';
import log from '$lib/server/log.js';
import fs from 'fs';
import pool from '$lib/server/db.js';

let importInterval = null;
let isSchedulerEnabled = true; // Default enabled

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

export function stopDailyImport() {
	if (importInterval) {
		clearInterval(importInterval);
		importInterval = null;
		log.info('Daily import scheduler stopped');
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

export function getLastImportTime() {
    // Async version to get last import time from database
    return (async () => {
        try {
            const [rows] = await pool.query('SELECT timestamp FROM CSVImportLog ORDER BY timestamp DESC LIMIT 1');
            if (rows.length > 0) {
                return new Date(rows[0].timestamp);
            }
        } catch (error) {
            log.error(`Failed to get last import time from database: ${error.message}`);
        }
        return null;
    })();
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
