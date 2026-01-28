/**
 * Hotfix 001: Add profileImage column to User table
 * 
 * This migration adds support for user profile images.
 * It adds a VARCHAR(255) column to store the profile image filename.
 */

export async function applyHotfix(connection) {
    try {
        await connection.query(`
            ALTER TABLE \`User\` ADD COLUMN \`profileImage\` VARCHAR(255)
        `);
        console.log('[ INFO ] Hotfix 001: profileImage column added to User table');
        return true;
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('[ DEBUG ] Hotfix 001: profileImage column already exists');
            return true;
        }
        console.warn('[ WARN ] Hotfix 001: Could not add profileImage column:', error.message);
        return false;
    }
}
