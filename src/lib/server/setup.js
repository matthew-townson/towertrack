import { hash } from 'argon2';
import db from '$lib/server/db.js';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

export async function initializeAdmin() {
    try {
        // Check if any admin users exist
        const [existingAdmin] = await db.execute(
            'SELECT id FROM User WHERE permission = 0 LIMIT 1'
        );

        if (existingAdmin.length === 0) {
            console.log('No admin user found. Creating admin...');

            // Check if user has entered their own username/email
            let adminUsername, adminEmail;
            if (!ADMIN_USERNAME || !ADMIN_EMAIL) {
                adminUsername = 'admin';
                adminEmail = 'admin@towertrack.local';
            } else {
                adminUsername = ADMIN_USERNAME;
                adminEmail = ADMIN_EMAIL;
            }

            // Set a random password
            const randomPassword = Math.random().toString(36).substring(2, 10);

            const hashedPassword = await hash(randomPassword);

            await db.execute(
                'INSERT INTO User (username, email, password, permission) VALUES (?, ?, ?, ?)',
                [adminUsername, adminEmail, hashedPassword, 0]
            );
            
            console.log('Admin user created successfully!');
            console.log(`Username: ${adminUsername}`);
            console.log(`Password: ${randomPassword}`);
            console.log('⚠️  Please change the default password after first login!');
        }
    } catch (error) {
        console.error('Error initializing admin user:', error);
    }
}
