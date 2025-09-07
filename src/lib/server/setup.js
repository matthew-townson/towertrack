import { hash } from 'argon2';
import db from '$lib/server/db.js';
import log from '$lib/server/log.js';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

export async function initializeAdmin() {
    try {
        // Check if any admin users exist
        const [existingAdmin] = await db.execute(
            'SELECT id FROM User WHERE permission = 0 LIMIT 1'
        );

        if (existingAdmin.length === 0) {
            log.info('No admin user found. Creating admin...');

            // Check if user has entered their own username/email
            let adminUsername, adminEmail;
            if (!ADMIN_USERNAME || !ADMIN_EMAIL) {
                log.info('No custom username/email, using default');
                adminUsername = 'admin';
                adminEmail = 'admin@towertrack.local';
            } else {
                log.info('Custom username and email provided');
                adminUsername = ADMIN_USERNAME;
                adminEmail = ADMIN_EMAIL;
            }

            // Set a random password
            const randomPassword = Math.random().toString(36).substring(2, 10);

            const hashedPassword = await hash(randomPassword);

            const [result] = await db.execute(
                'INSERT INTO User (username, email, password, permission) VALUES (?, ?, ?, ?)',
                [adminUsername, adminEmail, hashedPassword, 0]
            );
            await db.execute('INSERT INTO UserSettings (userId) VALUES (?)', [result.insertId]);

            log.success('Admin user created successfully!');
            log.info(`Username: ${adminUsername}`);
            log.info(`Password: ${randomPassword}`);
            log.warn('⚠️  Please change the default password after first login!');
        }
    } catch (error) {
        console.error('Error initializing admin user:', error);
    }
}
