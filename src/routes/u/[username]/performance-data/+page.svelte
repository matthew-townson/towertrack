<script>
    import { enhance } from '$app/forms';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { convertToHundredweight } from '$lib/mapUtils.js';
    export let data;
    export let form;
    let loading = false;
    let showNotification = false;

    let progressStage = 'idle';
    let progressPercent = 0;
    let progressMessage = '';

    let pollHandle = null;
    
    // Filter state
    let filters = {
        type: 'all',
        minChanges: '',
        maxChanges: '',
        association: '',
        place: '',
        county: '',
        method: '',
        dateFrom: '',
        dateTo: '',
        year: '',
        month: '',
        dayOfMonth: '',
        dayOfWeek: '',
        hasDuration: false,
        conductorName: '',
        otherRinger: ''
    };
    
    let showFilters = false;
    let viewType = 'compact';
    let expandedItems = new Set();
    
    function toggleExpanded(id) {
        if (expandedItems.has(id)) {
            expandedItems.delete(id);
        } else {
            expandedItems.add(id);
        }
        expandedItems = expandedItems;
    }
    
    function formatDateLong(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    
    $: associations = [...new Set(data?.performances?.map(p => p.Association).filter(Boolean))].sort();
    
    $: counties = [...new Set(data?.performances?.map(p => p.County).filter(Boolean))].sort();
    
    $: years = [...new Set(data?.performances?.map(p => p.Date ? new Date(p.Date).getFullYear() : null).filter(Boolean))].sort((a, b) => b - a);

    function nameMatches(fullName, searchTerm) {
        const nameWords = fullName.toLowerCase().split(/\s+/);
        const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        if (searchWords.length === 0) return false;
        
        let nameIndex = 0;
        for (const searchWord of searchWords) {
            let found = false;
            while (nameIndex < nameWords.length) {
                if (nameWords[nameIndex].startsWith(searchWord)) {
                    found = true;
                    nameIndex++;
                    break;
                }
                nameIndex++;
            }
            if (!found) return false;
        }
        return true;
    }
    
    function hasConductor(perf, conductorName) {
        if (!perf.ringers || !conductorName) return false;
        return perf.ringers.some(r => {
            const name = r?.name || '';
            return r?.conductor && nameMatches(name, conductorName);
        });
    }
    
    function hasRinger(perf, ringerName) {
        if (!perf.ringers || !ringerName) return false;
        return perf.ringers.some(r => {
            const name = r?.name || '';
            return nameMatches(name, ringerName);
        });
    }
    
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // apply filters to performances
    $: filteredPerformances = (data?.performances || []).filter(perf => {
        if (filters.type !== 'all') {
            const changes = perf.Changes || 0;
            if (filters.type === 'peal' && changes < 5000) return false;
            if (filters.type === 'half' && (changes < 2500 || changes >= 5000)) return false;
            if (filters.type === 'quarter' && (changes < 1250 || changes >= 2500)) return false;
            if (filters.type === 'short' && changes >= 1250) return false;
        }
        
        if (filters.minChanges && perf.Changes < parseInt(filters.minChanges)) return false;
        if (filters.maxChanges && perf.Changes > parseInt(filters.maxChanges)) return false;
        
        if (filters.association && perf.Association !== filters.association) return false;
        
        if (filters.place && !perf.Place?.toLowerCase().includes(filters.place.toLowerCase())) return false;
        
        if (filters.county && perf.County !== filters.county) return false;
        
        if (filters.method && !perf.Method?.toLowerCase().includes(filters.method.toLowerCase())) return false;
        
        if (filters.dateFrom && perf.Date) {
            const perfDate = new Date(perf.Date);
            const fromDate = new Date(filters.dateFrom);
            if (perfDate < fromDate) return false;
        }
        if (filters.dateTo && perf.Date) {
            const perfDate = new Date(perf.Date);
            const toDate = new Date(filters.dateTo);
            if (perfDate > toDate) return false;
        }
        
        if (filters.year && perf.Date) {
            const perfYear = new Date(perf.Date).getFullYear();
            if (perfYear !== parseInt(filters.year)) return false;
        }
        
        if (filters.month && perf.Date) {
            const perfMonth = new Date(perf.Date).getMonth();
            if (perfMonth !== parseInt(filters.month)) return false;
        }
        
        if (filters.dayOfMonth && perf.Date) {
            const perfDay = new Date(perf.Date).getDate();
            if (perfDay !== parseInt(filters.dayOfMonth)) return false;
        }
        
        if (filters.dayOfWeek && perf.Date) {
            const perfDayOfWeek = new Date(perf.Date).getDay();
            if (perfDayOfWeek !== parseInt(filters.dayOfWeek)) return false;
        }
        
        if (filters.hasDuration && !perf.Duration) return false;
        
        if (filters.conductorName && !hasConductor(perf, filters.conductorName)) return false;
        
        if (filters.otherRinger && !hasRinger(perf, filters.otherRinger)) return false;
        
        return true;
    });
    
    function resetFilters() {
        filters = {
            type: 'all',
            minChanges: '',
            maxChanges: '',
            association: '',
            place: '',
            county: '',
            method: '',
            dateFrom: '',
            dateTo: '',
            year: '',
            month: '',
            dayOfMonth: '',
            dayOfWeek: '',
            hasDuration: false,
            conductorName: '',
            otherRinger: ''
        };
    }
    
    $: hasActiveFilters = filters.type !== 'all' || filters.association || filters.place || 
        filters.county || filters.method || filters.dateFrom || filters.dateTo || 
        filters.year || filters.month || filters.dayOfMonth || filters.dayOfWeek ||
        filters.hasDuration || filters.conductorName || filters.otherRinger ||
        filters.minChanges || filters.maxChanges;
    
    function setTypeFilter(type) {
        filters.type = type;
        if (type === 'peal') {
            filters.minChanges = '5000';
            filters.maxChanges = '';
        } else if (type === 'half') {
            filters.minChanges = '2500';
            filters.maxChanges = '4999';
        } else if (type === 'quarter') {
            filters.minChanges = '1250';
            filters.maxChanges = '2499';
        } else if (type === 'short') {
            filters.minChanges = '';
            filters.maxChanges = '1249';
        } else {
            filters.minChanges = '';
            filters.maxChanges = '';
        }
    }

    $: if (form?.success || form?.error) showNotification = true;

    function lbsToHundredweight(lbs) {
        return convertToHundredweight(lbs);
    }

    function isDuplicateBell(ringers, ringer, index) {
        return (ringer?.bell != null) && (ringers.findIndex(r => r?.bell === ringer.bell) !== index);
    }

    function getBellLabel(ringers, ringer, index) {
        if (ringer?.bell != null) {
            const firstIndex = ringers.findIndex(r => r?.bell === ringer.bell);
            return firstIndex === index ? String(ringer.bell) : null;
        }
        return String(index + 1);
    }

    async function pollProgressLoop(updateOnComplete) {
        try {
            while (loading) {
                const res = await fetch('/api/import-progress', { credentials: 'same-origin' });
                if (!res.ok) {
                    const jsonErr = await res.json().catch(() => ({}));
                    progressStage = jsonErr?.stage || 'error';
                    progressMessage = jsonErr?.message || `Progress endpoint returned ${res.status}`;
                    break;
                }
                const p = await res.json();
                progressStage = p.stage || 'idle';
                progressPercent = p.percent || 0;
                progressMessage = p.message || '';

                if (progressStage === 'done' || progressPercent >= 100) {
                    loading = false;
                    if (typeof updateOnComplete === 'function') {
                        await updateOnComplete();
                    }
                    break;
                }

                await new Promise(r => setTimeout(r, 800));
            }
        } catch (err) {
            progressStage = 'error';
            progressMessage = err.message || String(err);
            loading = false;
        }
    }
</script>

<svelte:head>
    <title>{data.targetUser?.username ? `${data.targetUser.username}'s Performance Data` : 'Performance Data'} | towertracker</title>
    <link rel="stylesheet" href="/assets/css/bellboard-summary.css">
</svelte:head>

<Header user={data.user} />

<main>    
    <p class="back-link">
        Performance Data for <a href="/u/{data.targetUser?.username?.replace(/ /g, '-')}">{data.targetUser?.username || 'Unknown User'}</a>
    </p>

    {#if data.dataHidden}
        <div class="notification is-warning">
            <p>{data.targetUser?.username || 'Unknown User'} has set their performance data to private.</p>
        </div>
    {:else}
        <!-- Stats summary -->
        {#if data?.stats}
            <section class="box">
                <p><strong>Peals:</strong> {data.stats.peal_count}</p>
                <p><strong>Half peals:</strong> {data.stats.half_peal_count}</p>
                <p><strong>Quarter peals:</strong> {data.stats.quarter_count}</p>
                <p><strong>Total Performances:</strong> {data.stats.performance_count}</p>
                
                {#if data.isOwnProfile}
                    <form method="POST" action="?/importBBData" use:enhance={() => {
                        loading = true;
                        progressStage = 'starting';
                        progressPercent = 0;
                        progressMessage = 'Starting import...';

                        return async ({ result, update }) => {
                            if (result?.type === 'success') {
                                await pollProgressLoop(update);
                            } else {
                                loading = false;
                                progressStage = 'error';
                                progressMessage = (result && result.data && result.data.message) ? result.data.message : 'Import failed to start';
                            }
                        };
                    }}>
                        <button type="submit" disabled={loading}>
                            {loading ? 'Updating...' : 'Update performances'}
                        </button>
                    </form>

                    {#if loading}
                        <div class="notification is-info mt-3">
                            <strong>Importing:</strong> {progressStage} — {progressPercent}%<br>
                            <small>{progressMessage}</small>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width:{progressPercent}%;"></div>
                        </div>
                    {/if}

                    {#if form?.success && showNotification}
                        <div class="notification is-success">
                            <button class="notification-close" aria-label="Close" on:click={() => showNotification = false}>×</button>
                            {form.message}
                        </div>
                    {/if}
                    {#if form?.error && showNotification}
                        <div class="notification is-danger">
                            <button class="notification-close" aria-label="Close" on:click={() => showNotification = false}>×</button>
                            {form.message}
                        </div>
                    {/if}
                {/if}
            </section>
        {/if}

        <h2>Performances</h2>
        
        <!-- Filter Section -->
        <section class="filter-section">
            <button class="filter-toggle" on:click={() => showFilters = !showFilters}>
                {showFilters ? '▼' : '▶'} Filters
                {#if hasActiveFilters}
                    <span class="filter-active-badge">Active</span>
                {/if}
            </button>
            
            {#if showFilters}
                <div class="filter-panel">
                    <!-- Quick type filters -->
                    <div class="filter-group">
                        <label for="perf-type-filter">Performance Type:</label>
                        <div class="filter-buttons" id="perf-type-filter">
                            <button class:active={filters.type === 'all'} on:click={() => setTypeFilter('all')}>All</button>
                            <button class:active={filters.type === 'peal'} on:click={() => setTypeFilter('peal')}>Peals (5000+)</button>
                            <button class:active={filters.type === 'half'} on:click={() => setTypeFilter('half')}>Half Peals (2500-4999)</button>
                            <button class:active={filters.type === 'quarter'} on:click={() => setTypeFilter('quarter')}>Quarters (1250-2499)</button>
                            <button class:active={filters.type === 'short'} on:click={() => setTypeFilter('short')}>Short Touches (&lt;1250)</button>
                        </div>
                    </div>
                    
                    <!-- Custom changes range -->
                    <div class="filter-group filter-row">
                        <div class="filter-field">
                            <label for="minChanges">Min Changes:</label>
                            <input type="number" id="minChanges" bind:value={filters.minChanges} placeholder="e.g. 1250" min="0">
                        </div>
                        <div class="filter-field">
                            <label for="maxChanges">Max Changes:</label>
                            <input type="number" id="maxChanges" bind:value={filters.maxChanges} placeholder="e.g. 5000" min="0">
                        </div>
                    </div>
                    
                    <!-- Conductor and Ringer search -->
                    <div class="filter-group filter-row">
                        <div class="filter-field">
                            <label for="conductorName">Conductor:</label>
                            <input type="text" id="conductorName" bind:value={filters.conductorName} placeholder="Search by conductor...">
                        </div>
                        <div class="filter-field">
                            <label for="otherRinger">Ringer:</label>
                            <input type="text" id="otherRinger" bind:value={filters.otherRinger} placeholder="Search by ringer...">
                        </div>
                    </div>
                    
                    <!-- Association filter -->
                    <div class="filter-group">
                        <label for="association">Association:</label>
                        <select id="association" bind:value={filters.association}>
                            <option value="">All Associations</option>
                            {#each associations as assoc}
                                <option value={assoc}>{assoc}</option>
                            {/each}
                        </select>
                    </div>
                    
                    <!-- Place and Method filters -->
                    <div class="filter-group filter-row">
                        <div class="filter-field">
                            <label for="place">Place:</label>
                            <input type="text" id="place" bind:value={filters.place} placeholder="Search place...">
                        </div>
                        <div class="filter-field">
                            <label for="method">Method:</label>
                            <input type="text" id="method" bind:value={filters.method} placeholder="Search method...">
                        </div>
                    </div>
                    
                    <!-- County filter -->
                    <div class="filter-group">
                        <label for="county">County:</label>
                        <select id="county" bind:value={filters.county}>
                            <option value="">All Counties</option>
                            {#each counties as county}
                                <option value={county}>{county}</option>
                            {/each}
                        </select>
                    </div>
                    
                    <!-- Date range -->
                    <div class="filter-group filter-row">
                        <div class="filter-field">
                            <label for="dateFrom">Date From:</label>
                            <input type="date" id="dateFrom" bind:value={filters.dateFrom}>
                        </div>
                        <div class="filter-field">
                            <label for="dateTo">Date To:</label>
                            <input type="date" id="dateTo" bind:value={filters.dateTo}>
                        </div>
                    </div>
                    
                    <!-- Year, Month, Day filters -->
                    <div class="filter-group filter-row">
                        <div class="filter-field">
                            <label for="year">Year:</label>
                            <select id="year" bind:value={filters.year}>
                                <option value="">All Years</option>
                                {#each years as year}
                                    <option value={year}>{year}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="filter-field">
                            <label for="month">Month:</label>
                            <select id="month" bind:value={filters.month}>
                                <option value="">All Months</option>
                                {#each months as m, i}
                                    <option value={i}>{m}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    
                    <div class="filter-group filter-row">
                        <div class="filter-field">
                            <label for="dayOfMonth">Day of Month:</label>
                            <select id="dayOfMonth" bind:value={filters.dayOfMonth}>
                                <option value="">Any Day</option>
                                {#each Array.from({length: 31}, (_, i) => i + 1) as day}
                                    <option value={day}>{day}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="filter-field">
                            <label for="dayOfWeek">Day of Week:</label>
                            <select id="dayOfWeek" bind:value={filters.dayOfWeek}>
                                <option value="">Any Day</option>
                                {#each daysOfWeek as dow, i}
                                    <option value={i}>{dow}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Duration filter -->
                    <div class="filter-group">
                        <label class="checkbox-label">
                            <input type="checkbox" bind:checked={filters.hasDuration}>
                            Only show performances with recorded duration
                        </label>
                    </div>
                    
                    <div class="filter-actions">
                        <button class="reset-btn" on:click={resetFilters}>Reset Filters</button>
                    </div>
                </div>
            {/if}
            
            <p class="filter-results">
                Showing {filteredPerformances.length} of {data?.performances?.length || 0} performances
            </p>
        </section>
        
        <!-- View toggle -->
        <div class="view-toggle">
            <button class:active={viewType === 'compact'} on:click={() => viewType = 'compact'}>
                List
            </button>
            <button class:active={viewType === 'detailed'} on:click={() => viewType = 'detailed'}>
                [Old] Detailed
            </button>
        </div>
        
        {#if filteredPerformances.length > 0}
            {#if viewType === 'detailed'}
                <div class="performances-container">
                    {#each filteredPerformances as perf}
                        <div class="performance-card">
                            <div class="performance-content">
                                <div class="performance-main">
                                    <p class="performance-title">
                                        {perf.Changes || 'N/A'} {perf.Method || ''}
                                    </p>
                                    <p class="performance-date">
                                        {perf.Date ? new Date(perf.Date).toLocaleDateString() : 'N/A'}{perf.Duration ? ` in ${perf.Duration}` : ''}
                                    </p>
                                    
                                    <div class="performance-details">
                                        <p>{perf.Association || ''}</p>

                                        <p>
                                            {perf.Place ? `${perf.Place}` : ''}{perf.Dedication ? `, ${perf.Dedication}` : ''}{perf.County ? `, ${perf.County}` : ''}{perf.TenorWeightLbs ? ` (${lbsToHundredweight(perf.TenorWeightLbs)}` : ''}{perf.TenorKey && perf.TenorWeightLbs ? ` in ${perf.TenorKey})` : ''}
                                        </p>
                                        
                                        {#if perf.ringers && perf.ringers.length > 0}
                                            <div class="footnotes-list">
                                                {#each perf.ringers as ringer, index}
                                                    <div class="footnote-item">
                                                        {#if getBellLabel(perf.ringers, ringer, index)}
                                                            <strong class="bell-number">{getBellLabel(perf.ringers, ringer, index)}.</strong>&nbsp;
                                                        {/if}
                                                        {ringer.name}{ringer.conductor ? ' (C)' : ''}
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                        
                                        {#if perf.footnotes && perf.footnotes.length > 0}
                                            <div class="footnotes-list">
                                                {#each perf.footnotes as footnote}
                                                    <div class="footnote-item">{footnote}</div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                                
                                {#if perf.PerformanceID}
                                    <div class="performance-link">
                                        <a href="/bellboard/performance?id={perf.PerformanceID}">View Details</a>
                                        <br>
                                        <a href={`https://bb.ringingworld.co.uk/view.php?id=P${perf.PerformanceID}`} target="_blank" rel="noopener noreferrer">View on BellBoard</a>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <!-- Compact list view (BellBoard style) -->
                <div class="compact-list">
                    {#each filteredPerformances as perf}
                        <div class="compact-item" class:expanded={expandedItems.has(perf.PerformanceID)}>
                            <button class="compact-row" on:click={() => toggleExpanded(perf.PerformanceID)}>
                                <span class="compact-date">{formatDateLong(perf.Date)}</span>
                                <span class="compact-place">{perf.Place || ''}{perf.Dedication ? `, ${perf.Dedication}` : ''}{perf.County ? `, ${perf.County}` : ''}</span>
                                <span class="compact-method">{perf.Changes || 'N/A'} {perf.Method || ''}</span>
                                <span class="compact-expand-icon">{expandedItems.has(perf.PerformanceID) ? '▼' : '▶'}</span>
                            </button>
                            
                            {#if expandedItems.has(perf.PerformanceID)}
                                <div class="compact-details">
                                    <div class="compact-details-content">
                                        {#if perf.Duration}
                                            <p><strong>Duration:</strong> {perf.Duration}</p>
                                        {/if}
                                        {#if perf.Association}
                                            <p><strong>Association:</strong> {perf.Association}</p>
                                        {/if}
                                        {#if perf.TenorWeightLbs}
                                            <p><strong>Tenor:</strong> {lbsToHundredweight(perf.TenorWeightLbs)}{perf.TenorKey ? ` in ${perf.TenorKey}` : ''}</p>
                                        {/if}
                                        
                                        {#if perf.ringers && perf.ringers.length > 0}
                                            <div class="compact-ringers">
                                                <strong>Ringers:</strong>
                                                <div class="footnotes-list">
                                                    {#each perf.ringers as ringer, index}
                                                        <div class="footnote-item">
                                                            {#if getBellLabel(perf.ringers, ringer, index)}
                                                                <strong class="bell-number">{getBellLabel(perf.ringers, ringer, index)}.</strong>&nbsp;
                                                            {/if}
                                                            {ringer.name}{ringer.conductor ? ' (C)' : ''}
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                        
                                        {#if perf.footnotes && perf.footnotes.length > 0}
                                            <div class="compact-footnotes">
                                                <strong>Footnotes:</strong>
                                                <div class="footnotes-list">
                                                    {#each perf.footnotes as footnote}
                                                        <div class="footnote-item">{footnote}</div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                        
                                        {#if perf.PerformanceID}
                                            <div class="compact-links">
                                                <a href="/bellboard/performance?id={perf.PerformanceID}">View Details</a>
                                                <a href={`https://bb.ringingworld.co.uk/view.php?id=P${perf.PerformanceID}`} target="_blank" rel="noopener noreferrer">View on BellBoard</a>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        {:else}
            <p class="no-results">No performances match your filters.</p>
        {/if}
    {/if}
</main>

<Footer />
