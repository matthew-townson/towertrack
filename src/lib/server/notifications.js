import db from '$lib/server/db.js';

export async function createNotification(userId, type, title, message, data = {}) {
    try {
        await db.query(`
            INSERT INTO Notification (userId, type, title, message, data)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, type, title, message, JSON.stringify(data)]);
    } catch (err) {
        console.error('Error creating notification:', err);
    }
}

export async function getAdminUserIds() {
    const [rows] = await db.query(`
        SELECT id
        FROM User
        WHERE permission = 0
        ORDER BY id ASC
    `);

    return rows.map(row => row.id);
}

export async function notifyAdmins(type, title, message, data = {}) {
    const adminIds = await getAdminUserIds();

    await Promise.all(adminIds.map(adminId => createNotification(adminId, type, title, message, data)));
}

export async function notifyEventInvitation(eventId, eventTitle, inviterId, inviterUsername, invitedUserIds) {
    for (const userId of invitedUserIds) {
        await createNotification(
            userId,
            'calendar_invitation',
            'New Event Invitation',
            `${inviterUsername} invited you to "${eventTitle}"`,
            { eventId, inviterId }
        );
    }
}

export async function notifyInvitationResponse(organizerId, responderUsername, eventTitle, status, eventId) {
    const statusText = status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'responded maybe to';
    await createNotification(
        organizerId,
        'invitation_response',
        'Invitation Response',
        `${responderUsername} ${statusText} your invitation to "${eventTitle}"`,
        { eventId, status }
    );
}
