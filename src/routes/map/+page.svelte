<script>
    import { onMount } from 'svelte';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import TowerMap from '$lib/components/TowerMap.svelte';
    import {
        generatePinSVG,
        extractPracticeNights
    } from '$lib/mapUtils.js';
    
    export let data;
    
    let sidebarOpen = false;
    
    // Map filter state
    let bellsFilter = 3;
    let isMinimumBells = true;
    let showUnringable = true;
    let practiceNightFilter = '';
    let displayLimit = 200;
    
    // Include/exclude filters
    let includeGrabbed = false;
    let excludeGrabbed = false;
    let includeQuartered = false;
    let excludeQuartered = false;
    let includePealed = false;
    let excludePealed = false;
    
    // State from map component
    let currentlyDisplayed = 0;
    let filteredTowerCount = 0;
    
    // Advanced filters state and options
    let counties = [];
    let countries = [];
    let dioceses = [];
    let minWtLbs = null;
    let maxWtLbs = null;

    let selectedCounty = '';
    let selectedCountry = '';
    let selectedDiocese = '';
    let minWeightCwt = '';
    let maxWeightCwt = '';
    let advancedOpen = false;

    // Extract unique practice nights (Mon-Sun) from tower.Practice, allow multiple per tower
    $: practiceNights = extractPracticeNights(data.towers);

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }
    
    // Initialize filters from URL params
    onMount(() => {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.has('bells')) bellsFilter = parseInt(urlParams.get('bells')) || 8;
        if (urlParams.has('minBells') || urlParams.has('minimum')) {
            isMinimumBells = urlParams.get('minBells') === 'true' || urlParams.get('minBells') === '1' || 
                            urlParams.get('minimum') === 'true' || urlParams.get('minimum') === '1';
        }
        if (urlParams.has('unringable')) {
            showUnringable = urlParams.get('unringable') === 'true' || urlParams.get('unringable') === '1';
        }
        if (urlParams.has('night') || urlParams.has('practice')) {
            practiceNightFilter = urlParams.get('night') || urlParams.get('practice');
        }
        if (urlParams.has('limit')) displayLimit = parseInt(urlParams.get('limit')) || 300;
        
        if (urlParams.has('grabbed')) {
            const val = urlParams.get('grabbed');
            if (val === '1' || val === 'true' || val === 'include') includeGrabbed = true;
            if (val === 'exclude') excludeGrabbed = true;
        }
        if (urlParams.has('quartered')) {
            const val = urlParams.get('quartered');
            if (val === '1' || val === 'true' || val === 'include') includeQuartered = true;
            if (val === 'exclude') excludeQuartered = true;
        }
        if (urlParams.has('pealed')) {
            const val = urlParams.get('pealed');
            if (val === '1' || val === 'true' || val === 'include') includePealed = true;
            if (val === 'exclude') excludePealed = true;
        }
        
        if (urlParams.has('excludeSpecial')) {
            const val = urlParams.get('excludeSpecial');
            if (val === '1' || val === 'true') {
                excludeGrabbed = true;
                excludeQuartered = true;
                excludePealed = true;
            }
        }
    });

    // fetch filter options for advanced filters
    onMount(async () => {
        try {
            const res = await fetch('/api/map-filters');
            if (res.ok) {
                const data = await res.json();
                counties = data.counties || [];
                countries = data.countries || [];
                dioceses = data.dioceses || [];
                minWtLbs = data.minWt ?? null;
                maxWtLbs = data.maxWt ?? null;

                if (minWtLbs) minWeightCwt = lbsToCwtDecimal(minWtLbs);
                if (maxWtLbs) maxWeightCwt = lbsToCwtDecimal(maxWtLbs);
            } else {
                console.warn('Failed to load map filters:', res.status);
            }
        } catch (err) {
            console.warn('Error fetching map filters:', err);
        }
    });
    
    $: legendGrabbedSVG = generatePinSVG(8, { grabbed: true });
    $: legendQuarterSVG = generatePinSVG(8, { quartered: true });
    $: legendPealSVG = generatePinSVG(8, { pealed: true });

    function lbsToCwtDecimal(lbs) {
        if (lbs === null || lbs === undefined) return '';
        const n = parseFloat(lbs);
        if (isNaN(n)) return '';
        return +(n / 112).toFixed(2);
    }

    function toggleAdvancedOpen() {
        advancedOpen = !advancedOpen;
    }

    function clearAdvanced() {
        selectedCounty = '';
        selectedCountry = '';
        selectedDiocese = '';
        minWeightCwt = minWtLbs ? lbsToCwtDecimal(minWtLbs) : '';
        maxWeightCwt = maxWtLbs ? lbsToCwtDecimal(maxWtLbs) : '';
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
            <TowerMap 
                towers={data.towers}
                bind:bellsFilter
                bind:isMinimumBells
                bind:showUnringable
                bind:practiceNightFilter
                bind:displayLimit
                bind:includeGrabbed
                bind:excludeGrabbed
                bind:includeQuartered
                bind:excludeQuartered
                bind:includePealed
                bind:excludePealed
                bind:currentlyDisplayed
                bind:filteredTowerCount
                bind:counties
                bind:countries
                bind:dioceses
                bind:selectedCounty
                bind:selectedCountry
                bind:selectedDiocese
                bind:minWeightCwt
                bind:maxWeightCwt
                showLocationTracking={true}
                showClosestTower={true}
                showTowerCount={true}
                autoFitBounds={false}
                mapHeight="100%"
            />
            
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
            
            <aside class="sidebar {sidebarOpen ? 'open' : ''} box p-0" style="max-width: 350px;">
                <div class="sidebar-header py-3 px-4 is-flex is-align-items-center is-justify-content-space-between">
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
                    
                    <!-- Practice Night moved into Advanced Filters panel -->
                    
                    <div class="field mb-5">
                        <label class="label">Special Filters</label>
                        <div class="control">
                            <div class="table-container">
                                <table class="table is-fullwidth is-narrow">
                                    <thead>
                                        <tr>
                                            <th>Filter</th>
                                            <th class="has-text-centered" style="width:1px;">Include</th>
                                            <th class="has-text-centered" style="width:1px;">Exclude</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Grabbed</td>
                                            <td class="has-text-centered">
                                                <label class="checkbox" title="Include towers you've marked as grabbed">
                                                    <input type="checkbox"
                                                           bind:checked={includeGrabbed}
                                                           on:change={() => { if (includeGrabbed) excludeGrabbed = false; }} />
                                                </label>
                                            </td>
                                            <td class="has-text-centered">
                                                <label class="checkbox" title="Exclude towers you've marked as grabbed">
                                                    <input type="checkbox"
                                                           bind:checked={excludeGrabbed}
                                                           on:change={() => { if (excludeGrabbed) includeGrabbed = false; }} />
                                                </label>
                                            </td>
                                        </tr>

                                        <tr>
                                            <td>Quarter Pealed</td>
                                            <td class="has-text-centered">
                                                <label class="checkbox" title="Include towers that have been quarter pealed">
                                                    <input type="checkbox"
                                                           bind:checked={includeQuartered}
                                                           on:change={() => { if (includeQuartered) excludeQuartered = false; }} />
                                                </label>
                                            </td>
                                            <td class="has-text-centered">
                                                <label class="checkbox" title="Exclude towers that have been quarter pealed">
                                                    <input type="checkbox"
                                                           bind:checked={excludeQuartered}
                                                           on:change={() => { if (excludeQuartered) includeQuartered = false; }} />
                                                </label>
                                            </td>
                                        </tr>

                                        <tr>
                                            <td>Pealed</td>
                                            <td class="has-text-centered">
                                                <label class="checkbox" title="Include towers that have been pealed">
                                                    <input type="checkbox"
                                                           bind:checked={includePealed}
                                                           on:change={() => { if (includePealed) excludePealed = false; }} />
                                                </label>
                                            </td>
                                            <td class="has-text-centered">
                                                <label class="checkbox" title="Exclude towers that have been pealed">
                                                    <input type="checkbox"
                                                           bind:checked={excludePealed}
                                                           on:change={() => { if (excludePealed) includePealed = false; }} />
                                                </label>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <div class="field mb-5">
                        <span class="label">Advanced Filters</span>
                        <div class="mt-2">
                            <button class="button is-small" on:click={toggleAdvancedOpen} aria-expanded={advancedOpen} aria-controls="advanced-panel">{advancedOpen ? 'Hide' : 'Show'} Advanced filters</button>
                        </div>

                        {#if advancedOpen}
                            <div id="advanced-panel" class="box mt-3">
                                <div class="field">
                                    <label class="label">County</label>
                                    <div class="control">
                                        <div class="select is-fullwidth">
                                            <select bind:value={selectedCounty}>
                                                <option value="">(Any)</option>
                                                {#each counties as c}
                                                    <option value={c}>{c}</option>
                                                {/each}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label" for="practiceNightFilter">Practice Night</label>
                                    <div class="control">
                                        <div class="select is-fullwidth">
                                            <select id="practiceNightFilter" bind:value={practiceNightFilter}>
                                                <option value="">(Any)</option>
                                                {#each practiceNights as night}
                                                    <option value={night}>{night}</option>
                                                {/each}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label">Country</label>
                                    <div class="control">
                                        <div class="select is-fullwidth">
                                            <select bind:value={selectedCountry}>
                                                <option value="">(Any)</option>
                                                {#each countries as c}
                                                    <option value={c}>{c}</option>
                                                {/each}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label">Diocese</label>
                                    <div class="control">
                                        <div class="select is-fullwidth">
                                            <select bind:value={selectedDiocese}>
                                                <option value="">(Any)</option>
                                                {#each dioceses as d}
                                                    <option value={d}>{d}</option>
                                                {/each}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label">Weight (cwt)</label>
                                    <div class="control is-flex">
                                        <input class="input" type="number" step="0.25" min="0" placeholder="Min cwt" bind:value={minWeightCwt} />
                                        <div style="width:8px"></div>
                                        <input class="input" type="number" step="0.25" min="0" placeholder="Max cwt" bind:value={maxWeightCwt} />
                                    </div>
                                </div>

                                <div class="field is-grouped is-grouped-right">
                                    <p class="control">
                                        <button class="button is-small" on:click={clearAdvanced}>Clear</button>
                                    </p>
                                    <p class="control">
                                        <button class="button is-primary is-small" on:click={() => { advancedOpen = false; }}>Close</button>
                                    </p>
                                </div>
                            </div>
                        {/if}
                    </div>
                        
                    <div class="field mb-5">
                        <span class="label">Legend</span>
                        <div class="is-flex is-align-items-center">
                            <div class="legend-item mr-3" style="display:flex;align-items:center;">
                                <div class="legend-icon mr-2" style="width:28px;height:40px;">{@html legendGrabbedSVG}</div>
                                <div class="is-size-7">Grabbed</div>
                            </div>
                            <div class="legend-item mr-3" style="display:flex;align-items:center;">
                                <div class="legend-icon mr-2" style="width:28px;height:40px;">{@html legendQuarterSVG}</div>
                                <div class="is-size-7">Quarter Pealed</div>
                            </div>
                            <div class="legend-item" style="display:flex;align-items:center;">
                                <div class="legend-icon mr-2" style="width:28px;height:40px;">{@html legendPealSVG}</div>
                                <div class="is-size-7">Pealed</div>
                            </div>
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