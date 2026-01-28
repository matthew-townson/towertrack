import { json } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export async function GET({ url, locals }) {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const lat = parseFloat(url.searchParams.get('lat'));
    const lng = parseFloat(url.searchParams.get('lng'));
    const maxDistance = parseFloat(url.searchParams.get('maxDistance')) || 0.5; // default 0.5 km

    if (isNaN(lat) || isNaN(lng)) {
        return json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    try {
        // Get user's existing grabs to exclude
        const [userGrabs] = await db.query(
            `SELECT towerID, ringID FROM Grab WHERE userID = ?`,
            [locals.user.id]
        );
        const grabbedTowerIds = new Set(userGrabs.map(g => `${g.towerID}-${g.ringID}`));

        // Find nearest towers using Haversine formula approximation
        // Using a bounding box first for performance, then calculating actual distance
        const latDelta = maxDistance / 111.0; // rough km per degree latitude
        const lngDelta = maxDistance / (111.0 * Math.cos(lat * Math.PI / 180)); // adjust for longitude

        const [towers] = await db.query(
            `SELECT TowerID, RingID, Place, Dedicn, County, Country, Bells, UR, Wt, Lat, Long,
                    (
                        6371 * acos(
                            cos(radians(?)) * cos(radians(Lat)) * cos(radians(\`Long\`) - radians(?)) +
                            sin(radians(?)) * sin(radians(Lat))
                        )
                    ) AS distance
             FROM Tower
             WHERE Lat BETWEEN ? AND ?
               AND \`Long\` BETWEEN ? AND ?
               AND Lat IS NOT NULL
               AND \`Long\` IS NOT NULL
             HAVING distance <= ?
             ORDER BY distance ASC
             LIMIT 10`,
            [
                lat, lng, lat,
                lat - latDelta, lat + latDelta,
                lng - lngDelta, lng + lngDelta,
                maxDistance
            ]
        );

        // Filter out already grabbed towers
        const availableTowers = towers.filter(t => !grabbedTowerIds.has(`${t.TowerID}-${t.RingID}`));

        if (availableTowers.length === 0) {
            return json({ 
                found: false, 
                message: 'No ungrabbed towers found nearby',
                nearestGrabbed: towers.length > 0 ? towers[0] : null
            });
        }

        const nearest = availableTowers[0];
        return json({
            found: true,
            tower: nearest,
            distance: nearest.distance,
            distanceMeters: Math.round(nearest.distance * 1000)
        });

    } catch (error) {
        console.error('Error finding nearest tower:', error);
        return json({ error: 'Failed to find nearest tower' }, { status: 500 });
    }
}
