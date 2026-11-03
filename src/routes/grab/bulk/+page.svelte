<script>
    import { enhance } from '$app/forms';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    
    export let data;
    export let form;

    // Each grab entry: { id, tower, bells, selectedBells, dateGrabbed, searchQuery, searchResults, loading }
    let grabEntries = [createEmptyEntry()];
    let submitting = false;
    let successMessage = '';
    let typingTimeouts = {};
    let lastTowerSelectedEntryId = null;

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

    function createEmptyEntry() {
        return {
            id: crypto.randomUUID(),
            tower: null,
            bells: [],
            selectedBells: new Set(),
            dateGrabbed: '',
            searchQuery: '',
            searchResults: [],
            loading: false,
            expanded: true,
            allBells: false,
            manuallyOpened: false
        };
    }

    function debounce(entryId, func, wait) {
        return function(...args) {
            clearTimeout(typingTimeouts[entryId]);
            typingTimeouts[entryId] = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async function performSearch(entry) {
        if (entry.searchQuery.length < 2) {
            entry.searchResults = [];
            grabEntries = grabEntries;
            return;
        }
        
        entry.loading = true;
        grabEntries = grabEntries;
        
        try {
            const response = await fetch(`/api/search-towers?query=${encodeURIComponent(entry.searchQuery)}`);
            if (response.ok) {
                let results = await response.json();
                // Filter out towers already selected in other entries or already grabbed by user
                const selectedTowerIds = new Set(
                    grabEntries
                        .filter(e => e.id !== entry.id && e.tower)
                        .map(e => `${e.tower.TowerID}-${e.tower.RingID || 1}`)
                );
                entry.searchResults = results.filter(tower => {
                    const key = `${tower.TowerID}-${tower.RingID || 1}`;
                    return !selectedTowerIds.has(key);
                });
            } else {
                entry.searchResults = [];
            }
        } catch (error) {
            console.error("Search error:", error);
            entry.searchResults = [];
        } finally {
            entry.loading = false;
            grabEntries = grabEntries;
        }
    }

    function handleSearchInput(entry) {
        const debouncedSearch = debounce(entry.id, () => performSearch(entry), 150);
        debouncedSearch();
    }

    async function selectTower(entry, tower) {
        // Check if tower is already grabbed by user
        const towerId = String(tower.TowerID);
        const ringId = String(tower.RingID || 1);
        const existingGrab = data.userGrabs?.find(g => sameGrab(g, tower));
        const isAlreadyGrabbed = Boolean(existingGrab);
        
        // Check if tower is already in another entry
        const isInOtherEntry = grabEntries.some(e =>
            e.id !== entry.id &&
            String(e.tower?.TowerID) === towerId &&
            String(e.tower?.RingID || 1) === ringId
        );

        entry.tower = { ...tower, isAlreadyGrabbed, isInOtherEntry };
        entry.searchQuery = `${tower.Place}${tower.Dedicn ? `, ${tower.Dedicn}` : ''}`;
        entry.dateGrabbed = normalizeDate(existingGrab?.dateGrabbed);
        entry.searchResults = [];
        entry.loading = true;
        grabEntries = grabEntries;

        // Fetch bells for this tower
        try {
            const response = await fetch(`/api/bells?towerId=${tower.TowerID}&ringId=${tower.RingID || 1}`);
            if (response.ok) {
                entry.bells = await response.json();
                entry.selectedBells = normalizeBellIds(existingGrab?.selectedBells);
                entry.allBells = entry.bells.length > 0 &&
                    entry.bells.every(bell => entry.selectedBells.has(String(bell.BellID)));
            } else {
                entry.bells = [];
            }
        } catch (error) {
            console.error("Failed to fetch bells:", error);
            entry.bells = [];
        } finally {
            entry.loading = false;
            grabEntries = grabEntries;
        }

        // Add a new empty entry if this was the last one
        const lastEntry = grabEntries[grabEntries.length - 1];
        if (lastEntry.id === entry.id) {
            // Check if there was a previous entry that had a tower and is no longer being focused
            if (lastTowerSelectedEntryId && lastTowerSelectedEntryId !== entry.id) {
                const previousEntry = grabEntries.find(e => e.id === lastTowerSelectedEntryId);
                if (previousEntry && !previousEntry.manuallyOpened) {
                    previousEntry.expanded = false;
                }
            }
            
            // Update the last selected entry
            lastTowerSelectedEntryId = entry.id;
            
            // Add a new empty entry
            grabEntries = [...grabEntries, createEmptyEntry()];
        }
    }

    function toggleBell(entry, bellId) {
        const normalizedBellId = String(bellId);
        if (entry.selectedBells.has(normalizedBellId)) {
            entry.selectedBells.delete(normalizedBellId);
        } else {
            entry.selectedBells.add(normalizedBellId);
        }
        entry.selectedBells = new Set(entry.selectedBells);
        entry.allBells = entry.bells.length > 0 &&
            entry.bells.every(b => entry.selectedBells.has(String(b.BellID)));
        grabEntries = grabEntries;
    }

    function toggleAllBells(entry) {
        if (entry.allBells) {
            entry.selectedBells = new Set(entry.bells.map(b => String(b.BellID)));
        } else {
            entry.selectedBells = new Set();
        }
        grabEntries = grabEntries;
    }

    function removeEntry(entryId) {
        grabEntries = grabEntries.filter(e => e.id !== entryId);
        if (grabEntries.length === 0) {
            grabEntries = [createEmptyEntry()];
            lastTowerSelectedEntryId = null;
        }
    }

    function clearEntry(entry) {
        entry.tower = null;
        entry.bells = [];
        entry.selectedBells = new Set();
        entry.dateGrabbed = '';
        entry.searchQuery = '';
        entry.searchResults = [];
        entry.allBells = false;
        grabEntries = grabEntries;
    }

    function toggleExpanded(entry) {
        entry.expanded = !entry.expanded;
        // Track that the user manually opened this entry
        if (entry.expanded) {
            entry.manuallyOpened = true;
        }
        grabEntries = grabEntries;
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

    // Get valid entries for submission
    $: validEntries = grabEntries.filter(e => e.tower && !e.tower.isInOtherEntry);
    $: hasValidEntries = validEntries.length > 0;
    $: grabsJsonValue = JSON.stringify(validEntries.map(e => ({
        towerId: e.tower.TowerID,
        ringId: e.tower.RingID || 1,
        dateGrabbed: e.dateGrabbed || null,
        selectedBells: [...e.selectedBells]
    })));

    function handleKeydown(event, entry) {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (entry.searchResults.length > 0) {
                selectTower(entry, entry.searchResults[0]);
            }
        }
        if (event.key === 'Escape') {
            entry.searchResults = [];
            grabEntries = grabEntries;
        }
    }

</script>

<svelte:head>
    <title>Bulk Add Grabs | towertracker</title>
    <link rel="stylesheet" href="/assets/css/grab.css">
    <link rel="stylesheet" href="/assets/css/bellboard-summary.css">
</svelte:head>

<Header user={data.user} />

<main class="section">
    <div class="container bulk-grab-page">
        <div class="level mb-5">
            <div class="level-left">
                <div>
                    <p class="back-link"><a href="/grab">← Back to Grabs</a></p>
                    <h1 class="title mb-1" style="text-align: left;">Add grabs in bulk</h1>
                    <p class="subtitle is-6 mb-0">Build a list of towers, select bells, and save them together.</p>
                </div>
            </div>
            <div class="level-right">
                <a href="/grab/add" class="button is-link">Add one grab</a>
            </div>
        </div>
        
        {#if form?.success}
            <div class="notification is-success">
                <p>{form.message}</p>
            </div>
        {/if}
        
        {#if form?.error}
            <div class="notification is-danger">
                <p>{form.error}</p>
            </div>
        {/if}

        <form class="bulk-grab-form box" method="POST" action="?/bulkAddGrabs" use:enhance={() => {
            submitting = true;
            return async ({ result, update }) => {
                submitting = false;
                if (result.type === 'success' && result.data?.success) {
                    // Reset to single empty entry
                    grabEntries = [createEmptyEntry()];
                }
                await update();
            };
        }}>
            <input type="hidden" name="grabsJson" value={grabsJsonValue} />

            <div class="compact-list bulk-grab-list">
                {#each grabEntries as entry, index (entry.id)}
                    <div class="compact-item bulk-grab-item" class:expanded={entry.expanded} class:has-tower={entry.tower}>
                        {#if entry.tower}
                            <!-- Tower selected - show compact row -->
                            <button type="button" class="compact-row" on:click={() => toggleExpanded(entry)}>
                                <span class="compact-index">{index + 1}.</span>
                                <span class="compact-place">
                                    {entry.tower.Place}{entry.tower.Dedicn ? `, ${entry.tower.Dedicn}` : ''}{entry.tower.County ? `, ${entry.tower.County}` : ''}
                                </span>
                                <span class="compact-bells-count">{entry.tower.Bells} bells</span>
                                <span class="compact-date-preview">{entry.dateGrabbed || 'No date'}</span>
                                <span class="compact-selected-count" class:has-selection={entry.selectedBells.size > 0}>
                                    {entry.selectedBells.size}/{entry.bells.length} selected
                                </span>
                                {#if entry.tower.isAlreadyGrabbed}
                                    <span class="tag is-warning is-light">Already grabbed</span>
                                {/if}
                                {#if entry.tower.isInOtherEntry}
                                    <span class="tag is-danger is-light">Duplicate</span>
                                {/if}
                                <span class="compact-expand-icon">{entry.expanded ? '▼' : '▶'}</span>
                            </button>
                            
                            {#if entry.expanded}
                                <div class="compact-details">
                                    <div class="compact-details-content">
                                        <div class="buttons bulk-entry-actions">
                                            <button type="button" class="button is-small is-light" on:click={() => clearEntry(entry)}>
                                                Change Tower
                                            </button>
                                            <button type="button" class="button is-small is-danger is-light" on:click={() => removeEntry(entry.id)}>
                                                Remove
                                            </button>
                                        </div>
                                        
                                        <div class="field bulk-date-field">
                                            <label class="label is-small" for="date-{entry.id}">Date Grabbed (Optional):</label>
                                            <div class="control">
                                                <input 
                                                    type="date" 
                                                    id="date-{entry.id}"
                                                    bind:value={entry.dateGrabbed}
                                                    max={new Date().toISOString().split('T')[0]}
                                                    class="input is-small"
                                                />
                                            </div>
                                        </div>
                                        
                                        {#if entry.bells.length > 0}
                                            <div class="bulk-bells-selection">
                                                <div class="bulk-bells-header">
                                                    <strong>Bells:</strong>
                                                    <label class="checkbox">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={entry.allBells}
                                                            on:change={() => {
                                                                entry.allBells = !entry.allBells;
                                                                toggleAllBells(entry);
                                                            }}
                                                        />
                                                        Select All
                                                    </label>
                                                </div>
                                                <div class="bulk-bells-grid">
                                                    {#each entry.bells as bell}
                                                        <label class="bulk-bell-checkbox" class:selected={entry.selectedBells.has(String(bell.BellID))}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={entry.selectedBells.has(String(bell.BellID))}
                                                                on:change={() => toggleBell(entry, bell.BellID)}
                                                            />
                                                            <span class="bulk-bell-role">{bell.BellRole || '?'}</span>
                                                            {#if bell.WeightLbs}
                                                                <span class="bulk-bell-weight">({lbsToHundredweight(bell.WeightLbs)})</span>
                                                            {/if}
                                                        </label>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                        {:else}
                            <div class="search-row bulk-search-row">
                                <span class="compact-index">{index + 1}.</span>
                                <div class="dropdown bulk-search-input-wrapper" class:is-active={entry.searchResults.length > 0}>
                                    <div class="dropdown-trigger" style="width: 100%;">
                                        <div class="control" class:is-loading={entry.loading}>
                                            <input
                                                type="text"
                                                class="input"
                                                placeholder="Search for a tower..."
                                                bind:value={entry.searchQuery}
                                                on:input={() => handleSearchInput(entry)}
                                                on:keydown={(e) => handleKeydown(e, entry)}
                                                aria-haspopup="true"
                                                aria-controls="dropdown-menu-{entry.id}"
                                            />
                                        </div>
                                    </div>
                                    
                                    {#if entry.searchResults.length > 0}
                                        <div class="dropdown-menu bulk-search-dropdown" id="dropdown-menu-{entry.id}" role="menu">
                                            <div class="dropdown-content">
                                                {#each entry.searchResults as tower}
                                                    <button 
                                                        type="button" 
                                                        class="dropdown-item"
                                                        on:click={() => selectTower(entry, tower)}
                                                    >
                                                        <strong>{tower.Place}</strong>
                                                        {#if tower.Dedicn}, {tower.Dedicn}{/if}
                                                        <span class="tower-meta">
                                                            {tower.County || ''} • {tower.Bells} bells
                                                            {#if tower.UR === '1' || tower.UR === 1}
                                                                <span class="unringable">Unringable</span>
                                                            {/if}
                                                        </span>
                                                    </button>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>

            <div class="box bulk-submit-section">
                <div class="bulk-submit-info">
                    {#if validEntries.length > 0}
                        <p>Ready to add <strong>{validEntries.length}</strong> grab{validEntries.length !== 1 ? 's' : ''}</p>
                    {:else}
                        <p class="has-text-grey">Search and select towers above to add grabs</p>
                    {/if}
                </div>
                <button 
                    type="submit" 
                    class="button is-primary is-medium"
                    disabled={!hasValidEntries || submitting}
                >
                    {#if submitting}
                        Saving...
                    {:else}
                        Save Grabs
                    {/if}
                </button>
            </div>

            <p class="help-text mb-4">
                Search for towers below to add multiple grabs at once.<br>Optionally, select grabbed bells and dates.
            </p>
        </form>
    </div>
</main>

<Footer />
