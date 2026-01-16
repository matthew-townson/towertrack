//import { json } from 'stream/consumers';
import log from '$lib/server/log.js';
import pool from '$lib/server/db.js';
import fs from 'fs';
import crypto from 'crypto';

export async function importDoveData() {
    log.info('Starting import of Dove data');

    // Fetch CSVs
    log.info('Fetching towers.csv and bells.csv from Dove website');
    const towers = await fetch('https://mtownson.com/towers.csv'); // Amend to real dove link when out of frequent testing
    const bells = await fetch('https://mtownson.com/bells.csv');   // Amend to real dove link when out of frequent testing

    if (!towers.ok) {
        log.error(`HTTP error fetching towers.csv! status: ${towers.status}`);
        throw new Error(`HTTP error fetching towers.csv! status: ${towers.status}`);
    }
    if (!bells.ok) {
        log.error(`HTTP error fetching bells.csv! status: ${bells.status}`);
        throw new Error(`HTTP error fetching bells.csv! status: ${bells.status}`);
    }

    const towersCsv = await towers.text();
    const bellsCsv = await bells.text();

    // Hash CSV contents
    const towersHash = crypto.createHash('sha256').update(towersCsv).digest('hex');
    const bellsHash = crypto.createHash('sha256').update(bellsCsv).digest('hex');
    
    log.info(`Current towers.csv hash: ${towersHash}`);
    log.info(`Current bells.csv hash: ${bellsHash}`);

    // Check latest hashes in CSVImportLog
    const [towersLog] = await pool.query('SELECT hash FROM CSVImportLog WHERE filename = ? ORDER BY timestamp DESC LIMIT 1', ['towers.csv']);
    const [bellsLog] = await pool.query('SELECT hash FROM CSVImportLog WHERE filename = ? ORDER BY timestamp DESC LIMIT 1', ['bells.csv']);

    const storedTowersHash = towersLog.length > 0 ? towersLog[0].hash : null;
    const storedBellsHash = bellsLog.length > 0 ? bellsLog[0].hash : null;
    
    log.info(`Stored towers.csv hash: ${storedTowersHash || 'non    e'}`);
    log.info(`Stored bells.csv hash: ${storedBellsHash || 'none'}`);

    const towersUnchanged = storedTowersHash && storedTowersHash === towersHash;
    const bellsUnchanged = storedBellsHash && storedBellsHash === bellsHash;
    
    log.info(`Towers unchanged: ${towersUnchanged}, Bells unchanged: ${bellsUnchanged}`);

    if (towersUnchanged && bellsUnchanged) {
        log.info('No changes in towers.csv or bells.csv, skipping import.');
        return {
            success: false,
            message: 'No changes in towers.csv or bells.csv, skipping import.'
        };
    }
    
    // Log what changed
    if (!towersUnchanged) {
        log.info('towers.csv has changed, will re-import');
    }
    if (!bellsUnchanged) {
        log.info('bells.csv has changed, will re-import');
    }

    // Parse CSV data with proper handling of quoted fields and commas
    const parseCSV = (csv) => {
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];
        
        const headers = parseCSVRow(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVRow(lines[i]);
            if (values.length > 0) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || null;
                });
                data.push(row);
            }
        }
        
        return data;
    };

    const parseCSVRow = (row) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < row.length) {
            const char = row[i];
            
            if (char === '"') {
                if (inQuotes && row[i + 1] === '"') {
                    current += '"';
                    i += 2;
                } else {
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }
        
        result.push(current.trim());
        return result;
    };

    log.info(`Parsing CSV data`);
    const towersData = parseCSV(towersCsv);
    const bellsData = parseCSV(bellsCsv);

    // Filter towers data first - only import if RingType is full-circle ring
    const filteredTowersData = towersData.filter(tower => tower.RingType && tower.RingType.startsWith('Full-circle ring'));

    // Filter bells data - only import if bell collection type is full-circle ring
    const filteredBellsData = bellsData.filter(bell => bell.CollectionType && bell.CollectionType.startsWith('full-circle ring'));

    // log
    log.info(`Of ${towersData.length} towers and ${bellsData.length} bells, importing ${filteredTowersData.length} towers and ${filteredBellsData.length} bells`);

    const batchSize = 500;
    
    // get dedicated connection for transaction
    const connection = await pool.getConnection();
    
    try {
        // Disable foreign key checks first (before any operations)
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // Clear existing data using TRUNCATE (outside transaction - TRUNCATE causes implicit commit)
        log.info('Clearing existing bells data...');
        await connection.query('TRUNCATE TABLE Bell');
        log.info('Cleared bells. Clearing towers data...');
        await connection.query('TRUNCATE TABLE Tower');
        log.info('Cleared towers.');
        
        // Now start transaction for inserts
        await connection.query('START TRANSACTION');
        
        log.info(`Inserting ${filteredTowersData.length} towers in batches of ${batchSize}...`);
        for (let i = 0; i < filteredTowersData.length; i += batchSize) {
            const batch = filteredTowersData.slice(i, i + batchSize);
            const values = batch.map(tower => [
                tower.TowerID ? parseInt(tower.TowerID) : null,
                tower.RingID ? parseInt(tower.RingID) : null,
                tower.Place || null,
                tower.Place2 || null,
                tower.PlaceCL || null,
                tower.Dedicn || null,
                tower.BareDedicn || null,
                tower.AltName || null,
                tower.RingName || null,
                tower.Region || null,
                tower.County || null,
                tower.Country || null,
                tower.HistRegion || null,
                tower.ISO3166code || null,
                tower.Diocese || null,
                tower.Lat && !isNaN(parseFloat(tower.Lat)) ? parseFloat(tower.Lat) : null,
                tower.Long && !isNaN(parseFloat(tower.Long)) ? parseFloat(tower.Long) : null,
                tower.Bells ? parseInt(tower.Bells) : null,
                tower.UR === 'u/r' ? true : null,
                tower.Semitones || null,
                tower.Wt && !isNaN(parseFloat(tower.Wt)) ? parseFloat(tower.Wt) : null,
                tower.Note || null,
                tower.GF === 'GF' ? true : null,
                tower.ExtraInfo || null,
                tower.WebPage || null,
                tower.Affiliations || null,
                tower.Postcode || null,
                tower.Practice || null,
                tower.LGrade || null,
            ]);
            await connection.query('INSERT INTO Tower (`TowerID`, `RingID`, `Place`, `Place2`, `PlaceCL`, `Dedicn`, `BareDedicn`, `AltName`, `RingName`, `Region`, `County`, `Country`, `HistRegion`, `ISO3166code`, `Diocese`, `Lat`, `Long`, `Bells`, `UR`, `Semitones`, `Wt`, `Note`, `GF`, `ExtraInfo`, `WebPage`, `Affiliations`, `Postcode`, `Practice`, `LGrade`) VALUES ?', [values]);
            if ((i + batchSize) % 2000 === 0 || i + batchSize >= filteredTowersData.length) {
                log.info(`  Towers progress: ${Math.min(i + batchSize, filteredTowersData.length)}/${filteredTowersData.length}`);
            }
        }        
        
        log.info(`Inserted ${filteredTowersData.length} towers. Now inserting bells...`);

        // Insert bells data
        log.info(`Inserting ${filteredBellsData.length} bells in batches of ${batchSize}...`);
        for (let i = 0; i < filteredBellsData.length; i += batchSize) {
            const batch = filteredBellsData.slice(i, i + batchSize);
            const values = batch.map(bell => [
                bell['Bell ID'] ? parseInt(bell['Bell ID']) : null,
                bell['Tower ID'] ? parseInt(bell['Tower ID']) : null,
                bell['Ring ID'] ? parseInt(bell['Ring ID']) : null,
                bell['Bell Role'] || null,
                bell['Bell Name'] || null,
                bell['Weight (lbs)'] ? parseInt(bell['Weight (lbs)']) : null,
                bell['Weight (approx)'] === 'Y' ? true : null,
                bell['Note'] || null,
                bell['Cast Date'] || null,
                bell['Listed'] === 'Y' ? true : null,
                bell['Founder'] || null,
                bell['Founder Uncertain'] === 'Y' ? true : null,
                bell['Canons'] || null
            ]);
            await connection.query('INSERT INTO Bell (`BellID`, `TowerID`, `RingID`, `BellRole`, `BellName`, `WeightLbs`, `WeightApprox`, `Note`, `CastDate`, `Listed`, `Founder`, `FounderUncertain`, `Canons`) VALUES ?', [values]);
            if ((i + batchSize) % 5000 === 0 || i + batchSize >= filteredBellsData.length) {
                log.info(`  Bells progress: ${Math.min(i + batchSize, filteredBellsData.length)}/${filteredBellsData.length}`);
            }
        }

        // Optimise tables
        log.info('Optimising Tower and Bell tables...');
        await connection.query('ANALYZE TABLE Tower, Bell');
        log.info('Finished optimising tables');

        // Save new hashes to CSVImportLog
        await connection.query('INSERT INTO CSVImportLog (filename, hash) VALUES (?, ?)', ['towers.csv', towersHash]);
        await connection.query('INSERT INTO CSVImportLog (filename, hash) VALUES (?, ?)', ['bells.csv', bellsHash]);
        
        // Commit transaction
        await connection.query('COMMIT');
        
        log.info(`Committed ${filteredTowersData.length} towers and ${bellsData.length} bells`);
        log.success(`Successfully imported ${filteredTowersData.length} towers and ${bellsData.length} bells`);

    } catch (error) {
        // Rollback transaction on error
        await connection.query('ROLLBACK');
        log.error(`Database import failed: ${error.message}`);
        throw error;
    } finally {
        // Always re-enable foreign key checks and release the connection
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        connection.release();
    }
    
    return {
        success: true,
        message: `Successfully imported ${filteredTowersData.length} towers and ${bellsData.length} bells`
    };
}
