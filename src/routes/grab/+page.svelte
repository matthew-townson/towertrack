<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;
    
    let searchQuery = '';
    let sortOption = 'date';
    let sortDirection = 'desc';
    let filteredGrabs = [];
    let showSummary = true;
    
    function formatDate(dateStr) {
        if (!dateStr) return 'Unknown date';
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    }
    
    function formatWeight(weight) {
        if (!weight) return '';
        
        const cwt = Math.floor(weight / 112);
        const remaining = weight % 112;
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
    
    $: {
        filteredGrabs = [...data.grabs].filter(grab => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                (grab.Place && grab.Place.toLowerCase().includes(query)) ||
                (grab.Dedicn && grab.Dedicn.toLowerCase().includes(query)) ||
                (grab.County && grab.County.toLowerCase().includes(query))
            );
        });
        
        filteredGrabs.sort((a, b) => {
            if (sortOption === 'place') {
                const comparison = a.Place.localeCompare(b.Place);
                return sortDirection === 'asc' ? comparison : -comparison;
            } else if (sortOption === 'county') {
                const comparison = a.County?.localeCompare(b.County || '') || 0;
                return sortDirection === 'asc' ? comparison : -comparison;
            } else if (sortOption === 'bells') {
                const comparison = parseInt(a.Bells) - parseInt(b.Bells);
                return sortDirection === 'asc' ? comparison : -comparison;
            } else { // date
                const dateA = a.dateGrabbed ? new Date(a.dateGrabbed) : new Date(0);
                const dateB = b.dateGrabbed ? new Date(b.dateGrabbed) : new Date(0);
                const comparison = dateA - dateB;
                return sortDirection === 'asc' ? comparison : -comparison;
            }
        });
    }
    
    function toggleSort(option) {
        if (sortOption === option) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortOption = option;
            sortDirection = option === 'date' ? 'desc' : 'asc';
        }
    }

    function toggleSummary() {
        showSummary = !showSummary;
    }
</script>

<svelte:head>
    <title>Tower Grabs | towertracker</title>
    <link rel="stylesheet" href="/assets/css/grab.css">
    <link rel="stylesheet" href="/assets/css/bellboard-summary.css">
</svelte:head>

<Header user={data.user} />

<main>
    <h1>Quick Grab Statistics</h1>
    
    <div class="stats-summary">
        <div class="stat-card">
            <div class="stat-number">{data.grabCount}</div>
            <div class="stat-label">Total Grabs</div>
            <button type="button" class="view-all-link" on:click={() => showSummary = false}>View all grabs</button>
        </div>
    </div>
    
    <div class="settings-section">
        <div class="action-buttons">
            <a href="/grab/add" class="button add-grab-btn has-text-white">
                <span class="icon">+</span>
                Add a New Grab
            </a>

            <a href="/grab/bulk" class="button bulk-grab-btn has-text-white">
                <span class="icon">📋</span>
                Bulk Add Grabs
            </a>
            
            <a href="/map?grabbed=true" class="button map-btn has-text-dark">
                <span class="icon">🗺️</span>
                View on Map
            </a>

            <button class="button toggle-summary-btn has-text-white" on:click={toggleSummary}>
                <span class="icon">{showSummary ? '📋' : 'ℹ️'}</span>
                {showSummary ? 'Show List' : 'Show Summary'}
            </button>
        </div>
        
        {#if showSummary && data.recentGrabs && data.recentGrabs.length > 0}
            <div class="recent-grabs">
                <h3>Recent Grabs</h3>
                <div class="recent-grabs-list">
                    {#each data.recentGrabs as grab}
                        <div class="recent-grab-item">
                            <div class="grab-details">
                                <div class="grab-tower">
                                    <a href="/tower/{grab.towerID}">
                                        {grab.Place}{grab.Dedicn ? `, ${grab.Dedicn}` : ''}
                                    </a>
                                </div>
                                <div class="grab-info">
                                    {grab.County} • {grab.Bells} bells
                                    {#if grab.Wt}
                                        • Tenor: {formatWeight(grab.Wt)}
                                    {/if}
                                    • Grabbed on {formatDate(grab.dateGrabbed)}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
        
        {#if showSummary}
            <div class="grab-stats">
                <h3>Grab Statistics</h3>
                <p>Total Towers Grabbed: {data.grabCount || 0}</p>
            </div>
        {:else}
            <!-- Full list view -->
            <div class="grabs-list-section">
                <div class="controls">
                    <div class="search-box">
                        <input 
                            type="text" 
                            bind:value={searchQuery} 
                            placeholder="Search towers..." 
                            class="input search-input"
                        />
                    </div>
                    
                    <div class="sort-options">
                        <button 
                            class="sort-button {sortOption === 'date' ? 'active' : ''}"
                            on:click={() => toggleSort('date')}
                        >
                            Date {sortOption === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                        </button>
                        
                        <button 
                            class="sort-button {sortOption === 'place' ? 'active' : ''}"
                            on:click={() => toggleSort('place')}
                        >
                            Place {sortOption === 'place' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                        </button>
                        
                        <button 
                            class="sort-button {sortOption === 'county' ? 'active' : ''}"
                            on:click={() => toggleSort('county')}
                        >
                            County {sortOption === 'county' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                        </button>
                        
                        <button 
                            class="sort-button {sortOption === 'bells' ? 'active' : ''}"
                            on:click={() => toggleSort('bells')}
                        >
                            Bells {sortOption === 'bells' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                        </button>
                    </div>
                </div>
                
                {#if filteredGrabs.length > 0}
                    <div class="compact-list">
                        {#each filteredGrabs as grab}
                            <div class="compact-item">
                                <div class="compact-row">
                                    <div class="compact-date">
                                        {grab.dateGrabbed ? formatDate(grab.dateGrabbed) : 'Not dated'}
                                    </div>
                                    <div class="compact-place">
                                        <a href="/tower/{grab.towerID}">
                                            {grab.Place}{grab.Dedicn ? `, ${grab.Dedicn}` : ''}
                                        </a>
                                    </div>
                                    <div class="compact-method">
                                        {grab.County} • {grab.Bells} bells
                                        {#if grab.Wt}
                                            • Tenor: {formatWeight(grab.Wt)}
                                        {/if}
                                    </div>
                                    <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; color: #666;">
                                        {#if grab.bells && grab.bells.length > 0}
                                            Bells: {grab.bells.map(b => b.BellRole || 'Bell').join(', ')}
                                        {/if}
                                    </div>
                                    <div style="flex: 0 0 auto;">
                                        <a href="/grab/add?towerId={grab.towerID}" class="compact-link">Edit</a>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="no-grabs">
                        {#if data.grabs.length === 0}
                            <p>You haven't grabbed any towers yet.</p>
                            <a href="/grab/add" class="button add-button">Add Your First Grab</a>
                        {:else}
                            <p>No towers match your search.</p>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</main>

<Footer />
