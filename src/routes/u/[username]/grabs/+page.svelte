<script>
    import { onMount } from 'svelte';
    import Header from '$lib/components/Header.svelte';
    import TowerMap from '$lib/components/TowerMap.svelte';

    export let data;

    let result = null;
    let loading = true;
    let loadError = '';
    let showAdvanced = false;
    let query = '';
    let sortOption = 'dateGrabbed';
    let sortDirection = 'desc';
    let filters = {
        place: '',
        dedication: '',
        county: '',
        diocese: '',
        key: '',
        affiliation: '',
        bellName: '',
        minBells: '',
        maxBells: '',
        minWeight: '',
        maxWeight: '',
        fromDate: '',
        toDate: ''
    };

    onMount(async () => {
        const params = new URLSearchParams(window.location.search);
        const month = params.get('month');
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const start = new Date(`${month}-01T00:00:00`);
            const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            filters = {
                ...filters,
                fromDate: `${month}-01`,
                toDate: `${month}-${String(end.getDate()).padStart(2, '0')}`
            };
            showAdvanced = true;
        }

        try {
            const response = await fetch(`/api/user-grabs/${encodeURIComponent(data.targetUser.username).replace(/%20/g, '-')}`);
            if (!response.ok) throw new Error(`Request failed: ${response.status}`);
            result = await response.json();
        } catch (error) {
            console.error('Failed to load user grabs:', error);
            loadError = 'Unable to load this user’s grabbed towers.';
        } finally {
            loading = false;
        }
    });

    function text(value) {
        return String(value ?? '').toLowerCase();
    }

    function number(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function matchesText(value, filter) {
        return !filter || text(value).includes(text(filter));
    }

    function matchesNumber(value, minimum, maximum) {
        const actual = number(value);
        if (minimum !== '' && (actual === null || actual < number(minimum))) return false;
        if (maximum !== '' && (actual === null || actual > number(maximum))) return false;
        return true;
    }

    $: filteredGrabs = (result?.grabs || []).filter((grab) => {
        const bellText = (grab.bells || []).map((bell) => `${bell.BellName} ${bell.BellRole}`).join(' ');
        const date = grab.dateGrabbed || '';
        return (!query || [
            grab.towerID, grab.ringID, grab.Place, grab.Dedicn, grab.County, grab.Bells,
            grab.UR, grab.Wt, grab.Diocese, grab.Note, grab.Affiliations, date, bellText
        ].some((value) => text(value).includes(text(query)))) &&
            matchesText(grab.Place, filters.place) &&
            matchesText(grab.Dedicn, filters.dedication) &&
            matchesText(grab.County, filters.county) &&
            matchesText(grab.Diocese, filters.diocese) &&
            matchesText(grab.Note, filters.key) &&
            matchesText(grab.Affiliations, filters.affiliation) &&
            matchesText(bellText, filters.bellName) &&
            matchesNumber(grab.Bells, filters.minBells, filters.maxBells) &&
            matchesNumber(grab.Wt, filters.minWeight, filters.maxWeight) &&
            (!filters.fromDate || date >= filters.fromDate) &&
            (!filters.toDate || date <= filters.toDate);
    }).sort((a, b) => {
        let comparison;
        if (sortOption === 'bells' || sortOption === 'Wt') {
            comparison = (number(a[sortOption]) || 0) - (number(b[sortOption]) || 0);
        } else {
            comparison = text(a[sortOption]).localeCompare(text(b[sortOption]));
        }
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    $: affiliations = [...new Set((result?.grabs || [])
        .flatMap((grab) => String(grab.Affiliations || '').split(',').map((value) => value.trim()))
        .filter(Boolean))].sort();

    function toggleSort(option) {
        if (sortOption === option) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        else {
            sortOption = option;
            sortDirection = option === 'dateGrabbed' ? 'desc' : 'asc';
        }
    }

    function formatDate(date) {
        return date ? new Date(date).toLocaleDateString('en-GB') : 'Not dated';
    }

    function formatWeight(weight) {
        const lbs = number(weight);
        if (lbs === null) return '';
        return `${Math.floor(lbs / 112)}-${Math.floor((lbs % 112) / 28)}-${lbs % 28}`;
    }

    function clearFilters() {
        filters = { place: '', dedication: '', county: '', diocese: '', key: '', affiliation: '', bellName: '', minBells: '', maxBells: '', minWeight: '', maxWeight: '', fromDate: '', toDate: '' };
        query = '';
    }

    function sortIndicator(option) {
        return sortOption === option ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
    }

    $: hasActiveFilters = Boolean(query || Object.values(filters).some(Boolean));
    $: filteredTowerIds = new Set(filteredGrabs.map((grab) => String(grab.towerID)));
    $: mapTowers = (result?.mapTowers || []).filter((tower) => filteredTowerIds.has(String(tower.TowerID)));
    let viewType = 'compact';
    let expandedItems = new Set();

    function toggleExpanded(key) {
        if (expandedItems.has(key)) expandedItems.delete(key);
        else expandedItems.add(key);
        expandedItems = expandedItems;
    }
</script>

<svelte:head>
    <title>Grabbed towers for {data.targetUser.username} | towertracker</title>
    <link rel="stylesheet" href="/assets/css/bellboard-summary.css">
    <link rel="stylesheet" href="/assets/css/profile.css">
</svelte:head>

<Header user={data.user} />

<main class="section grabs-page">
    <div class="container">
        <h1 class="title">Grabbed towers</h1>
        <p class="subtitle is-5">Towers grabbed by {data.targetUser.username}</p>

        {#if loading}
            <progress class="progress is-link"></progress>
        {:else if loadError}
            <div class="notification is-danger">{loadError}</div>
        {:else if result}
            {#if data.isOwnProfile}
                <div class="buttons mb-5">
                    <a href="/grab/add" class="button is-link">Add a grab</a>
                    <a href="/grab/bulk" class="button is-link is-info">Add grabs in bulk</a>
                </div>
            {/if}

            <div class="columns is-mobile is-multiline statistics-overview">
                <div class="column is-half-mobile is-one-quarter-tablet"><div class="box has-text-centered profile-stat-card"><p class="title is-3">{result.statistics.totalGrabs}</p><p>Tower grabs</p></div></div>
                <div class="column is-half-mobile is-one-quarter-tablet"><div class="box has-text-centered profile-stat-card"><p class="title is-3">{result.statistics.uniqueTowers}</p><p>Unique towers</p></div></div>
                <div class="column is-half-mobile is-one-quarter-tablet"><div class="box has-text-centered profile-stat-card"><p class="title is-3">{result.statistics.individualBells}</p><p>Individual bells grabbed</p></div></div>
                <div class="column is-half-mobile is-one-quarter-tablet"><div class="box has-text-centered profile-stat-card"><p class="title is-3">{result.statistics.uniqueBells}</p><p>Unique bells</p></div></div>
            </div>

            <section class="box mb-5">
                <div class="level mb-3">
                    <div class="level-left">
                        <div>
                            <h2 class="subtitle is-4 mb-1">Map of filtered grabs</h2>
                            <p class="is-size-7 has-text-grey">The map updates as you search and filter the list.</p>
                        </div>
                    </div>
                    <div class="level-right">
                        <span class="tag is-info">{mapTowers.length} towers</span>
                    </div>
                </div>
                <div class="grab-map-container">
                    <TowerMap
                        towers={mapTowers}
                        bellsFilter={0}
                        isMinimumBells={true}
                        showUnringable={true}
                        displayLimit={1000}
                        includeGrabbed={false}
                        includeQuartered={false}
                        includePealed={false}
                        showLocationTracking={false}
                        showClosestTower={false}
                        showTowerCount={false}
                        autoFitBounds={true}
                        initialCenter={[52, 0]}
                        initialZoom={6}
                        mapHeight="400px"
                    />
                </div>
            </section>

            <h2>Grabbed towers</h2>
            <section class="filter-section">
                <div class="field">
                    <label class="label" for="grab-search">Search grabbed towers</label>
                    <div class="control">
                        <input id="grab-search" class="input" type="search" bind:value={query} placeholder="Search tower, date, bell, or database field...">
                    </div>
                </div>
                <div class="field is-grouped is-grouped-multiline">
                    {#each [['dateGrabbed', 'Date'], ['Place', 'Place'], ['County', 'County'], ['bells', 'Bells']] as option}
                        <p class="control">
                            <button type="button" class="button is-small {sortOption === option[0] ? 'is-link' : ''}" on:click={() => toggleSort(option[0])}>
                                Sort by {option[1]}{sortIndicator(option[0])}
                            </button>
                        </p>
                    {/each}
                    <p class="control">
                        <a class="button is-small is-info" href={`/map?u=${encodeURIComponent(data.targetUser.username)}&grabbed=include`}>See grabs on map</a>
                    </p>
                </div>
                <div class:open={showAdvanced} class="grab-filters-drawer">
                    <button type="button" class="grab-filters-tab" on:click={() => showAdvanced = !showAdvanced} aria-expanded={showAdvanced}>
                        <span>Advanced filters</span>
                        {#if hasActiveFilters}<span class="filter-active-dot" aria-label="Filters active" title="Filters active"></span>{/if}
                    </button>
                    <div class="filter-panel">
                        <div class="filter-group filter-row">
                            {#each [['place', 'Place'], ['dedication', 'Dedication'], ['county', 'County'], ['diocese', 'Diocese'], ['key', 'Key / Note'], ['bellName', 'Bell name or role']] as field}
                                <div class="filter-field"><label for={field[0]}>{field[1]}:</label><input id={field[0]} type="text" bind:value={filters[field[0]]}></div>
                            {/each}
                        </div>
                        <div class="filter-group">
                            <div class="filter-field">
                                <label for="affiliation">Affiliation:</label>
                                <select id="affiliation" bind:value={filters.affiliation}>
                                    <option value="">All affiliations</option>
                                    {#each affiliations as affiliation}
                                        <option value={affiliation}>{affiliation}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="filter-group filter-row">
                            {#each [['minBells', 'Min bells'], ['maxBells', 'Max bells'], ['minWeight', 'Min weight (lbs)'], ['maxWeight', 'Max weight (lbs)']] as field}
                                <div class="filter-field"><label for={field[0]}>{field[1]}:</label><input id={field[0]} type="number" min="0" bind:value={filters[field[0]]}></div>
                            {/each}
                        </div>
                        <div class="filter-group filter-row">
                            <div class="filter-field"><label for="fromDate">Grabbed from:</label><input id="fromDate" type="date" bind:value={filters.fromDate}></div>
                            <div class="filter-field"><label for="toDate">Grabbed to:</label><input id="toDate" type="date" bind:value={filters.toDate}></div>
                        </div>
                        <div class="filter-actions"><button type="button" class="reset-btn" on:click={clearFilters}>Reset Filters</button></div>
                    </div>
                </div>
                <p class="filter-results">Showing {filteredGrabs.length} of {result.grabs.length} grabbed towers</p>
            </section>

            <div class="view-toggle">
                <button type="button" class:active={viewType === 'compact'} on:click={() => viewType = 'compact'}>List</button>
                <button type="button" class:active={viewType === 'detailed'} on:click={() => viewType = 'detailed'}>Detailed</button>
            </div>

            {#if filteredGrabs.length}
                {#if viewType === 'detailed'}
                    <div class="performances-container">
                        {#each filteredGrabs as grab}
                            <article class="performance-card">
                                <div class="performance-content">
                                    <div class="performance-main">
                                        <p class="performance-title"><a href="/tower/{grab.towerID}">{grab.Place || 'Unknown place'}{grab.Dedicn ? `, ${grab.Dedicn}` : ''}</a></p>
                                        <p class="performance-date">{formatDate(grab.dateGrabbed)} · Ring {grab.ringID}</p>
                                        <div class="performance-details">
                                            <p>{grab.County || 'County unknown'} · {grab.Bells || '?'} bells{grab.UR ? ` · ${grab.UR}` : ''}{grab.Wt ? ` · Tenor ${formatWeight(grab.Wt)}` : ''}</p>
                                            {#if grab.bells?.length}<div class="footnotes-list">{#each grab.bells as bell}<div class="footnote-item">{bell.BellName || bell.BellRole}</div>{/each}</div>{/if}
                                        </div>
                                    </div>
                                    <div class="performance-link"><a href="/tower/{grab.towerID}">View Tower</a><br><a href="/grab/add?towerId={grab.towerID}&ringId={grab.ringID || 1}">Edit Grab</a></div>
                                </div>
                            </article>
                        {/each}
                    </div>
                {:else}
                    <div class="compact-list">
                        {#each filteredGrabs as grab}
                            {@const key = `${grab.towerID}:${grab.ringID}`}
                            <div class="compact-item" class:expanded={expandedItems.has(key)}>
                                <button type="button" class="compact-row" on:click={() => toggleExpanded(key)}>
                                    <span class="compact-date">{formatDate(grab.dateGrabbed)}</span>
                                    <span class="compact-place">{grab.Place || 'Unknown place'}{grab.Dedicn ? `, ${grab.Dedicn}` : ''}</span>
                                    <span class="compact-method">{grab.Bells || '?'} bells</span>
                                    <span class="compact-expand-icon">{expandedItems.has(key) ? '▼' : '▶'}</span>
                                </button>
                                {#if expandedItems.has(key)}
                                    <div class="compact-details"><div class="compact-details-content">
                                        <p><strong>County:</strong> {grab.County || 'Unknown'}</p>
                                        {#if grab.UR}<p><strong>UR:</strong> {grab.UR}</p>{/if}
                                        {#if grab.Wt}<p><strong>Tenor:</strong> {formatWeight(grab.Wt)}</p>{/if}
                                        {#if grab.bells?.length}<p><strong>Bells grabbed:</strong> {grab.bells.map((bell) => bell.BellName || bell.BellRole).join(', ')}</p>{/if}
                                        <a href="/tower/{grab.towerID}">View Tower</a>
                                    </div></div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            {:else}
                <div class="notification is-info">No grabbed towers match these filters.</div>
            {/if}
        {/if}
    </div>
</main>
