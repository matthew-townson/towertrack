<script>
    import { onMount } from 'svelte';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    
    export let data;
    
    let mapContainer;
    let map;
    let allMarkers = [];
    let displayLimit = 200;
    let currentlyDisplayed = 0;
    let userLocationMarker = null;
    let isTrackingLocation = false;
    let watchId = null;
    let isProgrammaticMove = false;
    
    function convertToHundredweight(weight) {
        if (!weight) return 'Unknown';
        const weightValue = parseFloat(weight);
        
        if (isNaN(weightValue)) return 'Unknown';

        const totalPounds = Math.round(weightValue);
        const hundredweight = Math.floor(totalPounds / 112); // 1 British hundredweight = 112 pounds
        const remainingAfterCwt = totalPounds % 112;
        const quarters = Math.floor(remainingAfterCwt / 28); // 1 quarter = 28 pounds
        const pounds = remainingAfterCwt % 28;

        if (hundredweight > 0) {
            return `${hundredweight}-${quarters}-${pounds}`;
        } else {
            let result = '';
            if (quarters > 0) result += `${quarters}-`;
            if (pounds > 0 || result === '') result += `${pounds}`;
            return result.trim();
        }
    }

    function toggleLocationTracking() {
        if (!navigator.geolocation) {
            console.warn('Geolocation is not supported by this browser.');
            return;
        }

        if (!map) {
            console.warn('Map not initialized yet.');
            return;
        }

        if (isTrackingLocation) {
            // Stop tracking
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
            isTrackingLocation = false;
        } else {
            // Start tracking
            isTrackingLocation = true;
            
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    if (!isTrackingLocation) return; // Check if still tracking
                    
                    const { latitude, longitude } = position.coords;
                    const currentZoom = map.getZoom();
                    const minZoom = 10; // Minimum zoom level for location tracking
                    
                    // Set flag to indicate programmatic move
                    isProgrammaticMove = true;
                    
                    // Move map to user location, zoom in if current zoom is too low
                    const targetZoom = currentZoom < minZoom ? minZoom : currentZoom;
                    map.setView([latitude, longitude], targetZoom);
                    
                    // Reset flag after a short delay
                    setTimeout(() => {
                        isProgrammaticMove = false;
                    }, 100);
                    
                    // Update user location marker
                    if (userLocationMarker) {
                        map.removeLayer(userLocationMarker);
                    }
                    
                    userLocationMarker = window.L.marker([latitude, longitude], {
                        icon: window.L.divIcon({
                            className: 'user-location-marker',
                            html: '<div class="user-location-dot"></div>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(map);
                    
                    userLocationMarker.bindPopup('<div class="user-popup"><h4>Your Location</h4></div>');
                    
                    // Update displayed towers around new location
                    updateDisplayedTowers();
                },
                (error) => {
                    console.warn('Geolocation error:', error.message);
                    isTrackingLocation = false;
                    if (watchId) {
                        navigator.geolocation.clearWatch(watchId);
                        watchId = null;
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
    }
    
    function getUserLocation() {
        if (!navigator.geolocation) {
            console.warn('Geolocation is not supported by this browser.');
            return;
        }

        if (!map) {
            console.warn('Map not initialized yet.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const currentZoom = map.getZoom();
                const minZoom = 10; // Minimum zoom level for location centering
                
                // Centre map on user location, zoom in if current zoom is too low
                const targetZoom = currentZoom < minZoom ? minZoom : currentZoom;
                map.setView([latitude, longitude], targetZoom);
                
                // Add user location marker
                if (userLocationMarker) {
                    map.removeLayer(userLocationMarker);
                }
                
                userLocationMarker = window.L.marker([latitude, longitude], {
                    icon: window.L.divIcon({
                        className: 'user-location-marker',
                        html: '<div class="user-location-dot"></div>',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);
                
                userLocationMarker.bindPopup('<div class="user-popup"><h4>Your Location</h4></div>');
                
                // Update displayed towers around new location
                updateDisplayedTowers();
            },
            (error) => {
                console.warn('Geolocation error:', error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
    
    function updateDisplayedTowers() {
        if (!map) return;
        
        // Clear existing markers
        allMarkers.forEach(marker => {
            map.removeLayer(marker);
        });
        allMarkers = [];
        
        const centre = map.getCenter();
        
        // Calculate distance from centre for each tower and sort by distance
        const towersWithDistance = data.towers
            .filter(tower => tower.Lat && tower.Long)
            .map(tower => {
                const distance = centre.distanceTo([tower.Lat, tower.Long]);
                return { ...tower, distance };
            })
            .sort((a, b) => a.distance - b.distance);
        
        // Take the closest towers up to the display limit
        const towersToShow = towersWithDistance.slice(0, displayLimit);
        
        towersToShow.forEach(tower => {
            const marker = window.L.marker([tower.Lat, tower.Long]).addTo(map);
            
            // Convert weight to hundredweight format
            tower.Wt = convertToHundredweight(tower.Wt);

            // Create popup content
            const popupContent = `
                <div class="tower-popup">
                    <h4><strong><a href="https://dove.cccbr.org.uk/tower/${tower.TowerID}" target="_blank">${tower.Place}, ${tower.Dedicn || 'Unknown Dedication'}</a></strong></h4>
                    <p>${tower.County || 'Unknown'}</br>
                    <strong>${tower.Bells || 'Unknown'}</strong>, ${tower.Wt || ''} in ${tower.Note || ''}</p>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            allMarkers.push(marker);
        });
        
        currentlyDisplayed = allMarkers.length;
    }
    
    onMount(async () => {
        // Dynamically import Leaflet to avoid SSR issues
        const L = await import('leaflet');
        window.L = L; // Make L available globally for updateDisplayedTowers
        
        // Initialize the map
        map = L.map(mapContainer).setView([52.0, 0.0], 6); // Centre on UK
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Try to get user location on load
        getUserLocation();
        
        // Initial display of towers
        updateDisplayedTowers();
        
        // Update markers when map is moved and cancel tracking if user moves manually
        map.on('movestart', () => {
            if (isTrackingLocation && !isProgrammaticMove) {
                // Cancel tracking mode if user manually moves the map
                isTrackingLocation = false;
                if (watchId) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }
            }
        });
        
        map.on('moveend', updateDisplayedTowers);
    });
    
    $: if (map && displayLimit) {
        updateDisplayedTowers();
    }
</script>

<svelte:head>
    <title>Tower Map | towertracker</title>
    <meta name="description" content="Interactive map showing bell tower locations"/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
          crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" 
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" 
            crossorigin=""></script>
</svelte:head>

<Header user={data.user} />

<main>
    <h1>Tower Map</h1>
    
    {#if data.error}
        <div class="error">
            <h3>❗Error</h3>
            <p>{data.error}</p>
        </div>
    {:else}
        <div class="map-controls">
            <div class="map-info">
                <p><strong>Showing {currentlyDisplayed} of {data.towers.length} towers</strong> with location data</p>
            </div>
            
            <div class="limit-controls">
                <label for="displayLimit">Number of towers to display: {displayLimit}</label>
                <input 
                    type="range" 
                    id="displayLimit" 
                    bind:value={displayLimit}
                    min="10"
                    max={Math.min(data.towers.length, 5000)}
                    step="10"
                    class="tower-slider"
                />
                <div class="slider-labels">
                    <span>10</span>
                    <span>{Math.min(data.towers.length, 5000)}</span>
                </div>
            </div>
        </div>
        
        <div class="map-container">
            <div bind:this={mapContainer} class="map"></div>
            <button 
                class="floating-location-btn {isTrackingLocation ? 'tracking' : ''}" 
                on:click={toggleLocationTracking} 
                title={isTrackingLocation ? 'Stop Following Location' : 'Follow My Location'} 
                aria-label={isTrackingLocation ? 'Stop Following Location' : 'Follow My Location'}
            >
                <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <use href="/assets/image/location.svg"></use>
                </svg>
            </button>
        </div>
    {/if}
</main>

<Footer />

<style>
    .map-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        gap: 1rem;
    }
    
    .map-info {
        background: none;
        padding: 0;
        margin: 0;
    }
    
    .limit-controls {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5rem;
    }
    
    .limit-controls label {
        font-weight: bold;
        color: #495057;
    }
    
    .tower-slider {
        width: 200px;
        height: 6px;
        border-radius: 3px;
        background: #ddd;
        outline: none;
        -webkit-appearance: none;
    }
    
    .tower-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #007bff;
        cursor: pointer;
    }
    
    .tower-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #007bff;
        cursor: pointer;
        border: none;
    }
    
    .slider-labels {
        display: flex;
        justify-content: space-between;
        width: 200px;
        font-size: 0.8rem;
        color: #6c757d;
    }
    
    .map-container {
        width: 100%;
        height: calc(100vh - 400px);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 2rem;
        min-height: 400px;
        position: relative;
    }
    
    .floating-location-btn {
        position: absolute;
        bottom: 20px;
        left: 10px;
        width: 40px;
        height: 40px;
        background: white;
        border: 2px solid rgba(0,0,0,0.2);
        border-radius: 4px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        color: #007bff;
    }
    
    .floating-location-btn:hover {
        background: #f8f9fa;
        box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        color: #0056b3;
    }
    
    .floating-location-btn:active {
        transform: scale(0.95);
    }
    
    .floating-location-btn.tracking {
        background: #007bff;
        color: white;
        border-color: #0056b3;
    }
    
    .floating-location-btn.tracking:hover {
        background: #0056b3;
        color: white;
    }
    
    .map {
        width: 100%;
        height: 100%;
    }
    
    .error {
        background: #f8d7da;
        padding: 1rem;
        border-radius: 6px;
        border-left: 4px solid #dc3545;
        margin-bottom: 1rem;
    }
    
    .error h3 {
        margin-top: 0;
        margin-bottom: 0.5rem;
        color: #721c24;
    }
    
    .error p {
        margin-bottom: 0;
        color: #721c24;
    }
    
    :global(.tower-popup h4) {
        margin-top: 0;
        margin-bottom: 0.5rem;
        color: #333;
    }
    
    :global(.tower-popup p) {
        margin: 0.25rem 0;
        font-size: 0.9rem;
    }
    
    :global(.user-location-marker) {
        background: transparent;
        border: none;
    }
    
    :global(.user-location-dot) {
        width: 20px;
        height: 20px;
        background-color: #007bff;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    :global(.user-popup h4) {
        margin-top: 0;
        margin-bottom: 0.5rem;
        color: #007bff;
        font-weight: bold;
    }
    
    @media (max-width: 768px) {
        .map-controls {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .limit-controls {
            align-items: flex-start;
            width: 100%;
        }
        
        .tower-slider,
        .slider-labels {
            width: 100%;
        }
        
        .map-container {
            height: calc(100vh - 450px);
            min-height: 300px;
        }
        
        .floating-location-btn {
            bottom: 15px;
            left: 10px;
            width: 36px;
            height: 36px;
        }
        
        .floating-location-btn svg {
            width: 16px;
            height: 16px;
        }
    }
</style>
