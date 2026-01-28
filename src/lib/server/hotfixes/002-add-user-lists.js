/**
 * Hotfix 002: Add user lists and list members tables
 * 
 * Allows users to create and manage custom lists of other users
 * (e.g., "Strong ringers", "Friends", etc.)
 */

export async function applyHotfix(connection) {
    try {
        // Create UserList table
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
        console.log('[ INFO ] Hotfix 002: UserList table created');

        // Create ListMember table
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
        console.log('[ INFO ] Hotfix 002: ListMember table created');

        return true;
    } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('[ INFO ] Hotfix 002: User list tables already exist');
            return true;
        }
        console.warn('[ WARN ] Hotfix 002: Could not create user list tables:', error.message);
        return false;
    }
}
