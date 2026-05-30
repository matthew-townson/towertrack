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
                    \`profileImage\` VARCHAR(255),
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
                    \`LGrade\` VARCHAR(50),
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
                        ON DELETE CASCADE,
                    FOREIGN KEY (\`bellID\`)
                        REFERENCES \`Bell\`(\`BellID\`)
                        ON DELETE CASCADE,
                    INDEX \`idx_bell_role\` (\`bellRole\`)
                )
            `);
            console.log('[ INFO ] GrabBell table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create GrabBell table:', error.message);
        }

        // create user list table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`UserList\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`name\` VARCHAR(255) NOT NULL,
                    \`description\` TEXT,
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    UNIQUE KEY \`unique_name_per_user\` (\`userId\`, \`name\`)
                )
            `);
            console.log('[ INFO ] UserList table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create UserList table:', error.message);
        }

        // create list member table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`ListMember\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`listId\` INTEGER UNSIGNED NOT NULL,
                    \`memberId\` INTEGER UNSIGNED NOT NULL,
                    \`addedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`listId\`) REFERENCES \`UserList\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`memberId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    UNIQUE KEY \`unique_member_per_list\` (\`listId\`, \`memberId\`)
                )
            `);
            console.log('[ INFO ] ListMember table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create ListMember table:', error.message);
        }

        // create user calendar table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`UserCalendar\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`name\` VARCHAR(100) NOT NULL,
                    \`colour\` VARCHAR(7) DEFAULT '#3788d8',
                    \`isPreset\` BOOLEAN DEFAULT FALSE,
                    \`presetType\` VARCHAR(50) DEFAULT NULL,
                    \`requireOrganise\` BOOLEAN DEFAULT FALSE,
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    UNIQUE KEY \`unique_user_calendar\` (\`userId\`, \`name\`)
                )
            `);
            console.log('[ INFO ] UserCalendar table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create UserCalendar table:', error.message);
        }

        // create calendar event table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`CalendarEvent\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`calendarId\` INTEGER UNSIGNED NOT NULL,
                    \`title\` VARCHAR(255) NOT NULL,
                    \`description\` TEXT,
                    \`location\` VARCHAR(255),
                    \`towerID\` INTEGER UNSIGNED DEFAULT NULL,
                    \`startDate\` DATETIME NOT NULL,
                    \`endDate\` DATETIME,
                    \`allDay\` BOOLEAN DEFAULT FALSE,
                    \`sourceEventId\` INTEGER UNSIGNED DEFAULT NULL,
                    \`status\` ENUM('confirmed', 'tentative', 'cancelled') DEFAULT 'confirmed',
                    \`recurrenceType\` ENUM('none', 'daily', 'weekly', 'monthly', 'monthly_nth', 'yearly') DEFAULT 'none',
                    \`recurrenceInterval\` TINYINT UNSIGNED DEFAULT 1,
                    \`recurrenceEndDate\` DATE DEFAULT NULL,
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`calendarId\`) REFERENCES \`UserCalendar\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`sourceEventId\`) REFERENCES \`CalendarEvent\`(\`id\`) ON DELETE CASCADE
                )
            `);
            console.log('[ INFO ] CalendarEvent table created successfully or already exists');

            // Add method and composition columns to CalendarEvent if they don't exist
            try {
                const [columns] = await connection.query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'CalendarEvent' AND COLUMN_NAME = 'method'
                `, [DB_NAME]);

                if (columns.length === 0) {
                    await connection.query(`
                        ALTER TABLE \`CalendarEvent\` 
                        ADD COLUMN \`method\` VARCHAR(255) NULL AFTER \`towerID\`,
                        ADD COLUMN \`composition\` VARCHAR(500) NULL AFTER \`method\`
                    `);
                    console.log('[ INFO ] Added method and composition columns to CalendarEvent');
                }
            } catch (migrationError) {
                console.error('[ ERROR ] Failed to add columns to CalendarEvent:', migrationError.message);
            }
        } catch (error) {
            console.error('[ ERROR ] Failed to create CalendarEvent table:', error.message);
        }

        // create calendar secret table for iCal links
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`CalendarSecret\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`userId\` INTEGER UNSIGNED NOT NULL UNIQUE,
                    \`secretKey\` VARCHAR(64) NOT NULL UNIQUE,
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    \`lastAccessed\` TIMESTAMP DEFAULT NULL,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE
                )
            `);
            console.log('[ INFO ] CalendarSecret table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create CalendarSecret table:', error.message);
        }

        // create event invitation table for organise feature
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`EventInvitation\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`eventId\` INTEGER UNSIGNED NOT NULL,
                    \`invitedUserId\` INTEGER UNSIGNED NULL,
                    \`guestName\` VARCHAR(100) NULL,
                    \`invitedBy\` INTEGER UNSIGNED NOT NULL,
                    \`status\` ENUM('pending', 'accepted', 'declined', 'maybe', 'guest') DEFAULT 'pending',
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    \`respondedAt\` TIMESTAMP DEFAULT NULL,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`eventId\`) REFERENCES \`CalendarEvent\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`invitedUserId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`invitedBy\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    UNIQUE KEY \`unique_event_invitation\` (\`eventId\`, \`invitedUserId\`)
                )
            `);
            console.log('[ INFO ] EventInvitation table created successfully or already exists');
            
            // Add guestName column if it doesn't exist (for existing tables)
            try {
                const [columns] = await connection.query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'EventInvitation' AND COLUMN_NAME = 'guestName'
                `, [DB_NAME]);
                
                if (columns.length === 0) {
                    await connection.query(`
                        ALTER TABLE \`EventInvitation\` 
                        ADD COLUMN \`guestName\` VARCHAR(100) NULL AFTER \`invitedUserId\`
                    `);
                    console.log('[ INFO ] Added guestName column to EventInvitation');
                }
                
                // Also make sure invitedUserId is nullable
                await connection.query(`
                    ALTER TABLE \`EventInvitation\` 
                    MODIFY COLUMN \`invitedUserId\` INTEGER UNSIGNED NULL
                `);
                
                // Add 'guest' to status ENUM if not present
                await connection.query(`
                    ALTER TABLE \`EventInvitation\` 
                    MODIFY COLUMN \`status\` ENUM('pending', 'accepted', 'declined', 'maybe', 'guest') DEFAULT 'pending'
                `);
            } catch (migrationError) {
                // Migration might fail if already applied, ignore
                console.log('[ INFO ] EventInvitation migration check completed');
            }
        } catch (error) {
            console.error('[ ERROR ] Failed to create EventInvitation table:', error.message);
        }

        // create notifications table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`Notification\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`type\` VARCHAR(50) NOT NULL,
                    \`title\` VARCHAR(255) NOT NULL,
                    \`message\` TEXT,
                    \`data\` JSON,
                    \`isRead\` BOOLEAN NOT NULL DEFAULT FALSE,
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    INDEX \`idx_user_read\` (\`userId\`, \`isRead\`),
                    INDEX \`idx_user_created\` (\`userId\`, \`createdAt\`)
                )
            `);
            console.log('[ INFO ] Notification table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create Notification table:', error.message);
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

        // create shared calendar table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`SharedCalendar\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`ownerId\` INTEGER UNSIGNED NOT NULL,
                    \`name\` VARCHAR(100) NOT NULL,
                    \`colour\` VARCHAR(7) DEFAULT '#3788d8',
                    \`secretKey\` VARCHAR(64) NOT NULL UNIQUE,
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`ownerId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    INDEX \`idx_owner\` (\`ownerId\`)
                )
            `);
            console.log('[ INFO ] SharedCalendar table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create SharedCalendar table:', error.message);
        }

        // create shared calendar member table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`SharedCalendarMember\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`sharedCalendarId\` INTEGER UNSIGNED NOT NULL,
                    \`userId\` INTEGER UNSIGNED NOT NULL,
                    \`role\` ENUM('editor', 'viewer') DEFAULT 'editor',
                    \`addedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`sharedCalendarId\`) REFERENCES \`SharedCalendar\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    UNIQUE KEY \`unique_member\` (\`sharedCalendarId\`, \`userId\`),
                    INDEX \`idx_user\` (\`userId\`)
                )
            `);
            console.log('[ INFO ] SharedCalendarMember table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create SharedCalendarMember table:', error.message);
        }

        // create shared calendar event table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`SharedCalendarEvent\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`sharedCalendarId\` INTEGER UNSIGNED NOT NULL,
                    \`createdBy\` INTEGER UNSIGNED NOT NULL,
                    \`title\` VARCHAR(255) NOT NULL,
                    \`description\` TEXT,
                    \`location\` VARCHAR(255),
                    \`towerID\` INTEGER UNSIGNED DEFAULT NULL,
                    \`startDate\` DATETIME NOT NULL,
                    \`endDate\` DATETIME,
                    \`allDay\` BOOLEAN DEFAULT FALSE,
                    \`status\` ENUM('confirmed', 'tentative', 'cancelled') DEFAULT 'confirmed',
                    \`recurrenceType\` ENUM('none', 'daily', 'weekly', 'monthly', 'monthly_nth', 'yearly') DEFAULT 'none',
                    \`recurrenceInterval\` TINYINT UNSIGNED DEFAULT 1,
                    \`recurrenceEndDate\` DATE DEFAULT NULL,
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`sharedCalendarId\`) REFERENCES \`SharedCalendar\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`createdBy\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    INDEX \`idx_calendar\` (\`sharedCalendarId\`),
                    INDEX \`idx_start_date\` (\`startDate\`)
                )
            `);
            console.log('[ INFO ] SharedCalendarEvent table created successfully or already exists');
            
            // Add method, composition, and coordinates columns to SharedCalendarEvent if they don't exist
            try {
                const [methodCol] = await connection.query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'SharedCalendarEvent' AND COLUMN_NAME = 'method'
                `, [DB_NAME]);
                
                if (methodCol.length === 0) {
                    await connection.query(`
                        ALTER TABLE \`SharedCalendarEvent\` 
                        ADD COLUMN \`method\` VARCHAR(255) NULL,
                        ADD COLUMN \`composition\` VARCHAR(255) NULL,
                        ADD COLUMN \`coordinates\` VARCHAR(100) NULL
                    `);
                    console.log('[ INFO ] Added method, composition, and coordinates columns to SharedCalendarEvent');
                }
            } catch (error) {
                console.error('[ ERROR ] Failed to add columns to SharedCalendarEvent:', error.message);
            }
            
            // Create SharedEventInvitation table
            try {
                await connection.query(`
                CREATE TABLE IF NOT EXISTS \`SharedEventInvitation\` (
                    \`id\` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
                    \`sharedEventId\` INTEGER UNSIGNED NOT NULL,
                    \`invitedUserId\` INTEGER UNSIGNED,
                    \`guestName\` VARCHAR(100),
                    \`invitedBy\` INTEGER UNSIGNED NOT NULL,
                    \`instanceDate\` DATE NOT NULL,
                    \`status\` ENUM('pending', 'accepted', 'declined', 'maybe') DEFAULT 'pending',
                    \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    \`respondedAt\` TIMESTAMP DEFAULT NULL,
                    PRIMARY KEY (\`id\`),
                    FOREIGN KEY (\`sharedEventId\`) REFERENCES \`SharedCalendarEvent\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`invitedUserId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    FOREIGN KEY (\`invitedBy\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
                    UNIQUE KEY \`unique_shared_invitation\` (\`sharedEventId\`, \`invitedUserId\`, \`instanceDate\`)
                )
            `);
                console.log('[ INFO ] SharedEventInvitation table created successfully or already exists');
            } catch (error) {
                console.error('[ ERROR ] Failed to create SharedEventInvitation table:', error.message);
            }
        } catch (error) {
            console.error('[ ERROR ] Failed to create SharedCalendarEvent table:', error.message);
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
            console.log('         ├ Optimising UserList table');
            await connection.query(`ANALYZE TABLE \`UserList\``);
            console.log('         ├ Optimising ListMember table');
            await connection.query(`ANALYZE TABLE \`ListMember\``);
            console.log('         ├ Optimising Log table');
            await connection.query(`ANALYZE TABLE \`Log\``);
            console.log('         ├ Optimising CSVImportLog table');
            await connection.query(`ANALYZE TABLE \`CSVImportLog\``);
            console.log('         ├ Optimising UserCalendar table');
            await connection.query(`ANALYZE TABLE \`UserCalendar\``);
            console.log('         ├ Optimising CalendarEvent table');
            await connection.query(`ANALYZE TABLE \`CalendarEvent\``);
            console.log('         ├ Optimising CalendarSecret table');
            await connection.query(`ANALYZE TABLE \`CalendarSecret\``);
            console.log('         ├ Optimising EventInvitation table');
            await connection.query(`ANALYZE TABLE \`EventInvitation\``);
            console.log('         ├ Optimising SharedCalendar table');
            await connection.query(`ANALYZE TABLE \`SharedCalendar\``);
            console.log('         ├ Optimising SharedCalendarMember table');
            await connection.query(`ANALYZE TABLE \`SharedCalendarMember\``);
            console.log('         └ Optimising SharedCalendarEvent table');
            await connection.query(`ANALYZE TABLE \`SharedCalendarEvent\``);
            console.log('[ SUCCESS ] Tables optimized successfully');
        } catch (error) {
            console.error('[ ERROR ] Failed to optimize tables:', error.message);
        }

        // Schema migrations for existing databases
        try {
            console.log('[ INFO ] Running schema migrations...');
            
            // Add requireOrganise column to UserCalendar if it doesn't exist
            const [columns] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'UserCalendar' 
                AND COLUMN_NAME = 'requireOrganise'
            `, [DB_NAME]);
            
            if (columns.length === 0) {
                await connection.query(`
                    ALTER TABLE \`UserCalendar\` 
                    ADD COLUMN \`requireOrganise\` BOOLEAN DEFAULT FALSE AFTER \`presetType\`
                `);
                console.log('[ INFO ] Added requireOrganise column to UserCalendar');
                
                // Update existing quarter_peal and peal presets to require organise
                await connection.query(`
                    UPDATE \`UserCalendar\` 
                    SET \`requireOrganise\` = TRUE 
                    WHERE \`presetType\` IN ('quarter_peal', 'peal')
                `);
                console.log('[ INFO ] Updated quarter_peal and peal presets to require organise');
            }
            
            // Add sourceEventId column to CalendarEvent if it doesn't exist
            const [sourceEventIdCol] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'CalendarEvent' 
                AND COLUMN_NAME = 'sourceEventId'
            `, [DB_NAME]);
            
            if (sourceEventIdCol.length === 0) {
                await connection.query(`
                    ALTER TABLE \`CalendarEvent\` 
                    ADD COLUMN \`sourceEventId\` INTEGER UNSIGNED DEFAULT NULL AFTER \`allDay\`,
                    ADD FOREIGN KEY (\`sourceEventId\`) REFERENCES \`CalendarEvent\`(\`id\`) ON DELETE CASCADE
                `);
                console.log('[ INFO ] Added sourceEventId column to CalendarEvent');
            }
            
            // Add status column to CalendarEvent if it doesn't exist
            const [statusCol] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'CalendarEvent' 
                AND COLUMN_NAME = 'status'
            `, [DB_NAME]);
            
            if (statusCol.length === 0) {
                await connection.query(`
                    ALTER TABLE \`CalendarEvent\` 
                    ADD COLUMN \`status\` ENUM('confirmed', 'tentative', 'cancelled') DEFAULT 'confirmed' AFTER \`sourceEventId\`
                `);
                console.log('[ INFO ] Added status column to CalendarEvent');
            }
            
            // Add recurrence columns to CalendarEvent if they don't exist
            const [recurrenceTypeCol] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'CalendarEvent' 
                AND COLUMN_NAME = 'recurrenceType'
            `, [DB_NAME]);
            
            if (recurrenceTypeCol.length === 0) {
                await connection.query(`
                    ALTER TABLE \`CalendarEvent\` 
                    ADD COLUMN \`recurrenceType\` ENUM('none', 'daily', 'weekly', 'monthly', 'monthly_nth', 'yearly') DEFAULT 'none' AFTER \`status\`,
                    ADD COLUMN \`recurrenceInterval\` TINYINT UNSIGNED DEFAULT 1 AFTER \`recurrenceType\`,
                    ADD COLUMN \`recurrenceEndDate\` DATE DEFAULT NULL AFTER \`recurrenceInterval\`
                `);
                console.log('[ INFO ] Added recurrence columns to CalendarEvent');
            }
            
            console.log('[ SUCCESS ] Schema migrations completed');
        } catch (error) {
            console.error('[ ERROR ] Failed to run schema migrations:', error.message);
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
