<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { convertToHundredweight } from '$lib/mapUtils.js';
    export let data;
    
    function lbsToHundredweight(lbs) {
        return convertToHundredweight(lbs);
    }
    
    function formatDate(dateStr) {
        if (!dateStr) return 'Unknown date';
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    }
    
    function constructGrabDate(dateGrabbed, monthGrabbed, yearGrabbed) {
        if (!yearGrabbed) return null;
        
        const year = yearGrabbed;
        const month = monthGrabbed ? monthGrabbed - 1 : 0;
        const day = dateGrabbed || 1;
        
        return new Date(year, month, day);
    }

    // Helpers to show bell numbers when present on ringer objects.
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
</script>

<svelte:head>
    <title>{data.tower.Place}{data.tower.Dedicn ? `, ${data.tower.Dedicn}` : ''} | towertracker</title>
    <meta name="description" content="Tower details for {data.tower.Place}" />
    <link rel="stylesheet" href="/assets/css/tower.css">
</svelte:head>

<Header user={data.user} />

<main>
    <div class="tower-header">
        <div class="tower-title">
            <h1>{data.tower.Place}{data.tower.Dedicn ? `, ${data.tower.Dedicn}` : ''}</h1>
            <p class="tower-location">{data.tower.County}{data.tower.Country && data.tower.Country !== data.tower.County ? `, ${data.tower.Country}` : ''}</p>
        </div>
        
        <div class="tower-actions">
            <a href="/grab/add?towerId={data.tower.TowerID}" class="button action-button edit-grab-button has-text-white">
                {data.userGrab ? 'Edit Grab' : 'Add Grab'}
            </a>
            <a href="https://dove.cccbr.org.uk/tower/{data.tower.TowerID}" class="button dove-button has-text-white" target="_blank" rel="noopener noreferrer">
                View on Dove
            </a>
            <a href="https://bb.ringingworld.co.uk/search?dove_tower={data.tower.TowerID}" class="button bb-button has-text-white" target="_blank" rel="noopener noreferrer">
                View on BellBoard
            </a>
            {#if data.tower.Lat && data.tower.Long}
                <a href="/map?lat={data.tower.Lat}&lng={data.tower.Long}&zoom=18" class="button map-btn has-text-dark">
                    View on Map
                </a>
            {/if}
        </div>
    </div>
    
    <div class="tower-content">
        <div class="tower-details">
            <div class="details-card">
                <h2>Tower Details</h2>
                <div class="detail-item">
                    <span class="detail-label">Bells:</span>
                    <span class="detail-value">{data.tower.Bells}</span>
                </div>
                {#if data.tower.Wt}
                    <div class="detail-item">
                        <span class="detail-label">Tenor Weight:</span>
                        <span class="detail-value">{lbsToHundredweight(data.tower.Wt)}</span>
                    </div>
                {/if}
                {#if data.tower.Note}
                    <div class="detail-item">
                        <span class="detail-label">Tenor Note:</span>
                        <span class="detail-value">{data.tower.Note}</span>
                    </div>
                {/if}
                {#if data.tower.UR === '1' || data.tower.UR === 1}
                    <div class="detail-item">
                        <span class="detail-label unringable">Status:</span>
                        <span class="detail-value unringable">Unringable</span>
                    </div>
                {/if}
                {#if data.tower.Practice}
                    <div class="detail-item">
                        <span class="detail-label">Practice:</span>
                        <span class="detail-value">{data.tower.Practice}</span>
                    </div>
                {/if}
                <div class="detail-item">
                    <span class="detail-label">Grabs:</span>
                    <span class="detail-value">{data.tower.grabCount || 0} users</span>
                </div>
                {#if data.tower.Postcode}
                    <div class="detail-item">
                        <span class="detail-label">Postcode:</span>
                        <span class="detail-value">{data.tower.Postcode}</span>
                    </div>
                {/if}
                {#if data.tower.WebPage}
                    <div class="detail-item">
                        <span class="detail-label">Website:</span>
                        <span class="detail-value">
                            <a href="{data.tower.WebPage}" target="_blank" rel="noopener noreferrer">
                                {data.tower.WebPage.length > 30 ? data.tower.WebPage.substring(0, 30) + '...' : data.tower.WebPage}
                            </a>
                        </span>
                    </div>
                {/if}
            </div>
            
            {#if data.bells && data.bells.length > 0}
                <div class="bells-card">
                    <h2>Bells</h2>
                    <div class="bells-list">
                        <table>
                            <thead>
                                <tr>
                                    <th>Bell</th>
                                    <th>Weight</th>
                                    <th>Note</th>
                                    <th>Cast Date</th>
                                    <th>Founder</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each data.bells as bell}
                                    <tr class={data.userGrab?.bells?.some(b => b.id === bell.BellID) ? 'bell-grabbed' : ''}>
                                        <td>
                                            {bell.BellRole || 'Unknown'}
                                            {#if bell.BellName}
                                                <span class="bell-name">"{bell.BellName}"</span>
                                            {/if}
                                        </td>
                                        <td>{bell.WeightLbs ? lbsToHundredweight(bell.WeightLbs) : 'Unknown'}</td>
                                        <td>{bell.Note || '-'}</td>
                                        <td>{bell.CastDate || '-'}</td>
                                        <td>
                                            {bell.Founder || '-'}
                                            {#if bell.FounderUncertain}
                                                <span class="uncertain">(uncertain)</span>
                                            {/if}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </div>
            {/if}
            
            {#if data.userGrab}
                <div class="grab-card">
                    <h2>Your Grab</h2>
                    <div class="user-grab-details">
                        <div class="detail-item">
                            <span class="detail-label">Grabbed on:</span>
                            <span class="detail-value">
                                {data.userGrab.dateGrabbed || data.userGrab.monthGrabbed || data.userGrab.yearGrabbed 
                                    ? formatDate(constructGrabDate(data.userGrab.dateGrabbed, data.userGrab.monthGrabbed, data.userGrab.yearGrabbed))
                                    : 'No date recorded'}
                            </span>
                        </div>
                        {#if data.userGrab.bells && data.userGrab.bells.length > 0}
                            <div class="detail-item">
                                <span class="detail-label">Bells rung:</span>
                                <span class="detail-value">
                                    {data.userGrab.bells.map(b => b.role).join(', ')}
                                </span>
                            </div>
                        {/if}
                        <div class="grab-actions">
                            <a href="/grab/add?towerId={data.tower.TowerID}" class="button edit-grab-button has-text-white">
                                Edit Grab
                            </a>
                        </div>
                    </div>
                </div>
            {/if}
            
            {#if data.performances && data.performances.length > 0}
                <div class="performances-card">
                    <h2>Recent Indexed Performances</h2>
                    <div class="performances-list">
                        {#each data.performances.slice(0, 3) as performance}
                            <div class="performance-item">
                                <div class="performance-header">
                                    <h3>{performance.Changes || ''} {performance.Method || ''}</h3>
                                    <span class="performance-date">{formatDate(performance.Date)}</span>
                                </div>
                                {#if performance.ringers && performance.ringers.length > 0}
                                    <div class="ringers-list">
                                        {#each performance.ringers as ringer, i}
                                            <div class="ringer">
                                                {#if getBellLabel(performance.ringers, ringer, i)}
                                                    <span class="ringer-position">{getBellLabel(performance.ringers, ringer, i)}.</span>
                                                {/if}
                                                <span class="ringer-name">{ringer.name}</span>
                                                {#if ringer.conductor}
                                                    <span class="conductor-badge">(C)</span>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                                <div class="performance-actions">
                                    <a href="/bellboard/performance?id={performance.PerformanceID}" class="view-link">View Details</a>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>
</main>

<Footer />
