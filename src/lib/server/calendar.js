// Calendar utilities - preset definitions and helper functions

// Preset calendar definitions
export const PRESET_CALENDARS = [
    { name: 'Practice', colour: '#22c55e', presetType: 'practice', requireOrganise: false },
    { name: 'Quarter Peal', colour: '#f59e0b', presetType: 'quarter_peal', requireOrganise: true },
    { name: 'Peal', colour: '#ef4444', presetType: 'peal', requireOrganise: true },
    { name: 'Grab', colour: '#06b6d4', presetType: 'grab', requireOrganise: false }
];

// Function to ensure user has preset calendars
export async function ensurePresetCalendars(connection, userId) {
    for (const preset of PRESET_CALENDARS) {
        await connection.query(`
            INSERT IGNORE INTO UserCalendar (userId, name, colour, isPreset, presetType, requireOrganise)
            VALUES (?, ?, ?, TRUE, ?, ?)
        `, [userId, preset.name, preset.colour, preset.presetType, preset.requireOrganise]);
    }
}
