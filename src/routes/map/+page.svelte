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
    let isProgramMove = false;
    let sidebarOpen = false;
    
    let bellsFilter = 3;
    let isMinimumBells = true;
    
    let showUnringable = true;
    
    let closestTower = null;
    let userLocation = null;
    
    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }
    
    function generatePinSVG(bellNumber, options = {}) {
        const colors = [
            '#999999', '#aa4488', '#fd99cc', '#ff8800', '#face27', '#039b16', '#44ffaa', '#fa1d1a',
            '#aa4488', '#2f27ca', '#aaaa44', '#000000', '#aa8844', '#ff8888', '#88ff88', '#680098'
        ];
        
        const color = colors[bellNumber - 1] || '#888888';
        const isUnringable = options.unringable || false;
        const isGrabbed = options.grabbed || false;
        const isCircled = options.circled || false;
        const isQuartered = options.quartered || false;
        const isPealed = options.pealed || false;
        
        const scaleFactor = 1.4;
        const baseWidth = Math.round((isCircled ? 26 : 25) * scaleFactor);
        const baseHeight = Math.round((isGrabbed ? (isCircled ? 51 : 50) : (isCircled ? 42 : 41)) * scaleFactor);
        const viewBoxOffset = isCircled ? '-0.5 -0.5' : '0 0';
        const viewBoxWidth = isCircled ? 26 : 25;
        const viewBoxHeight = isGrabbed ? (isCircled ? 51 : 50) : (isCircled ? 42 : 41);
        
        const height = isGrabbed ? 50 : 41;
        const pinOffset = isGrabbed ? 9 : 0;
        const circleY = isGrabbed ? 21.5 : 12.5;
        const textY = isGrabbed ? 26 : 17;
        
        const strokeColor = isCircled ? '#FF6600' : 'none';
        const strokeWidth = isCircled ? 2 : 0;
        const strokeAttr = isCircled ? ` stroke="${strokeColor}" stroke-width="${strokeWidth}"` : '';
        
        let svg = `<svg width="${baseWidth}" height="${baseHeight}" viewBox="${viewBoxOffset} ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">`;
        
        if (isQuartered || isPealed) {
            svg += '<defs>';
            if (isQuartered) {
                svg += `<pattern id="dots_${bellNumber}_${Math.random().toString(36).substr(2, 9)}" patternUnits="userSpaceOnUse" width="4" height="4">
                    <circle cx="2" cy="2" r="1" fill="#ffffff" opacity="0.6"/></pattern>
                    <clipPath id="leftHalf_${bellNumber}_${Math.random().toString(36).substr(2, 9)}"><rect x="0" y="${pinOffset}" width="12.5" height="41"/></clipPath>`;
            }
            if (isPealed) {
                svg += `<pattern id="stripes_${bellNumber}_${Math.random().toString(36).substr(2, 9)}" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                    <rect width="2" height="4" fill="#ffffff" opacity="0.6"/></pattern>
                    <clipPath id="rightHalf_${bellNumber}_${Math.random().toString(36).substr(2, 9)}"><rect x="12.5" y="${pinOffset}" width="12.5" height="41"/></clipPath>`;
            }
            svg += '</defs>';
        }
        
        if (isGrabbed) {
            svg += '<path d="M8 3 L12 7 L17 2" stroke="#00aa00" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        
        svg += `<path d="M12.5 ${pinOffset}C5.6 ${pinOffset} 0 ${5.6 + pinOffset} 0 ${12.5 + pinOffset}C0 ${19.6 + pinOffset} 12.5 ${41 + pinOffset} 12.5 ${41 + pinOffset}S25 ${19.6 + pinOffset} 25 ${12.5 + pinOffset}C25 ${5.6 + pinOffset} 19.4 ${pinOffset} 12.5 ${pinOffset}Z" fill="${color}"${strokeAttr}/>`;
        
        const centerColor = isUnringable ? '#888888' : color;
        svg += `<circle cx="12.5" cy="${circleY}" r="10" fill="${centerColor}"/>`;
        
        if (isUnringable) {
            const fontSize = bellNumber >= 10 ? 10 : 12;
            const urFontSize = 6;
            const numberY = textY - 2;
            const urY = textY + 4;
            
            svg += `<text x="12.5" y="${numberY}" text-anchor="middle" fill="black" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="bold">${bellNumber}</text>`;
            svg += `<text x="12.5" y="${urY}" text-anchor="middle" fill="black" font-family="Inter, sans-serif" font-size="${urFontSize}" font-weight="normal">UR</text>`;
        } else {
            const fontSize = bellNumber >= 10 ? 12 : 14;
            svg += `<text x="12.5" y="${textY}" text-anchor="middle" fill="white" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="bold">${bellNumber}</text>`;
        }
        
        svg += '</svg>';
        return svg;
    }
    
    function convertToHundredweight(weight) {
        if (!weight) return 'Unknown';
        const weightValue = parseFloat(weight);
        
        if (isNaN(weightValue)) return 'Unknown';

        const totalPounds = Math.round(weightValue);
        const hundredweight = Math.floor(totalPounds / 112);
        const remainingAfterCwt = totalPounds % 112;
        const quarters = Math.floor(remainingAfterCwt / 28);
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
            alert('Geolocation is not supported by this browser.');
            return;
        }

        if (!map) {
            alert('Map not initialized yet.');
            return;
        }

        if (isTrackingLocation) {
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
            isTrackingLocation = false;
        } else {
            isTrackingLocation = true;
            
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    if (!isTrackingLocation) return;
                    
                    const { latitude, longitude } = position.coords;
                    
                    userLocation = { lat: latitude, lng: longitude };
                    
                    const currentZoom = map.getZoom();
                    const minZoom = 10;
                    
                    isProgramMove = true;
                    
                    const targetZoom = currentZoom < minZoom ? minZoom : currentZoom;
                    map.setView([latitude, longitude], targetZoom);
                    
                    setTimeout(() => {
                        isProgramMove = false;
                    }, 100);
                    
                    if (userLocationMarker) {
                        userLocationMarker.setLatLng([latitude, longitude]);
                    } else {
                        userLocationMarker = window.L.marker([latitude, longitude], {
                            icon: window.L.divIcon({
                                className: 'user-location-marker',
                                html: '<div class="user-location-dot"></div>',
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            })
                        }).addTo(map);
                        
                        userLocationMarker.bindPopup('<div class="user-popup"><h4>Your Location</h4></div>');
                    }
                    
                    if (Math.abs(Date.now() - lastTowerUpdate) > 5000) {
                        updateDisplayedTowers();
                        lastTowerUpdate = Date.now();
                    }
                },
                (error) => {
                    console.warn('Geolocation error:', error.message);
                    alert(`Location error: ${error.message}`);
                    isTrackingLocation = false;
                    if (watchId) {
                        navigator.geolocation.clearWatch(watchId);
                        watchId = null;
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 30000,
                    maximumAge: 1000
                }
            );
        }
    }
    
    let lastTowerUpdate = 0;

    function getUserLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
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
                const minZoom = 10;
                
                userLocation = { lat: latitude, lng: longitude };
                
                const targetZoom = currentZoom < minZoom ? minZoom : currentZoom;
                map.setView([latitude, longitude], targetZoom);
                
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
                
                updateDisplayedTowers();
            },
            (error) => {
                console.warn('Geolocation error:', error.message);
                alert(`Location error: ${error.message}. Please check your location permissions.`);
                userLocation = null;
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );
    }
    
    function updateDisplayedTowers() {
        if (!map) return;
        
        allMarkers.forEach(marker => {
            map.removeLayer(marker);
        });
        allMarkers = [];
        
        const centre = map.getCenter();
        
        const towersWithDistance = data.towers
            .filter(tower => tower.Lat && tower.Long)
            .filter(tower => {
                if (!tower.Bells) return false;
                const bellCount = parseInt(tower.Bells);
                if (isNaN(bellCount)) return false;
                
                if (isMinimumBells) {
                    return bellCount >= bellsFilter;
                } else {
                    return bellCount === bellsFilter;
                }
            })
            .filter(tower => {
                const isUnringable = tower.UR === 1 || tower.UR === '1';
                if (isUnringable && !showUnringable) return false;
                return true;
            })
            .map(tower => {
                const distance = centre.distanceTo([tower.Lat, tower.Long]);
                return { ...tower, distance };
            })
            .sort((a, b) => a.distance - b.distance);
        
        if (userLocation) {
            const towersFromUserLocation = data.towers
                .filter(tower => tower.Lat && tower.Long)
                .filter(tower => {
                    if (!tower.Bells) return false;
                    const bellCount = parseInt(tower.Bells);
                    if (isNaN(bellCount)) return false;
                    
                    if (isMinimumBells) {
                        return bellCount >= bellsFilter;
                    } else {
                        return bellCount === bellsFilter;
                    }
                })
                .filter(tower => {
                    const isUnringable = tower.UR === 1 || tower.UR === '1';
                    if (isUnringable && !showUnringable) return false;
                    return true;
                })
                .map(tower => {
                    const userLatLng = window.L.latLng(userLocation.lat, userLocation.lng);
                    const towerLatLng = window.L.latLng(tower.Lat, tower.Long);
                    const distance = userLatLng.distanceTo(towerLatLng);
                    return { ...tower, distance };
                })
                .sort((a, b) => a.distance - b.distance);
            
            closestTower = towersFromUserLocation.length > 0 ? towersFromUserLocation[0] : null;
        } else {
            closestTower = null;
        }
        
        const towersToShow = towersWithDistance.slice(0, displayLimit);
        
        towersToShow.forEach(tower => {
            const bellCount = parseInt(tower.Bells) || 8;
            const isUnringable = tower.UR === 1 || tower.UR === '1';
            
            const pinSVG = generatePinSVG(bellCount, { 
                unringable: isUnringable,
                grabbed: tower.grabbed || false,
                circled: tower.circled || false,
                quartered: tower.quartered || false,
                pealed: tower.pealed || false
            });
            
            const customIcon = window.L.divIcon({
                className: 'tower-pin',
                html: pinSVG,
                iconSize: [35, 57],
                iconAnchor: [17.5, 57],
                popupAnchor: [0, -57]
            });
            
            const marker = window.L.marker([tower.Lat, tower.Long], { icon: customIcon }).addTo(map);
            
            tower.Wt = convertToHundredweight(tower.Wt);

            const popupContent = `
                <div class="tower-popup">
                    <h4><strong>
                        <a href="https://dove.cccbr.org.uk/tower/${tower.TowerID}" target="_blank" style="${isUnringable ? 'color: red;' : ''}">
                            ${isUnringable ? 'U/R' : ''} ${tower.Place}${tower.Dedicn ? `, ${tower.Dedicn}` : ''}
                        </a>
                    </strong></h4>
                    <p style="${isUnringable ? 'color: red;' : ''}">${tower.County || tower.Country}</br>
                        <strong style="color:${isUnringable ? 'red' : pinSVG.match(/fill="([^"]+)"/)?.[1] || '#888'}">
                            ${tower.Bells || ''}
                        </strong>, ${tower.Wt || ''} in ${tower.Note || ''}
                        ${tower.Practice ? `<br>${tower.Practice}` : ''}
                    </p>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            allMarkers.push(marker);
        });
        
        currentlyDisplayed = allMarkers.length;
    }
    
    $: filteredTowerCount = data.towers
        .filter(tower => tower.Lat && tower.Long)
        .filter(tower => {
            if (!tower.Bells) return false;
            const bellCount = parseInt(tower.Bells);
            if (isNaN(bellCount)) return false;
            
            if (isMinimumBells) {
                return bellCount >= bellsFilter;
            } else {
                return bellCount === bellsFilter;
            }
        })
        .filter(tower => {
            const isUnringable = tower.UR === 1 || tower.UR === '1';
            if (isUnringable && !showUnringable) return false;
            return true;
        }).length;
    
    onMount(async () => {
        const L = await import('leaflet');
        window.L = L;
        
        map = L.map(mapContainer).setView([52.0, 0.0], 6);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        getUserLocation();
        
        updateDisplayedTowers();
        
        map.on('movestart', () => {
            if (isTrackingLocation && !isProgramMove) {
                isTrackingLocation = false;
                if (watchId) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }
            }
        });
        
        map.on('moveend', updateDisplayedTowers);
    });
    
    $: if (map && (displayLimit || bellsFilter || isMinimumBells || showUnringable)) {
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
    <link rel="stylesheet" href="/assets/css/map.css">
</svelte:head>

<Header user={data.user} />

<main class="section map-page" style="padding:0; margin:0; flex:1 1 auto;">
    {#if data.error}
        <div class="notification is-danger">
            <h3 class="title is-5">❗Error</h3>
            <p>{data.error}</p>
        </div>
    {:else}
        <div class="box p-0 map-wrapper" style="height:100%; min-height:0; margin:0;">
            <div class="map-container" style="width:100%; height:100%; position:relative;">
                <div bind:this={mapContainer} class="map" style="width:100%; height:100%; min-height:0;"></div>
                
                <div class="notification is-info tower-count-display py-2 px-3 mb-0">
                    <p>
                        <strong>Showing {currentlyDisplayed} of {filteredTowerCount} towers</strong> that match the filter (from a total of {data.towers.length} towers)
                    </p>
                </div>
                
                {#if userLocation && closestTower}
                    <div class="card closest-tower-display has-background-light">
                        <div class="card-content py-2 px-3">
                            <h4 class="title is-6 mb-2">Closest Tower:</h4>
                            <p>
                                <strong>
                                    <a href="https://dove.cccbr.org.uk/tower/{closestTower.TowerID}" target="_blank" class="has-text-link">
                                        {closestTower.Place}, {closestTower.Dedicn || 'Unknown Dedication'}
                                    </a>
                                </strong>
                            </p>
                            <p>{closestTower.County || 'Unknown'} • <strong>{closestTower.Bells || 'Unknown'}</strong> bells</p>
                            <p>{(closestTower.distance / 1000).toFixed(1)}km away</p>
                        </div>
                    </div>
                {/if}
                
                <button 
                    class="button is-rounded is-small floating-location-btn {isTrackingLocation ? 'tracking has-background-link has-text-white' : 'has-background-white has-text-link'}"
                    on:click={toggleLocationTracking} 
                    title={isTrackingLocation ? 'Stop Following Location' : 'Follow My Location'} 
                    aria-label={isTrackingLocation ? 'Stop Following Location' : 'Follow My Location'}
                >
                    <span class="icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                        </svg>
                    </span>
                </button>
                
                <button 
                    class="button is-rounded is-small floating-sidebar-btn has-background-white has-text-grey"
                    on:click={toggleSidebar}
                    title="Toggle Controls"
                    aria-label="Toggle Controls"
                >
                    <span class="icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
                        </svg>
                    </span>
                </button>
            </div>
            
            <aside class="sidebar {sidebarOpen ? 'open' : ''} box p-0" style="max-width: 350px;">
                <div class="sidebar-header has-background-light py-3 px-4 is-flex is-align-items-center is-justify-content-space-between">
                    <h3 class="title is-6 mb-0">Tower Filter</h3>
                    <button class="delete close-btn" on:click={toggleSidebar} aria-label="Close sidebar"></button>
                </div>
                
                <div class="sidebar-content py-4 px-4">
                    <div class="field mb-5">
                        <label class="label" for="bellsFilter">Number of Bells: {bellsFilter}</label>
                        <div class="control">
                            <input 
                                type="range" 
                                id="bellsFilter" 
                                bind:value={bellsFilter}
                                min="1"
                                max="16"
                                step="1"
                                class="slider is-fullwidth"
                            />
                        </div>
                        <div class="is-flex is-justify-content-space-between is-size-7 mt-1">
                            <span>1</span>
                            <span>16</span>
                        </div>
                        <label class="checkbox mt-2">
                            <input 
                                type="checkbox" 
                                bind:checked={isMinimumBells}
                            />
                            Show ≥ {bellsFilter}
                        </label>
                    </div>
                    
                    <div class="field mb-5">
                        <label class="checkbox">
                            <input 
                                type="checkbox" 
                                bind:checked={showUnringable}
                            />
                            Show Unringable Towers
                        </label>
                    </div>
                    
                    <div class="field mb-5">
                        <label class="label" for="displayLimitInput">Display Limit: {displayLimit}</label>
                        <div class="field has-addons">
                            <div class="control">
                                <input 
                                    type="number" 
                                    id="displayLimitInput"
                                    bind:value={displayLimit}
                                    min="1"
                                    max={data.towers.length}
                                    class="input is-small"
                                    style="width: 90px;"
                                />
                            </div>
                            <div class="control is-expanded">
                                <input 
                                    type="range" 
                                    id="displayLimit" 
                                    bind:value={displayLimit}
                                    min="10"
                                    max={Math.min(data.towers.length)}
                                    step="10"
                                    class="slider is-fullwidth"
                                />
                            </div>
                        </div>
                        <div class="is-flex is-justify-content-space-between is-size-7 mt-1">
                            <span>10</span>
                            <span>{Math.min(data.towers.length)}</span>
                        </div>
                    </div>
                </div>
            </aside>
            
            {#if sidebarOpen}
                <div class="sidebar-overlay" on:click={toggleSidebar} on:keydown={(e) => e.key === 'Escape' && toggleSidebar()} role="button" tabindex="0"></div>
            {/if}
        </div>
    {/if}
</main>

<Footer />
