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
    let formStateVersion = 0;
    
    // Location-based suggestion state
    let locationLoading = false;
    let locationError = '';
    let nearbyTower = null;
    let nearbyDistance = null;

    function sameGrab(grab, tower) {
        return String(grab.towerID) === String(tower.TowerID) &&
            String(grab.ringID || 1) === String(tower.RingID || 1);
    }

    function normalizeDate(value) {
        if (!value) return '';
        return String(value).slice(0, 10);
    }

    function normalizeBellIds(value) {
        if (Array.isArray(value)) return new Set(value.map(id => String(id)));
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? new Set(parsed.map(id => String(id))) : new Set();
            } catch {
                return new Set(value.split(',').map(id => id.trim()).filter(Boolean));
            }
        }
        return new Set();
    }

    function applyExistingGrab(grab) {
        isGrabbed = true;
        dateGrabbed = normalizeDate(grab?.dateGrabbed);
        isDateRequired = dateGrabbed.length > 0;
        selectedBells = normalizeBellIds(grab?.selectedBells);
        formStateVersion += 1;
    }

    function isBellSelected(bell) {
        return selectedBells.has(String(bell.BellID));
    }
    
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
        const ringId = $page.url.searchParams.get('ringId');
        if (towerId) {
            try {
                const params = new URLSearchParams({ id: towerId });
                if (ringId) params.set('ringId', ringId);
                const response = await fetch(`/api/tower?${params}`);
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
                selectedBells = normalizeBellIds(form.selectedBells);
                
                try {
                    const response = await fetch(`/api/bells?towerId=${selectedTower.TowerID}&ringId=${selectedTower.RingID || 1}`);
                    if (response.ok) {
                        towerBells = await response.json();
                        
                        allBells = towerBells.length > 0 &&
                            towerBells.every(bell => selectedBells.has(String(bell.BellID)));
                        formStateVersion += 1;
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
            dateGrabbed = normalizeDate(form.dateGrabbed);
            isDateRequired = true;
        }
        
        // Start location detection if no tower was pre-selected
        if (!$page.url.searchParams.get('towerId') && !form?.selectedTower) {
            findNearbyTower();
        }
        
    });
    
    function findNearbyTower() {
        if (!navigator.geolocation) {
            locationError = 'Location search is not supported by your browser.';
            return;
        }

        locationLoading = true;
        locationError = '';

        navigator.geolocation.getCurrentPosition(async ({ coords }) => {
            try {
                const response = await fetch(
                    `/api/nearest-tower?lat=${coords.latitude}&lng=${coords.longitude}&maxDistance=5`
                );
                const nearby = await response.json();
                if (!response.ok) {
                    throw new Error(nearby.error || 'Unable to find nearby towers.');
                }
                nearbyTower = nearby.found ? nearby.tower : null;
                nearbyDistance = nearby.found ? nearby.distanceMeters : null;
                if (!nearby.found) {
                    locationError = nearby.message || 'No ungrabbed towers found nearby.';
                }
            } catch (error) {
                console.error('Error finding nearby tower:', error);
                locationError = error.message || 'Unable to find nearby towers.';
                nearbyTower = null;
                nearbyDistance = null;
            } finally {
                locationLoading = false;
            }
        }, (error) => {
            locationLoading = false;
            locationError = error.code === error.PERMISSION_DENIED
                ? 'Location access was denied. You can continue with the search above.'
                : 'Unable to determine your location. You can continue with the search above.';
        }, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        });
    }

    function formatDistance(meters) {
        return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
    }

    async function useNearbyTower() {
        if (nearbyTower) {
            await selectTower(nearbyTower);
            nearbyTower = null;
            nearbyDistance = null;
        }
    }

    async function selectTower(tower) {
        selectedTower = tower;
        clearTimeout(typingTimeout);
        suppressSearch = true;
        searchQuery = `${tower.Place}${tower.Dedicn ? `, ${tower.Dedicn}` : ''}`;
        searchResults = [];
        setTimeout(() => { suppressSearch = false; }, 300);

        const existingGrab = data.userGrabs?.find(grab => sameGrab(grab, tower));
        
        if (existingGrab) {
            applyExistingGrab(existingGrab);
        } else {
            applyExistingGrab(null);
            dateGrabbed = '';
            isDateRequired = false;
        }
        
        try {
            const response = await fetch(`/api/bells?towerId=${tower.TowerID}&ringId=${tower.RingID || 1}`);
            if (response.ok) {
                towerBells = await response.json();
                
                allBells = towerBells.length > 0 &&
                    towerBells.every(bell => selectedBells.has(String(bell.BellID)));
                formStateVersion += 1;
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
        const normalizedBellId = String(bellId);
        if (selectedBells.has(normalizedBellId)) {
            selectedBells.delete(normalizedBellId);
        } else {
            selectedBells.add(normalizedBellId);
        }
        selectedBells = selectedBells;
        
        allBells = towerBells.length > 0 &&
            towerBells.every(bell => selectedBells.has(String(bell.BellID)));
    }

    function toggleAllBells() {
        if (allBells) {
            selectedBells = new Set(towerBells.map(bell => String(bell.BellID)));
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
    <link rel="stylesheet" href="/assets/css/bellboard-summary.css">
</svelte:head>

<Header user={data.user} />

<main class="section">
    <div class="container add-grab-page">
        <div class="level mb-5">
            <div class="level-left">
                <div>
                    <p class="back-link"><a href="/grab">← Back to Grabs</a></p>
                    <h1 class="title mb-1" style="text-align: left;">Add a grab</h1>
                    <p class="subtitle is-6 mb-0">Search for a tower, choose the bells you rang, and save your visit.</p>
                </div>
            </div>
            <div class="level-right">
                <a href="/grab/bulk" class="button is-link">Add multiple grabs</a>
            </div>
        </div>

        <div class="box location-search">
            <div class="location-search-heading">
                <div>
                    <p class="heading">Find a nearby tower</p>
                    <p class="help">Use your location to find the nearest ungrabbed tower.</p>
                </div>
                <button type="button" class="button is-primary" on:click={findNearbyTower} disabled={locationLoading}>
                    {locationLoading ? 'Finding…' : 'Use my location'}
                </button>
            </div>
            {#if locationError}
                <p class="help is-danger">{locationError}</p>
            {:else if nearbyTower && !selectedTower}
                <div class="nearby-tower">
                    <div>
                        <strong>{nearbyTower.Place}{nearbyTower.Dedicn ? `, ${nearbyTower.Dedicn}` : ''}</strong>
                        <p class="help">{formatDistance(nearbyDistance)} away · {nearbyTower.Bells} bells</p>
                    </div>
                    <div class="buttons">
                        <a class="button is-small is-info" href={"/tower/" + nearbyTower.TowerID}>Details</a>
                        <button type="button" class="button is-small" on:click={useNearbyTower}>Grab</button>
                    </div>
                </div>
            {/if}
        </div>
        <div class="box">
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
                    {#key `${selectedTower.TowerID}-${selectedTower.RingID || 1}-${formStateVersion}`}
                        <section class="selected-tower-container box">
                            <div class="level is-mobile mb-4">
                                <div class="level-left">
                                    <div>
                                        <p class="heading mb-1">Selected tower</p>
                                        <h2 class="title is-4 mb-1" style="text-align: left;">
                                            {selectedTower.Place}{#if selectedTower.Dedicn}, {selectedTower.Dedicn}{/if}
                                        </h2>
                                        <p class="subtitle is-6 mb-0">
                                            {selectedTower.County || ''}{#if selectedTower.Country && selectedTower.Country !== selectedTower.County}, {selectedTower.Country}{/if}
                                            · {selectedTower.Bells} bells
                                            {#if selectedTower.Wt} · Tenor: {lbsToHundredweight(selectedTower.Wt)}{/if}
                                        </p>
                                    </div>
                                </div>
                                {#if selectedTower.UR === '1' || selectedTower.UR === 1}
                                    <div class="level-right">
                                        <span class="tag is-warning">Unringable</span>
                                    </div>
                                {/if}
                            </div>
                    
                        <form method="POST" action="?/addGrab" use:enhance={() => {
                            loading = true;
                            const currentSelectedBells = [...selectedBells];

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
                        
                        <div class="grab-toggle-container box">
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
                            <div class="date-grabbed-container box">
                                <div class="date-field-header">
                                    <label for="dateGrabbed" class="label">Date Grabbed (Optional)</label>
                                    <label class="checkbox date-required-toggle">
                                        <input
                                            type="checkbox" 
                                            checked={isDateRequired}
                                            on:change={(event) => {
                                                isDateRequired = event.currentTarget.checked;
                                                if (!isDateRequired) dateGrabbed = '';
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
                                <div class="bells-selection-container box">
                                    <div class="level is-mobile mb-4">
                                        <div class="level-left">
                                            <h3 class="title is-5 mb-0">Bells rung</h3>
                                        </div>
                                        <div class="level-right">
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
                                    </div>
                                    
                                    <div class="bells-grid-add">
                                        {#each towerBells as bell}
                                            <div class="bell-item-add">
                                                <div
                                                    class="bell-box-add {isBellSelected(bell) ? 'is-selected' : ''}"
                                                    on:click={() => toggleBell(bell.BellID)}
                                                    role="checkbox"
                                                    aria-checked={isBellSelected(bell)}
                                                    tabindex="0"
                                                    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBell(bell.BellID); } }}
                                                >
                                                    <label class="checkbox">
                                                        <input
                                                            type="checkbox"
                                                            name={"bell_" + bell.BellID}
                                                            checked={isBellSelected(bell)}
                                                            on:click={(event) => event.stopPropagation()}
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
                    </section>
                {/key}
            {/if}
            {#if successMessage}
                <div class="notification is-success">
                    <p>{successMessage}</p>
                </div>
            {/if}
        </div>
    </div>
</main>

<Footer />
