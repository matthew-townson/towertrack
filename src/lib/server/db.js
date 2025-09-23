import mysql from 'mysql2/promise';
import { building } from '$app/environment';
const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

// connect
const connectionConfig = {
    host: DB_HOST,
    port: parseInt(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// init db
async function initialiseDatabase() {
    // skip initialisation during build
    if (building) {
        console.log('[ INFO ] Skipping database initialisation during build');
        return;
    }

    // debug: print connection config
    console.log('[ INFO ] Initialising database');
    const connection = await mysql.createConnection(connectionConfig);
    
    try {
        // if does not exist, create db
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
        // use the database
        await connection.query(`USE \`${DB_NAME}\``);
        
        // create user if does not exist
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`User\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`username\` VARCHAR(255) NOT NULL,
                    \`password\` VARCHAR(255) NOT NULL,
                    \`email\` VARCHAR(255) NOT NULL,
                    \`permission\` INTEGER NOT NULL DEFAULT 3,
                    \`otherNames\` TINYINT NOT NULL DEFAULT 0,
                    PRIMARY KEY (\`id\`),
                    UNIQUE KEY \`username\` (\`username\`),
                    UNIQUE KEY \`email\` (\`email\`),
                    INDEX \`idx_username\` (\`username\`)
                )
            `);
            console.log('[ INFO ] User table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create User table:', error.message);
        }

        // create user settings table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`UserSettings\` (
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`profileVisibility\` BOOLEAN NOT NULL DEFAULT 1,
                    \`dataVisibility\` BOOLEAN NOT NULL DEFAULT 1,
                    \`bellsPercent\` TINYINT NOT NULL DEFAULT 100,
                    \`exShort\` BOOL DEFAULT 1,
                    PRIMARY KEY (\`userId\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE
                )
            `);
            console.log(`[ INFO ] UserSettings table created successfully or already exists`);
        } catch (error) {
            console.error(`[ ERROR ] Failed to create UserSettings table: ${error.message}`);
        }

        // create user other names table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`OtherNames\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`Name\` VARCHAR(255) NOT NULL,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    INDEX \`idx_userId\` (\`userId\`)
                )
            `);
            console.log('[ INFO ] OtherNames table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create OtherNames table:', error.message);
        }

        // create tower data table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`Tower\` (
                    \`TowerID\` INTEGER UNSIGNED NOT NULL,
                    \`RingID\` INTEGER UNSIGNED,
                    \`Place\` VARCHAR(255),
                    \`Place2\` VARCHAR(255),
                    \`PlaceCL\` VARCHAR(255),
                    \`Dedicn\` VARCHAR(255),
                    \`BareDedicn\` VARCHAR(255),
                    \`AltName\` VARCHAR(255),
                    \`RingName\` VARCHAR(255),
                    \`Region\` VARCHAR(255),
                    \`County\` VARCHAR(255),
                    \`Country\` VARCHAR(255),
                    \`HistRegion\` VARCHAR(255),
                    \`ISO3166code\` VARCHAR(10),
                    \`Diocese\` VARCHAR(255),
                    \`Lat\` DECIMAL(10,7),
                    \`Long\` DECIMAL(10,7),
                    \`Bells\` INTEGER,
                    \`UR\` VARCHAR(10),
                    \`Semitones\` VARCHAR(50),
                    \`Wt\` DECIMAL(10,3),
                    \`Note\` VARCHAR(10),
                    \`GF\` VARCHAR(10),
                    \`ExtraInfo\` TEXT,
                    \`WebPage\` TEXT,
                    \`Affiliations\` TEXT,
                    \`Postcode\` VARCHAR(20),
                    \`Practice\` VARCHAR(255),
                    \`LGrade\` VARCHAR(10),
                    PRIMARY KEY (\`TowerID\`, \`RingID\`)
                )
            `);
            console.log('[ INFO ] Tower table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create Tower table:', error.message);
        }

        /*
            Critical for this to use TowerID + RingID as PK - in examples where there are two rings in the same tower, eg Bampton (ID 15240)
        */

        // create bells table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`Bell\` (
                    \`BellID\` INTEGER UNSIGNED NOT NULL,
                    \`TowerID\` INTEGER UNSIGNED NOT NULL,
                    \`RingID\` INTEGER UNSIGNED,
                    \`BellRole\` VARCHAR(50),
                    \`BellName\` VARCHAR(255),
                    \`WeightLbs\` INTEGER UNSIGNED,
                    \`WeightApprox\` BOOLEAN,
                    \`Note\` VARCHAR(10),
                    \`CastDate\` VARCHAR(20),
                    \`Listed\` BOOLEAN,
                    \`Founder\` VARCHAR(255),
                    \`FounderUncertain\` BOOLEAN,
                    \`Canons\` VARCHAR(50),
                    PRIMARY KEY (\`BellID\`),
                    INDEX \`idx_tower_ring\` (\`TowerID\`, \`RingID\`)
                )
            `);
            console.log('[ INFO ] Bell table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create Bell table:', error.message);
        }

        /*
            Note regarding bells table, reason why TowerID and RingID are not foreign keys is because some bells may reference Rings that are no longer in existence,
                due to modifications or otherwise.

            Use TowerID for as authoritative link between bell and tower, as ring is not always integral.

            (Bells also includes bells that are not part of FC rings - TODO: remove these from import)
        */

        // create BB performances table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`Performance\` (
                    \`PerformanceID\` INTEGER UNSIGNED NOT NULL,
                    \`Association\` VARCHAR(255),
                    \`TowerID\` INTEGER UNSIGNED,
                    \`RingID\` INTEGER UNSIGNED,
                    \`Place\` VARCHAR(255),
                    \`Dedication\` VARCHAR(255),
                    \`County\` VARCHAR(255),
                    \`TenorWeightLbs\` INTEGER UNSIGNED,
                    \`TenorKey\` VARCHAR(5),
                    \`Date\` DATE,
                    \`Duration\` VARCHAR(32),
                    \`Changes\` INTEGER,
                    \`Method\` VARCHAR(255),
                    \`Ringers\` JSON,
                    \`Timestamp\` TIMESTAMP,
                    \`Footnotes\` JSON,
                    PRIMARY KEY (\`PerformanceID\`),
                    INDEX \`idx_tower_ring\` (\`TowerID\`, \`RingID\`)
                )
            `);
            console.log('[ INFO ] Performance table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create Performance table:', error.message);
        }

        // create grabs table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`Grab\` (
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`towerID\` INTEGER UNSIGNED NOT NULL,
                    \`ringID\` INTEGER UNSIGNED,
                    \`dateGrabbed\` TINYINT,
                    \`monthGrabbed\` TINYINT,
                    \`yearGrabbed\` YEAR,
                    \`lastUpdated\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`userId\`, \`towerID\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    INDEX \`idx_user_grabs\` (\`userId\`),
                    INDEX \`idx_tower_grabs\` (\`towerID\`, \`ringID\`),
                    INDEX \`idx_date_grabbed\` (\`yearGrabbed\`, \`monthGrabbed\`, \`dateGrabbed\`)
                )
            `);
            console.log('[ INFO ] Grab table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create Grab table:', error.message);
        }

        // create grab bells table for tracking which bells were rung
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`GrabBell\` (
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`bellID\` INTEGER UNSIGNED NOT NULL,
                    \`bellRole\` VARCHAR(50) NOT NULL,
                    \`towerID\` INTEGER UNSIGNED NOT NULL,
                    \`ringID\` INTEGER UNSIGNED NOT NULL,
                    PRIMARY KEY (\`userId\`, \`bellID\`),
                    FOREIGN KEY (\`userId\`, \`towerID\`) 
                        REFERENCES \`Grab\`(\`userId\`, \`towerID\`) 
                        ON DELETE NO ACTION,
                    FOREIGN KEY (\`bellID\`)
                        REFERENCES \`Bell\`(\`BellID\`)
                        ON DELETE NO ACTION,
                    INDEX \`idx_bell_role\` (\`bellRole\`)
                )
            `);
            console.log('[ INFO ] GrabBell table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create GrabBell table:', error.message);
        }

        // create log table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`Log\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`type\` VARCHAR(10) NOT NULL,
                    \`timestamp\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`text\` TEXT NOT NULL,
                    PRIMARY KEY (\`id\`)
                )
            `);
            console.log(`[ INFO ] Log table created successfully or already exists`);
        } catch (error) {
            console.error(`[ ERROR ] Failed to create Log table: ${error.message}`);
        }

        // csv import log table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`CSVImportLog\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`filename\` VARCHAR(255) NOT NULL,
                    \`hash\` VARCHAR(64) NOT NULL,
                    \`timestamp\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`)
                )
            `);
            console.log('[ INFO ] CSVImportLog table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create CSVImportLog table:', error.message);
        }

        // optimise all tables
        try {
            console.log('[ INFO ] Attempt to optimise db tables')
            console.log('         ├ Optimising User table');
            await connection.query(`ANALYZE TABLE \`User\``);
            console.log('         ├ Optimising UserSettings table');
            await connection.query(`ANALYZE TABLE \`UserSettings\``);
            console.log('         ├ Optimising Tower table');
            await connection.query(`ANALYZE TABLE \`Tower\``);
            console.log('         ├ Optimising Bell table');
            await connection.query(`ANALYZE TABLE \`Bell\``);
            console.log('         ├ Optimising Performance table');
            await connection.query(`ANALYZE TABLE \`Performance\``);
            console.log('         ├ Optimising Grab table');
            await connection.query(`ANALYZE TABLE \`Grab\``);
            console.log('         ├ Optimising GrabBell table');
            await connection.query(`ANALYZE TABLE \`GrabBell\``);
            console.log('         ├ Optimising Log table');
            await connection.query(`ANALYZE TABLE \`Log\``);
            console.log('         └ Optimising CSVImportLog table');
            await connection.query(`ANALYZE TABLE \`CSVImportLog\``);
            console.log('[ SUCCESS ] Tables optimized successfully');
        } catch (error) {
            console.error('[ ERROR ] Failed to optimize tables:', error.message);
        }

        console.log('[ SUCCESS ] Database and tables initialisation completed');
    } catch (error) {
        console.error('[ ERROR ] Database initialisation error:', error);
    } finally {
        await connection.end();
    }
}

// pool connection
const pool = mysql.createPool({
    ...connectionConfig,
    database: DB_NAME
});

export { initialiseDatabase };
export default pool;
