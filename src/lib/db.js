import mysql from 'mysql2/promise';
import { 
    DB_HOST, 
    DB_PORT, 
    DB_USER, 
    DB_PASSWORD, 
    DB_NAME 
} from '$env/static/private';

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
                    UNIQUE KEY \`email\` (\`email\`)
                )
            `);
            console.log('[ INFO ] User table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create User table:', error.message);
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
                    \`LGrade\` VARCHAR(10),
                    PRIMARY KEY (\`TowerID\`, \`RingID\`)
                )
            `);
            console.log('[ INFO ] Tower table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create Tower table:', error.message);
        }

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
                    PRIMARY KEY (\`BellID\`)
                )
            `);
            console.log('[ INFO ] Bell table created successfully or already exists');
        } catch (error) {
            console.error('[ ERROR ] Failed to create Bell table:', error.message);
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
