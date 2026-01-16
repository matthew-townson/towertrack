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

    // show notification when form result arrives
    $: if (form?.success || form?.error) showNotification = true;

    // Client-side classification function to match server logic
    function classifyChanges(changes, bell_count) {
        if (changes >= 5000) return 'peal';
        if (changes >= 2500 && changes < 5000) return 'half-peal';
        if (changes >= 1250 && changes < 2500) return 'quarter';
        return 'performance';
    }

    // Convert lbs to hundredweight format
    function lbsToHundredweight(lbs) {
        return convertToHundredweight(lbs);
    }

    // Helpers to display bell numbers when provided in the ringer object.
    // Show the bell number only for the first person listed for that bell.
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
    <title>BellBoard Summary | towertracker</title>
    <link rel="stylesheet" href="/assets/css/bellboard-summary.css">
</svelte:head>

<Header user={data.user} />

<main>
    <h1>BellBoard Summary for {data.user.username}</h1>

    <!-- Stats summary -->
    {#if data?.stats}
        <section class="box">
            <p><strong>Peals:</strong> {data.stats.peal_count}</p>
            <p><strong>Half peals:</strong> {data.stats.half_peal_count}</p>
            <p><strong>Quarter peals:</strong> {data.stats.quarter_count}</p>
            <p><strong>Total Performances:</strong> {data.stats.performance_count}</p>
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
        </section>
    {/if}

    <!-- Print performances -->
    <h2>Your Performances</h2>
    {#if data?.performances?.length > 0}
        <div class="performances-container">
            {#each data.performances as perf}
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
        <p>No performances found.</p>
    {/if}
</main>

<Footer />
