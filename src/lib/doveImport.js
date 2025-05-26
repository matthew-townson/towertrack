import log from '$lib/log.js';
import pool from '$lib/db.js';
import fs from 'fs';

export async function importDoveData() {
	log.info('Starting import of Dove data');

	// Save csv data
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

	// Save csv data to files in "temp" directory
	const tempDir = 'dovedata/temp';
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, { recursive: true });
	}
	fs.writeFileSync(`${tempDir}/towers.csv`, towersCsv);
	fs.writeFileSync(`${tempDir}/bells.csv`, bellsCsv);
	log.info(`Saved towers.csv and bells.csv to ${tempDir}/`);

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

	// Compare csv data to files in archive directory, if same as fresh csvs, skip import
	log.info(`Comparing CSV data with archived data`);
	const archiveDir = 'dovedata/archive';
	if (!fs.existsSync(archiveDir)) {
		fs.mkdirSync(archiveDir, { recursive: true });
	}
	const archiveTowersFile = `${archiveDir}/towers.csv`;
	const archiveBellsFile = `${archiveDir}/bells.csv`;

	if (fs.existsSync(archiveTowersFile)) {
		const archiveTowersCsv = fs.readFileSync(archiveTowersFile, 'utf-8');
		const archiveTowersData = parseCSV(archiveTowersCsv);
		if (JSON.stringify(towersData) === JSON.stringify(archiveTowersData)) {
			log.info('No changes in towers data, skipping import.');
                // Delete temporary CSV files
                fs.unlinkSync(`${tempDir}/towers.csv`);
                fs.unlinkSync(`${tempDir}/bells.csv`);
                fs.rmdirSync(tempDir, { recursive: true });
                log.info('Deleted temporary CSV files');
			return {
				success: false,
				message: 'No changes in towers data, skipping import.'
			};
		}
	}

	// If different, overwrite database with new data
	log.info(`Importing ${towersData.length} tower records and ${bellsData.length} bell records into the database`);
	try {
		// Start transaction
		await pool.query('BEGIN');
		
		// Clear existing data
		log.info('Clearing existing bells and towers data');
		await pool.query('DELETE FROM Bell');
		await pool.query('DELETE FROM Tower');
		
		// Insert towers data
		log.info('Inserting towers data');
		for (const tower of towersData) {
			await pool.query('INSERT INTO Tower (`TowerID`, `RingID`, `Place`, `Place2`, `PlaceCL`, `BareDedicn`, `AltName`, `RingName`, `Region`, `County`, `Country`, `HistRegion`, `ISO3166code`, `Diocese`, `Lat`, `Long`, `Bells`, `UR`, `Semitones`, `Wt`, `Note`, `GF`, `ExtraInfo`, `WebPage`, `Affiliations`, `Postcode`, `LGrade`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
				tower.TowerID ? parseInt(tower.TowerID) : null,
				tower.RingID ? parseInt(tower.RingID) : null,
				tower.Place || null,
				tower.Place2 || null,
				tower.PlaceCL || null,
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
				tower.LGrade || null
			]);
		}
		
		// Insert bells data
		log.info('Inserting bells data');
		for (const bell of bellsData) {
			await pool.query('INSERT INTO Bell (`BellID`, `TowerID`, `RingID`, `BellRole`, `BellName`, `WeightLbs`, `WeightApprox`, `Note`, `CastDate`, `Listed`, `Founder`, `FounderUncertain`, `Canons`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
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
		}
		
		// Copy current CSV files to archive
		fs.copyFileSync(`${tempDir}/towers.csv`, archiveTowersFile);
		fs.copyFileSync(`${tempDir}/bells.csv`, archiveBellsFile);
		log.info('Archived current CSV files');

		// Delete temporary CSV files
        fs.unlinkSync(`${tempDir}/towers.csv`);
        fs.unlinkSync(`${tempDir}/bells.csv`);
        fs.rmdirSync(tempDir, { recursive: true });
		log.info('Deleted temporary CSV files');
		
		// Save current timestamp to indicate last import time to a txt file
		const lastImportTime = new Date().toISOString();
		fs.writeFileSync(`${archiveDir}/prevImport.txt`, lastImportTime);

		// Commit transaction
		await pool.query('COMMIT');
		log.info('Database import completed successfully');
		
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
