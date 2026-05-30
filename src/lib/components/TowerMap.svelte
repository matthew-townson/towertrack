<script>
    import { onMount } from 'svelte';
    import {
        generatePinSVG,
        convertToHundredweight,
        getPinColor,
        generateTowerPopup,
        createUserLocationIcon,
        filterTowersByBells,
        filterTowersByUnringable,
        matchesPracticeNight,
        matchesSpecialFilters,
        addDistanceToTowers,
        initializeMap
    } from '$lib/mapUtils.js';
    
    export let towers = [];
    export let bellsFilter = 3;
    export let isMinimumBells = true;
    export let showUnringable = true;
    export let practiceNightFilter = '';
    export let displayLimit = 200;
    export let includeGrabbed = false;
    export let excludeGrabbed = false;
    export let includeQuartered = false;
    export let excludeQuartered = false;
    export let includePealed = false;
    export let excludePealed = false;
    export let showLocationTracking = true;
    export let showClosestTower = true;
    export let showTowerCount = true;
    export let autoFitBounds = false;
    export let initialCenter = [52.0, 0.0];
    export let initialZoom = 6;
    export let mapHeight = '100%';
    
    // advanced filter options (exported so parent can bind)
    // svelte-ignore export_let_unused
    export let counties = [];
    // svelte-ignore export_let_unused
    export let countries = [];
    // svelte-ignore export_let_unused
    export let dioceses = [];
    // svelte-ignore export_let_unused
    export let minWtLbs = null;
    // svelte-ignore export_let_unused
    export let maxWtLbs = null;

    // selected advanced filters (exported for parent binding)
    export let selectedCounty = '';
    export let selectedCountry = '';
    export let selectedDiocese = '';
    // store weight inputs in hundredweight decimals for UX (1 cwt = 112 lbs)
    export let minWeightCwt = '';
    export let maxWeightCwt = '';
    
    // state that parent can read
    export let currentlyDisplayed = 0;
    export let filteredTowerCount = 0;
    export let closestTower = null;
    export let userLocation = null;
    
    let mapContainer;
    let map;
    let allMarkers = [];
    let userLocationMarker = null;
    let isTrackingLocation = false;
    let watchId = null;
    let isProgramMove = false;
    let lastTowerUpdate = 0;
    let queryLocationUsed = false;

    function lbsToCwtDecimal(lbs) {
        if (lbs === null || lbs === undefined) return null;
        const n = parseFloat(lbs);
        if (isNaN(n)) return null;
        return +(n / 112).toFixed(2);
    }

    function cwtDecimalToLbs(cwt) {
        if (cwt === null || cwt === undefined || cwt === '') return null;
        const n = parseFloat(cwt);
        if (isNaN(n)) return null;
        return Math.round(n * 112);
    }

    // Advanced filters matching function (available to map filtering flow)
    function matchesAdvancedFilters(tower) {
        // County
        if (selectedCounty && tower.County) {
            if (String(tower.County).toLowerCase() !== String(selectedCounty).toLowerCase()) return false;
        } else if (selectedCounty && !tower.County) {
            return false;
        }

        // Country
        if (selectedCountry && tower.Country) {
            if (String(tower.Country).toLowerCase() !== String(selectedCountry).toLowerCase()) return false;
        } else if (selectedCountry && !tower.Country) {
            return false;
        }

        // Diocese
        if (selectedDiocese && tower.Diocese) {
            if (String(tower.Diocese).toLowerCase() !== String(selectedDiocese).toLowerCase()) return false;
        } else if (selectedDiocese && !tower.Diocese) {
            return false;
        }

        // Weight (tower.Wt is in lbs at this point)
        const minLbs = cwtDecimalToLbs(minWeightCwt);
        const maxLbs = cwtDecimalToLbs(maxWeightCwt);
        if ((minLbs !== null && minLbs !== undefined) || (maxLbs !== null && maxLbs !== undefined)) {
            const towerWt = tower.Wt !== null && tower.Wt !== undefined ? parseFloat(tower.Wt) : NaN;
            if (isNaN(towerWt)) return false;
            if (minLbs !== null && minLbs !== undefined && !isNaN(minLbs) && towerWt < minLbs) return false;
            if (maxLbs !== null && maxLbs !== undefined && !isNaN(maxLbs) && towerWt > maxLbs) return false;
        }

        return true;
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
                            icon: createUserLocationIcon(window.L)
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
                    icon: createUserLocationIcon(window.L)
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

        // Apply all filters and add distance
        let towersWithDistance = towers
            .filter(tower => tower.Lat && tower.Long);
        
        towersWithDistance = filterTowersByBells(towersWithDistance, bellsFilter, isMinimumBells);
        towersWithDistance = filterTowersByUnringable(towersWithDistance, showUnringable);
        towersWithDistance = towersWithDistance.filter(tower => matchesPracticeNight(tower, practiceNightFilter));
        towersWithDistance = towersWithDistance.filter(tower => matchesSpecialFilters(tower, {
            includeGrabbed,
            excludeGrabbed,
            includeQuartered,
            excludeQuartered,
            includePealed,
            excludePealed
        }));
        
        towersWithDistance = addDistanceToTowers(towersWithDistance, centre, window.L);
        towersWithDistance.sort((a, b) => a.distance - b.distance);
        
        // advanced filters are applied later via matchesAdvancedFilters
        
        if (userLocation) {
            let towersFromUserLocation = towers
                .filter(tower => tower.Lat && tower.Long);
            
            towersFromUserLocation = filterTowersByBells(towersFromUserLocation, bellsFilter, isMinimumBells);
            towersFromUserLocation = filterTowersByUnringable(towersFromUserLocation, showUnringable);
            towersFromUserLocation = towersFromUserLocation.filter(tower => matchesPracticeNight(tower, practiceNightFilter));
            towersFromUserLocation = towersFromUserLocation.filter(tower => matchesSpecialFilters(tower, {
                includeGrabbed,
                excludeGrabbed,
                includeQuartered,
                excludeQuartered,
                includePealed,
                excludePealed
            }));
            
            towersFromUserLocation = addDistanceToTowers(towersFromUserLocation, userLocation, window.L);
            towersFromUserLocation.sort((a, b) => a.distance - b.distance);
            
            // apply advanced filters for user-location-sorted list too
            towersFromUserLocation = towersFromUserLocation.filter(tower => matchesAdvancedFilters(tower));

            closestTower = towersFromUserLocation.length > 0 ? towersFromUserLocation[0] : null;
        } else {
            closestTower = null;
        }
        
    const towersToShow = towersWithDistance.filter(tower => matchesAdvancedFilters(tower)).slice(0, displayLimit);
        
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
                className: 'custom-tower-marker',
                html: pinSVG,
                iconSize: [bellCount >= 10 ? 38 : 35, tower.grabbed ? 70 : 57],
                iconAnchor: [bellCount >= 10 ? 19 : 17.5, tower.grabbed ? 70 : 57],
                popupAnchor: [0, tower.grabbed ? -70 : -57]
            });
            
            const pinColor = getPinColor(bellCount, isUnringable);
            
            const marker = window.L.marker([tower.Lat, tower.Long], { icon: customIcon }).addTo(map);
            
            tower.Wt = convertToHundredweight(tower.Wt);

            const popupContent = generateTowerPopup(tower, isUnringable, pinColor);
            
            marker.bindPopup(popupContent);
            allMarkers.push(marker);
        });
        
        currentlyDisplayed = allMarkers.length;
    }
    
    $: {
        let filteredTowers = towers.filter(tower => tower.Lat && tower.Long);
        filteredTowers = filterTowersByBells(filteredTowers, bellsFilter, isMinimumBells);
        filteredTowers = filterTowersByUnringable(filteredTowers, showUnringable);
        filteredTowers = filteredTowers.filter(tower => matchesPracticeNight(tower, practiceNightFilter));
        filteredTowers = filteredTowers.filter(tower => matchesSpecialFilters(tower, {
            includeGrabbed,
            excludeGrabbed,
            includeQuartered,
            excludeQuartered,
            includePealed,
            excludePealed
        }));
        filteredTowers = filteredTowers.filter(tower => matchesAdvancedFilters(tower));
        filteredTowerCount = filteredTowers.length;
    }

    onMount(async () => {
        const L = await import('leaflet');
        window.L = L;

        // wait for container to render properly first
        await new Promise(resolve => setTimeout(resolve, 0));

        map = initializeMap(L, mapContainer, initialCenter, initialZoom);

        // force map to recalculate size after init
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 100);

        // URL parameters if on map page
        if (typeof window !== 'undefined') {
            try {
                const params = new URLSearchParams(window.location.search);
                const latParam = params.get('lat');
                const lngParam = params.get('lng');
                const zoomParam = params.get('zoom');

                if (latParam && lngParam) {
                    const lat = parseFloat(latParam);
                    const lng = parseFloat(lngParam);
                    const zoom = zoomParam ? parseFloat(zoomParam) : map.getZoom();

                    if (!isNaN(lat) && !isNaN(lng)) {
                        queryLocationUsed = true;
                        isProgramMove = true;
                        if (!isNaN(zoom)) {
                            map.setView([lat, lng], zoom);
                        } else {
                            map.setView([lat, lng]);
                        }
                        setTimeout(() => {
                            isProgramMove = false;
                        }, 100);
                    }
                }
            } catch (err) {
                console.warn('Error parsing query params for map location:', err);
            }
        }

        if (autoFitBounds && towers.length > 0) {
            const bounds = [];
            towers.forEach(tower => {
                if (tower.Lat && tower.Long) {
                    bounds.push([tower.Lat, tower.Long]);
                }
            });
            if (bounds.length > 0) {
                map.fitBounds(window.L.latLngBounds(bounds), { padding: [20, 20], maxZoom: 10 });
            }
        } else if (!queryLocationUsed && showLocationTracking) {
            getUserLocation();
        }

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
    
    $: if (map && (displayLimit || bellsFilter || isMinimumBells || showUnringable || practiceNightFilter || includeGrabbed || excludeGrabbed || includeQuartered || excludeQuartered || includePealed || excludePealed || selectedCounty || selectedCountry || selectedDiocese || minWeightCwt || maxWeightCwt)) {
        updateDisplayedTowers();
    }
</script>

<svelte:head>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
          crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" 
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" 
            crossorigin=""></script>
</svelte:head>

<div class="tower-map-wrapper" style="position: relative; height: {mapHeight};">
    <div bind:this={mapContainer} class="map" style="width:100%; height:100%;"></div>
    
    {#if showTowerCount}
        <div class="notification tower-count-display py-2 px-3 mb-0">
            <p>
                <strong>Showing {currentlyDisplayed} of {filteredTowerCount} towers</strong> that match the filter (from a total of {towers.length} towers)
            </p>
        </div>
    {/if}
    
    {#if showClosestTower && userLocation && closestTower}
        <div class="card closest-tower-display">
            <div class="card-content py-2 px-3">
                <h4 class="title is-6 mb-2">Closest Tower:</h4>
                <p>
                    <strong>
                        <a href="/tower/{closestTower.TowerID}" class="has-text-link">
                            {closestTower.Place}, {closestTower.Dedicn || 'Unknown Dedication'}
                        </a>
                    </strong>
                </p>
                <p>
                    {closestTower.County || 'Unknown'} • 
                    <strong style="color: {getPinColor(parseInt(closestTower.Bells), closestTower.UR === 1 || closestTower.UR === '1')};">
                        {closestTower.Bells || 'Unknown'}
                    </strong> bells
                </p>
                <p>{(closestTower.distance / 1609.344).toFixed(1)} miles away</p>
            </div>
        </div>
    {/if}
    
    {#if showLocationTracking}
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
    {/if}
    
    <slot name="controls"></slot>
</div>
