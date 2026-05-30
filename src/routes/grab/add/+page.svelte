<script>
    import { enhance } from '$app/forms';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    
    export let data;
    export let form;

    let searchQuery = '';
    let loading = false;
    let selectedTower = null;
    let isGrabbed = true;
    let dateGrabbed = '';
    let towerBells = [];
    let selectedBells = new Set();
    let allBells = false;
    let isDateRequired = false;
    let searchResults = [];
    let typingTimeout = null;
    let successMessage = '';
    let suppressSearch = false;
    
    // Location-based suggestion state
    let locationLoading = false;
    let locationError = '';
    let suggestedTower = null;
    let suggestedDistance = null;
    let locationWatchId = null;
    let userLocation = null;
    
    function debounce(func, wait) {
        return function(...args) {
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    async function performSearch() {
        // If we've just selected a tower, skip the immediate automatic search
        if (suppressSearch) {
            // reset loading state and clear suppression (allow future searches)
            loading = false;
            suppressSearch = false;
            return;
        }

        if (searchQuery.length < 2) {
            searchResults = [];
            return;
        }
        
        loading = true;
        try {
            const response = await fetch(`/api/search-towers?query=${encodeURIComponent(searchQuery)}`);
            if (response.ok) {
                const data = await response.json();
                searchResults = data;
            } else {
                searchResults = [];
            }
        } catch (error) {
            console.error("Search error:", error);
            searchResults = [];
        } finally {
            loading = false;
        }
    }
    
    const debouncedSearch = debounce(performSearch, 100);
    
    $: if (searchQuery) {
        if (searchQuery.length >= 2) {
            debouncedSearch();
        } else {
            searchResults = [];
        }
    }

    onMount(async () => {
        const towerId = $page.url.searchParams.get('towerId');
        if (towerId) {
            try {
                const response = await fetch(`/api/tower?id=${towerId}`);
                if (response.ok) {
                    const tower = await response.json();
                    if (tower) {
                        await selectTower(tower);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch tower:", error);
            }
        }
        
        // restore previous queries
        if (form?.searchQuery) {
            searchQuery = form.searchQuery;
        }
        
        if (form?.selectedTower) {
            selectedTower = form.selectedTower;
            
            if (form?.dateGrabbed) {
                isDateRequired = true;
            }

            if (form?.selectedBells && Array.isArray(form.selectedBells)) {
                selectedBells = new Set(form.selectedBells);
                
                try {
                    const response = await fetch(`/api/bells?towerId=${selectedTower.TowerID}&ringId=${selectedTower.RingID || 1}`);
                    if (response.ok) {
                        towerBells = await response.json();
                        
                        allBells = towerBells.length > 0 && towerBells.every(bell => selectedBells.has(bell.BellID));
                    }
                } catch (error) {
                    console.error("Failed to fetch bells:", error);
                }
            }
        }
        
        if (form?.isGrabbed !== undefined) {
            isGrabbed = form.isGrabbed === true || form.isGrabbed === 'true';
        }
        
        if (form?.dateGrabbed) {
            dateGrabbed = form.dateGrabbed;
            isDateRequired = true;
        }
        
        // Start location detection if no tower was pre-selected
        if (!$page.url.searchParams.get('towerId') && !form?.selectedTower) {
            startLocationDetection();
        }
        
        // Cleanup on unmount
        return () => {
            if (locationWatchId !== null) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
        };
    });
    
    async function startLocationDetection() {
        if (!navigator.geolocation) {
            locationError = 'Geolocation is not supported by your browser';
            return;
        }
        
        locationLoading = true;
        locationError = '';
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                await findNearestTower();
            },
            (error) => {
                locationLoading = false;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        locationError = 'Location access denied. You can search for towers manually below.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        locationError = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        locationError = 'Location request timed out.';
                        break;
                    default:
                        locationError = 'Unable to get your location.';
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }
    
    async function findNearestTower() {
        if (!userLocation) return;
        
        locationLoading = true;
        try {
            const response = await fetch(
                `/api/nearest-tower?lat=${userLocation.lat}&lng=${userLocation.lng}&maxDistance=1`
            );
            
            if (response.ok) {
                const result = await response.json();
                if (result.found) {
                    suggestedTower = result.tower;
                    suggestedDistance = result.distanceMeters;
                } else {
                    suggestedTower = null;
                    suggestedDistance = null;
                }
            }
        } catch (error) {
            console.error('Error finding nearest tower:', error);
        } finally {
            locationLoading = false;
        }
    }
    
    function formatDistance(meters) {
        if (meters < 1000) {
            return `${meters}m`;
        }
        return `${(meters / 1000).toFixed(1)}km`;
    }
    
    async function useSuggestedTower() {
        if (suggestedTower) {
            await selectTower(suggestedTower);
            suggestedTower = null;
            suggestedDistance = null;
        }
    }
    
    function dismissSuggestion() {
        suggestedTower = null;
        suggestedDistance = null;
    }

    async function selectTower(tower) {
        selectedTower = tower;
        clearTimeout(typingTimeout);
        suppressSearch = true;
        searchQuery = `${tower.Place}${tower.Dedicn ? `, ${tower.Dedicn}` : ''}`;
        searchResults = [];
        setTimeout(() => { suppressSearch = false; }, 300);

        const existingGrab = data.userGrabs?.find(grab => 
            grab.towerID === tower.TowerID && grab.ringID === (tower.RingID || 1)
        );
        
        if (existingGrab) {
            isGrabbed = true;
            if (existingGrab.dateGrabbed) {
                dateGrabbed = new Date(existingGrab.dateGrabbed).toISOString().split('T')[0];
                isDateRequired = true;
            } else {
                dateGrabbed = '';
                isDateRequired = false;
            }
            
            // load pre-existing grabbed bells
            if (existingGrab.bells && existingGrab.bells.length > 0) {
                selectedBells = new Set(existingGrab.bells);
            } else {
                selectedBells = new Set();
            }
        } else {
            isGrabbed = true;
            dateGrabbed = '';
            isDateRequired = false;
            selectedBells = new Set();
        }
        
        try {
            const response = await fetch(`/api/bells?towerId=${tower.TowerID}&ringId=${tower.RingID || 1}`);
            if (response.ok) {
                towerBells = await response.json();
                
                allBells = towerBells.length > 0 && towerBells.every(bell => selectedBells.has(bell.BellID));
            } else {
                towerBells = [];
            }
        } catch (error) {
            console.error("Failed to fetch bells:", error);
            towerBells = [];
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (searchResults.length > 0) {
                selectTower(searchResults[0]);
            }
        }
    }

    function toggleBell(bellId) {
        if (selectedBells.has(bellId)) {
            selectedBells.delete(bellId);
        } else {
            selectedBells.add(bellId);
        }
        selectedBells = selectedBells;
        
        allBells = towerBells.length > 0 && towerBells.every(bell => selectedBells.has(bell.BellID));
    }

    function toggleAllBells() {
        if (allBells) {
            selectedBells = new Set(towerBells.map(bell => bell.BellID));
        } else {
            selectedBells = new Set();
        }
    }

    function lbsToHundredweight(lbs) {
        if (!lbs) return '';
        const cwt = Math.floor(lbs / 112);
        const remaining = lbs % 112;
        const qtr = Math.floor(remaining / 28);
        const finalLbs = remaining % 28;
        
        if (cwt > 0) {
            return `${cwt}-${qtr}-${finalLbs}`;
        } else if (qtr > 0) {
            return `${qtr}-${finalLbs}`;
        } else {
            return `${finalLbs}lb`;
        }
    }

    function resetFormState() {
        searchQuery = '';
        selectedTower = null;
        searchResults = [];
        towerBells = [];
        selectedBells = new Set();
        allBells = false;
        dateGrabbed = '';
        isDateRequired = false;
    }
</script>

<svelte:head>
    <title>Add a Grab | towertracker</title>
    <link rel="stylesheet" href="/assets/css/grab.css">
</svelte:head>

<Header user={data.user} />

<main>
    <div class="add-grab-container settings-section">
        <h2>Add a Grab</h2>

        <div class="breadcrumb-nav">
            <button type="button" class="btn btn-link" on:click={() => history.back()}>← Back to previous page</button>
        </div>

        <!-- Location-based suggestion -->
        {#if locationLoading}
            <div class="notification is-info location-suggestion">
                <span class="icon">📍</span>
                <span>Detecting your location...</span>
            </div>
        {:else if locationError}
            <div class="notification is-warning location-suggestion">
                <span class="icon">⚠️</span>
                <span>{locationError}</span>
                <button type="button" class="button is-small is-light ml-2" on:click={startLocationDetection}>
                    Retry
                </button>
            </div>
        {:else if suggestedTower && !selectedTower}
            <div class="notification is-success location-suggestion suggested-tower-card">
                <div class="suggestion-header">
                    <span class="icon">📍</span>
                    <strong>Nearest ungrabbed tower ({formatDistance(suggestedDistance)} away)</strong>
                </div>
                <div class="suggestion-content">
                    <p class="tower-name">
                        <strong>{suggestedTower.Place}</strong>{#if suggestedTower.Dedicn}, {suggestedTower.Dedicn}{/if}
                    </p>
                    <p class="tower-details">
                        {suggestedTower.County || ''}{#if suggestedTower.Country && suggestedTower.Country !== suggestedTower.County}, {suggestedTower.Country}{/if}
                        • {suggestedTower.Bells} bells
                        {#if suggestedTower.UR === '1' || suggestedTower.UR === 1}
                            <span class="tag is-warning is-light ml-2">Unringable</span>
                        {/if}
                    </p>
                </div>
                <div class="suggestion-actions">
                    <button type="button" class="button is-primary" on:click={useSuggestedTower}>
                        Grab this tower
                    </button>
                    <button type="button" class="button is-light" on:click={dismissSuggestion}>
                        Search for another
                    </button>
                </div>
            </div>
        {/if}
        
        <div class="add-grab-container">
            <div class="settings-section">
                <div class="search-section">
                    <label for="searchQuery" class="label">Search for a Tower</label>
                    <div class="search-field">
                        <input
                            type="text"
                            id="searchQuery"
                            name="searchQuery"
                            class="search-input"
                            placeholder="Start typing to search towers..."
                            bind:value={searchQuery}
                            on:keydown={handleKeydown}
                            autocomplete="off"
                            aria-autocomplete="list"
                        />
                        {#if loading}
                            <span class="icon is-small is-right search-loading-indicator">⏳</span>
                        {/if}

                        {#if searchResults.length > 0}
                            <div class="search-results-dropdown">
                                {#each searchResults as tower}
                                    <button type="button" class="dropdown-item" on:click={() => selectTower(tower)}>
                                        <strong>{tower.Place}</strong>
                                        <div class="tower-meta">
                                            {tower.Dedicn ? `${tower.Dedicn}, ` : ''}{tower.County ? `${tower.County}` : ''}{tower.Country && tower.Country !== tower.County ? `, ${tower.Country}` : ''}
                                            <div class="tower-place">
                                                {tower.Bells} bells {tower.UR === '1' || tower.UR === 1 ? ' • Unringable' : ''}
                                            </div>
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        {:else if searchQuery.length >= 2 && !loading}
                            <div class="search-results-dropdown">
                                <div class="dropdown-item">
                                    No towers found matching your search
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>            
            {#if selectedTower}
                <div class="selected-tower-container">
                    <h3>Selected Tower</h3>
                    <div class="selected-tower-info">
                        <p class="tower-name">
                            <strong>{selectedTower.Place}</strong>{#if selectedTower.Dedicn}, {selectedTower.Dedicn}{/if}
                        </p>
                        <p class="tower-location">
                            {selectedTower.County ? selectedTower.County : ''}{#if selectedTower.Country && selectedTower.Country !== selectedTower.County}, {selectedTower.Country}{/if}
                        </p>
                        <p class="tower-bells">
                            <strong>{selectedTower.Bells} bells</strong>
                            {#if selectedTower.Wt}
                                <span class="tenor-weight">• Tenor: {lbsToHundredweight(selectedTower.Wt)}</span>
                            {/if}
                            {#if selectedTower.UR === '1' || selectedTower.UR === 1}
                                <span class="unringable-tag">Unringable</span>
                            {/if}
                        </p>
                    </div>
                    
                    <form method="POST" action="?/addGrab" use:enhance={() => {
                        loading = true;
                        const currentSelectedBells = [...selectedBells];
                        const currentTowerName = selectedTower ? 
                            `${selectedTower.Place}${selectedTower.Dedicn ? `, ${selectedTower.Dedicn}` : ''}` :
                            'Tower';
                        
                        return async ({ result, update }) => {
                            loading = false;
                            if (result.type === 'success') {
                                if (result.data && result.data.message) {
                                    successMessage = result.data.message;
                                    setTimeout(() => {
                                        successMessage = '';
                                    }, 5000);
                                }
                                
                                resetFormState();
                                
                                await update();
                            } else {
                                const updatedProps = { 
                                    ...result.data,
                                    selectedBells: currentSelectedBells 
                                };
                                await update({ ...result, data: updatedProps });
                            }
                        };
                    }}>
                        <input type="hidden" name="towerId" value={selectedTower.TowerID} />
                        <input type="hidden" name="ringId" value={selectedTower.RingID || 1} />
                        <input type="hidden" name="isGrabbed" value={isGrabbed} />
                        
                        <div class="grab-toggle-container">
                            <label class="grab-toggle">
                                <span class="grab-label">Have you grabbed this tower?</span>
                                <div class="toggle-switch-container">
                                    <input 
                                        type="checkbox" 
                                        checked={isGrabbed} 
                                        on:change={() => isGrabbed = !isGrabbed}
                                    />
                                    <span class="toggle-slider"></span>
                                </div>
                            </label>
                        </div>
                        
                        {#if isGrabbed}
                            <div class="date-grabbed-container">
                                <div class="date-field-header">
                                    <label for="dateGrabbed" class="label">Date Grabbed (Optional)</label>
                                    <label class="checkbox date-required-toggle">
                                        <input 
                                            type="checkbox" 
                                            bind:checked={isDateRequired}
                                            on:change={() => {
                                                if (!isDateRequired && !dateGrabbed) {
                                                    dateGrabbed = '';
                                                }
                                            }}
                                        />
                                        <span>Include Date</span>
                                    </label>
                                </div>
                                <input 
                                    type="date" 
                                    id="dateGrabbed" 
                                    name="dateGrabbed" 
                                    bind:value={dateGrabbed}
                                    max={new Date().toISOString().split('T')[0]}
                                    class="input"
                                    disabled={!isDateRequired}
                                />
                            </div>
                            
                            {#if towerBells.length > 0}
                                <div class="bells-selection-container">
                                    <div class="bells-header">
                                        <h4>Select the bells you've rung</h4>
                                        <label class="checkbox select-all">
                                            <input 
                                                type="checkbox" 
                                                checked={allBells}
                                                on:change={() => {
                                                    allBells = !allBells;
                                                    toggleAllBells();
                                                }}
                                            />
                                            <span>Select All</span>
                                        </label>
                                    </div>
                                    
                                    <div class="bells-grid-add">
                                        {#each towerBells as bell}
                                                        <div class="bell-item-add">
                                                <div
                                                    class="bell-box-add {selectedBells.has(bell.BellID) ? 'is-selected' : ''}"
                                                    on:click={() => toggleBell(bell.BellID)}
                                                    role="checkbox"
                                                    aria-checked={selectedBells.has(bell.BellID)}
                                                    tabindex="0"
                                                    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBell(bell.BellID); } }}
                                                >
                                                    <label class="checkbox">
                                                        <input
                                                            type="checkbox"
                                                            name={"bell_" + bell.BellID}
                                                            checked={selectedBells.has(bell.BellID)}
                                                            on:change={() => toggleBell(bell.BellID)}
                                                        />
                                                        <div class="bell-info-add">
                                                            <div class="bell-number-add">
                                                                {bell.BellRole || 'Bell'}
                                                            </div>
                                                            {#if bell.WeightLbs}
                                                                <div class="bell-weight-add">
                                                                    {lbsToHundredweight(bell.WeightLbs)}
                                                                </div>
                                                            {/if}
                                                            {#if bell.Note}
                                                                <div class="bell-note-add">
                                                                    {bell.Note}
                                                                </div>
                                                            {/if}
                                                            {#if bell.BellName}
                                                                <div class="bell-name-add">
                                                                    {bell.BellName}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        {/if}
                        
                        <input 
                            type="hidden" 
                            name="selectedBellsJson" 
                            value={JSON.stringify([...selectedBells])} 
                        />
                        
                        <div class="form-actions">
                            <button type="submit" class="button submit-btn" disabled={loading}>
                                {#if loading}
                                    Saving...
                                {:else if isGrabbed}
                                    Save Grab
                                {:else}
                                    Remove Grab
                                {/if}
                            </button>
                        </div>
                    </form>
                </div>
            {/if}
            {#if successMessage}
                <div class="notification is-success">
                    <p>{successMessage}</p>
                </div>
            {/if}
        </div>
</main>

<Footer />
