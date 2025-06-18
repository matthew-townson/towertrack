import { hash } from 'argon2';
import db from '$lib/db.js';

export async function initializeAdmin() {
    try {
        // Check if any admin users exist
        const [existingAdmin] = await db.execute(
            'SELECT id FROM User WHERE permission = ? LIMIT 1',
            [0] // Admin permission level
        );

        if (existingAdmin.length === 0) {
            console.log('No admin user found. Creating default admin...');
            
            const hashedPassword = await hash('AdminSetup455');
            
            await db.execute(
                'INSERT INTO User (username, email, password, permission, created_at) VALUES (?, ?, ?, ?, ?)',
                ['admin', 'admin@towertrack.local', hashedPassword, 0, new Date().toISOString()]
            );
            
            console.log('Admin user created successfully!');
            console.log('Username: admin');
            console.log('Password: AdminSetup455');
            console.log('⚠️  Please change the default password after first login!');
        }
    } catch (error) {
        console.error('Error initializing admin user:', error);
    }
}
