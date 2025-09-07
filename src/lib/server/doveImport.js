//import { json } from 'stream/consumers';
import log from '$lib/server/log.js';
import pool from '$lib/server/db.js';
import fs from 'fs';
import crypto from 'crypto';

export async function importDoveData() {
    log.info('Starting import of Dove data');

    // Fetch CSVs
    log.info('Fetching towers.csv and bells.csv from Dove website');
    const towers = await fetch('https://dove.cccbr.org.uk/towers.csv');
    const bells = await fetch('https://dove.cccbr.org.uk/bells.csv');

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

    // Check latest hashes in CSVImportLog
    const [towersLog] = await pool.query('SELECT hash FROM CSVImportLog WHERE filename = ? ORDER BY timestamp DESC LIMIT 1', ['towers.csv']);
    const [bellsLog] = await pool.query('SELECT hash FROM CSVImportLog WHERE filename = ? ORDER BY timestamp DESC LIMIT 1', ['bells.csv']);

    if (towersLog.length && towersLog[0].hash === towersHash && bellsLog.length && bellsLog[0].hash === bellsHash) {
        log.info('No changes in towers.csv or bells.csv, skipping import.');
        return {
            success: false,
            message: 'No changes in towers.csv or bells.csv, skipping import.'
        };
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

    // If different, overwrite database with new data
    log.info(`Importing ${towersData.length} tower records and ${bellsData.length} bell records into the database`);
    try {
        // Start transaction
        await pool.query('BEGIN');

        // Clear existing data
        log.info('Clearing existing bells and towers data');
        await pool.query('DELETE FROM Bell');
        await pool.query('DELETE FROM Tower');

        // Insert towers data, only import if RingType is full-circle ring
        const filteredTowersData = towersData.filter(tower => tower.RingType && tower.RingType.startsWith('Full-circle ring'));
        log.info('Inserting towers data');
        const batchSize = 500;
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
            await pool.query('INSERT INTO Tower (`TowerID`, `RingID`, `Place`, `Place2`, `PlaceCL`, `Dedicn`, `BareDedicn`, `AltName`, `RingName`, `Region`, `County`, `Country`, `HistRegion`, `ISO3166code`, `Diocese`, `Lat`, `Long`, `Bells`, `UR`, `Semitones`, `Wt`, `Note`, `GF`, `ExtraInfo`, `WebPage`, `Affiliations`, `Postcode`, `Practice`, `LGrade`) VALUES ?', [values]);
        }
        log.info(`Inserted ${filteredTowersData.length} towers into the database`);

        // Insert bells data
        log.info('Inserting bells data');
        for (let i = 0; i < bellsData.length; i += batchSize) {
            const batch = bellsData.slice(i, i + batchSize);
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
            await pool.query('INSERT INTO Bell (`BellID`, `TowerID`, `RingID`, `BellRole`, `BellName`, `WeightLbs`, `WeightApprox`, `Note`, `CastDate`, `Listed`, `Founder`, `FounderUncertain`, `Canons`) VALUES ?', [values]);
        }
        log.info(`Inserted ${bellsData.length} bells into the database`);

        // Commit transaction
        await pool.query('COMMIT');
        log.info(`Committing ${towersData.length} towers and ${bellsData.length} bells`);

        // Optimise tables
        log.info('Optimising Tower and Bell tables');
        await pool.query('OPTIMIZE TABLE Tower, Bell');
        log.info('Finished optimising tables');

        // Save new hashes to CSVImportLog
        await pool.query('INSERT INTO CSVImportLog (filename, hash) VALUES (?, ?)', ['towers.csv', towersHash]);
        await pool.query('INSERT INTO CSVImportLog (filename, hash) VALUES (?, ?)', ['bells.csv', bellsHash]);

        log.success(`Successfully imported ${towersData.length} towers and ${bellsData.length} bells`);

    } catch (error) {
        // Rollback transaction on error
        await pool.query('ROLLBACK');
        log.error(`Database import failed: ${error.message}`);
        throw error;
    }
    
    return {
        success: true,
        message: `Successfully imported ${towersData.length} towers and ${bellsData.length} bells`
    };
}
