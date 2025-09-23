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

    function debounce(func, wait) {
        return function(...args) {
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    async function performSearch() {
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
    });

    async function selectTower(tower) {
        selectedTower = tower;
        
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
</svelte:head>

<Header user={data.user} />

<main>    
    <div class="settings-section">
        <h2>Search for a Tower</h2>

        <!--- Go back --->
        <a href="/grab" class="button is-light mb-4">← Back to Grabs</a>
        
        <div class="search-container">
            <div class="field">
                <label for="searchQuery" class="label">Tower Name</label>
                <div class="search-input-container">
                    <input 
                        type="text" 
                        id="searchQuery" 
                        name="searchQuery"
                        class="input" 
                        placeholder="Start typing to search towers..." 
                        bind:value={searchQuery}
                        on:keydown={handleKeydown}
                        autocomplete="off"
                    />
                    {#if loading}
                        <div class="search-loading-indicator">Searching...</div>
                    {/if}
                </div>
            </div>
            
            {#if searchResults.length > 0}
                <div class="search-results">
                    {#each searchResults as tower}
                        <button 
                            type="button"
                            class="search-result-item" 
                            on:click={() => selectTower(tower)}
                        >
                            <strong>{tower.Place}</strong>
                            {tower.Dedicn ? `${tower.Dedicn}, ` : ''}{tower.County ? `${tower.County}` : ''}{tower.Country && tower.Country !== tower.County ? `, ${tower.Country}` : ''}
                            <br>
                            <small>
                                {tower.Bells} bells
                                {tower.UR === '1' || tower.UR === 1 ? ' (Unringable)' : ''}
                            </small>
                        </button>
                    {/each}
                </div>
            {:else if searchQuery.length >= 2 && !loading && searchResults.length === 0}
                <div class="search-results">
                    <div class="search-result-empty">No towers found matching your search</div>
                </div>
            {/if}
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
                                
                                <div class="bells-grid">
                                    {#each towerBells as bell}
                                        <label class="bell-checkbox">
                                            <input 
                                                type="checkbox" 
                                                name="bell_{bell.BellID}" 
                                                checked={selectedBells.has(bell.BellID)}
                                                on:change={() => toggleBell(bell.BellID)}
                                            />
                                            <div class="bell-info">
                                                <span class="bell-number">{bell.BellRole || 'Bell'}</span>
                                                {#if bell.WeightLbs}
                                                    <span class="bell-weight">{lbsToHundredweight(bell.WeightLbs)}</span>
                                                {/if}
                                                {#if bell.Note}
                                                    <span class="bell-note">{bell.Note}</span>
                                                {/if}
                                                {#if bell.BellName}
                                                    <span class="bell-name">{bell.BellName}</span>
                                                {/if}
                                            </div>
                                        </label>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/if}
                    
                    <!-- Add a hidden input to pass the selected bells as JSON -->
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
