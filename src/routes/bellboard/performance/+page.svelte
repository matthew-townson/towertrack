<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { convertToHundredweight } from '$lib/mapUtils.js';
    export let data;

    // Convert lbs to hundredweight format
    function lbsToHundredweight(lbs) {
        return convertToHundredweight(lbs);
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString();
    }

    function formatTimestamp(timestampStr) {
        if (!timestampStr) return 'N/A';
        return new Date(timestampStr).toLocaleString();
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
    <title>{data.performance.Changes} {data.performance.Method} | towertracker</title>
    <meta name="robots" content="noindex" />
    <link rel="stylesheet" href="/assets/css/performance.css" />
</svelte:head>

<Header user={data.user} />

<main>
    <div class="breadcrumb-nav">
        <a href="/u/{data.user?.username?.replace(/ /g, '-')}/performance-data">← Back to Summary</a>
    </div>
    
    <h1>Performance Details</h1>
    
    <div class="performance-detail-container">
        <div class="performance-content">
            {#if data.performance.Association}
                <p class="association">{data.performance.Association}</p>
            {/if}
            
            <p class="location">
                {#if data.performance.TowerID}
                    <a href="/tower/{data.performance.TowerID}">
                        {data.performance.Place || ''}{#if data.performance.County}, {data.performance.County}{/if}
                    </a>
                {:else}
                    {data.performance.Place || ''}{#if data.performance.County}, {data.performance.County}{/if}
                {/if}
            </p>
            
            {#if data.performance.Dedication}
                <p class="dedication">
                    {#if data.performance.TowerID}
                        <a href="/tower/{data.performance.TowerID}">
                            {data.performance.Dedication}
                        </a>
                    {:else}
                        {data.performance.Dedication}
                    {/if}
                </p>
            {/if}
            
            <p class="date-details">
                {formatDate(data.performance.Date)}
                {data.performance.Duration ? `in ${data.performance.Duration}` : ''}
                {data.performance.TenorWeightLbs ? `(${lbsToHundredweight(data.performance.TenorWeightLbs)}` : ''}
                {data.performance.TenorKey ? ` in ${data.performance.TenorKey})` : ''}
            </p>
            
            <p class="method-changes">
                <strong>{data.performance.Changes || 'N/A'} {data.performance.Method || 'Unknown Method'}</strong>
            </p>

            {#if data.performance.ringers && data.performance.ringers.length > 0}
                <div class="ringers-section">
                    <div class="ringers-list">
                        {#each data.performance.ringers as ringer, index}
                            <div class="ringer-item">
                                {#if getBellLabel(data.performance.ringers, ringer, index)}
                                    <span class="bell-number">{getBellLabel(data.performance.ringers, ringer, index)}</span>
                                {/if}
                                <span class="ringer-name">
                                    {ringer.name}
                                    {#if ringer.conductor}
                                        (C)
                                    {/if}
                                </span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if data.performance.footnotes && data.performance.footnotes.length > 0}
                <div class="footnotes-section">
                    <div class="footnotes-list">
                        {#each data.performance.footnotes as footnote}
                            <div class="footnote-item">{footnote}</div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="external-links">
                <h4 class="external-heading">External Sites</h4>
                
                {#if data.performance.TowerID}
                <div class="external-link">
                    <a href="/tower/{data.performance.TowerID}" target="_blank" rel="noopener noreferrer">
                        View tower details on TowerTracker
                    </a>
                </div>
                {/if}

                <div class="external-link">
                    <a href="https://bb.ringingworld.co.uk/view.php?id=P{data.performance.PerformanceID}" 
                    target="_blank" rel="noopener noreferrer">
                    View performance on BellBoard
                    </a>
                </div>
                
                {#if data.performance.PerformanceID}
                <div class="external-link">
                    <a href="https://dove.cccbr.org.uk/tower/{data.performance.TowerID}" target="_blank" rel="noopener noreferrer">
                        View tower details on Dove ({data.performance.Place ? `${data.performance.Place}, ` : ''}{data.performance.Dedication ? `${data.performance.Dedication}` : ''})
                    </a>
                </div>
                {/if}
            </div>

        </div>
    </div>
</main>

<Footer />