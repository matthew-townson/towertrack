<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;

    // Convert lbs to hundredweight format
    function lbsToHundredweight(lbs) {
        if (!lbs) return '';
        const cwt = Math.floor(lbs / 112);
        const remaining = lbs % 112;
        const qtr = Math.floor(remaining / 28);
        const finalLbs = remaining % 28;
        return `${cwt}-${qtr}-${finalLbs}`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString();
    }

    function formatTimestamp(timestampStr) {
        if (!timestampStr) return 'N/A';
        return new Date(timestampStr).toLocaleString();
    }
</script>

<svelte:head>
    <title>{data.performance.Changes} {data.performance.Method} | towertracker</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<Header user={data.user} />

<main>
    <div class="breadcrumb-nav">
        <a href="/bellboard/summary">← Back to Summary</a>
    </div>
    
    <h1>Performance Details</h1>
    
    <div class="performance-detail-container">
        <div class="performance-content">
            {#if data.performance.Association}
                <p class="association">{data.performance.Association}</p>
            {/if}
            
            <p class="location">
                {#if data.performance.TowerID}
                    <a href="https://dove.cccbr.org.uk/tower/{data.performance.TowerID}" target="_blank" rel="noopener noreferrer" class="location-link">
                        {data.performance.Place || ''}{#if data.performance.County}, {data.performance.County}{/if}
                    </a>
                {:else}
                    {data.performance.Place || ''}{#if data.performance.County}, {data.performance.County}{/if}
                {/if}
            </p>
            
            {#if data.performance.Dedication}
                <p class="dedication">
                    {#if data.performance.TowerID}
                        <a href="https://dove.cccbr.org.uk/tower/{data.performance.TowerID}" target="_blank" rel="noopener noreferrer" class="dedication-link">
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
                                <span class="bell-number">{index + 1}</span>
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
                <div class="external-link">
                    <a href="https://bb.ringingworld.co.uk/view.php?id=P{data.performance.PerformanceID}" 
                       target="_blank" rel="noopener noreferrer">
                        View on BellBoard
                    </a>
                </div>

                {#if data.performance.TowerID}
                    <div class="external-link">
                        <a href="https://dove.cccbr.org.uk/tower/{data.performance.TowerID}" target="_blank" rel="noopener noreferrer">
                            View on Dove ({data.performance.Place ? `${data.performance.Place}, ` : ''}{data.performance.Dedication ? `${data.performance.Dedication}` : ''})
                        </a>
                    </div>
                {/if}
            </div>

        </div>
    </div>
</main>

<Footer />

<style>
    .breadcrumb-nav {
        margin-bottom: 1rem;
    }

    .breadcrumb-nav a {
        color: #8ee3ef;
        text-decoration: none;
        font-size: 0.9rem;
    }

    .breadcrumb-nav a:hover {
        text-decoration: underline;
    }

    .performance-detail-container {
        background: #23262b;
        border-radius: 8px;
        padding: 2rem;
        margin-bottom: 2rem;
        max-width: 800px;
        margin-left: auto;
        margin-right: auto;
    }

    .performance-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        color: #f3f4f6;
        text-align: left;
    }

    .association {
        font-size: 1rem;
        color: #8ee3ef;
        margin: 0;
        font-weight: 600;
    }

    .location {
        font-size: 1.2rem;
        font-weight: 600;
        color: #f3f4f6;
        margin: 0;
    }

    .location-link {
        color: #f3f4f6;
        text-decoration: none;
        font-weight: 600;
    }

    .location-link:hover {
        color: #8ee3ef;
        text-decoration: underline;
    }

    .dedication {
        font-size: 1rem;
        color: #d1d5db;
        margin: 0;
        font-weight: normal;
    }

    .dedication-link {
        color: #d1d5db;
        text-decoration: none;
        font-weight: normal;
    }

    .dedication-link:hover {
        color: #8ee3ef;
        text-decoration: underline;
    }

    .date-details {
        font-size: 1rem;
        color: #a1a1aa;
        margin: 0;
        font-weight: normal;
    }

    .method-changes {
        font-size: 1.3rem;
        color: #f3f4f6;
        margin: 0.25rem 0;
        font-weight: 600;
    }

    .ringers-section {
        margin: 0.25rem 0;
        text-align: left;
    }

    .ringers-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        text-align: left;
    }

    .ringer-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        text-align: left;
    }

    .bell-number {
        color: #8ee3ef;
        font-weight: 600;
        min-width: 2rem;
    }

    .ringer-name {
        color: #f3f4f6;
        font-weight: normal;
    }

    .footnotes-section {
        margin: 0.25rem 0;
    }

    .footnotes-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .footnote-item {
        color: #d1d5db;
        font-style: italic;
        font-size: 0.95rem;
        line-height: 1.4;
        font-weight: normal;
    }

    .external-links {
        margin: 1rem 0 0.5rem 0;
    }
    
    .external-heading {
        color: #8ee3ef;
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
    }

    .external-link {
        margin-top: 0.5rem;
    }
    
    .external-link a {
        color: #8ee3ef;
        text-decoration: none;
        font-size: 0.9rem;
    }
    
    .external-link a:hover {    
        text-decoration: underline;
    }
    
    @media (max-width: 768px) {
        .performance-detail-container {
            padding: 1rem;
            margin: 0 1rem 2rem 1rem;
        }
    }
</style>