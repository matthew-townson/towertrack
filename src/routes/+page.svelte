<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { convertToHundredweight } from '$lib/mapUtils.js';
    export let data;

    function formatDate(date) {
        return date ? new Date(date).toLocaleDateString('en-GB') : 'N/A';
    }

    function getBellLabel(ringers, ringer, index) {
        return ringer?.bell || (ringers.length ? index + 1 : '');
    }
</script>

<svelte:head>
    <title>towertracker</title>
    <link rel="stylesheet" href="/assets/css/home.css">
    <link rel="stylesheet" href="/assets/css/bellboard-summary.css">
</svelte:head>

<Header user={data.user} />

<main class="landing-page">
    <div class="landing-page__container">
        <div class="landing-page__content">
            <section class="landing-page__box">
                <h1>Welcome to towertracker</h1>
                <h2>The site for tracking tower grabs and performance data.</h2>
                <p>Tracking <strong>{data.grabCount}</strong> tower grabs, and <strong>{data.performanceCount}</strong> performances of {data.userCount ? `${data.userCount} users` : 'no users'}</p>
                <p>Users have accumulated a total of <strong>{data.totalChanges}</strong> changes, rung across <strong>{data.pealCount}</strong> peals, and <strong>{data.quarterPealCount}</strong> quarter peals</p>
                <p>Total time spent ringing: <i>at least</i> <strong>{data.totalTimeSpent}</strong></p>
            </section>

            <section class="landing-page__box">
                <h2>See your tower grabs and peal locations</h2>
                <img class="landing-page__image" src="/assets/image/homepage/map.png" alt="Map of tower grabs" />
            </section>

            <section class="landing-page__box">
                <h2>Grab towers</h2>
                <img class="landing-page__image" src="/assets/image/homepage/tower.png" alt="Grab a tower" />
            </section>

            <section class="landing-page__box">
                <h2>Get started here</h2>
                <a href="/account/register" class="button is-danger">Register</a>
            </section>
        </div>

        <aside class="recent-performances-panel landing-recent-performances">
            <div class="recent-performances-header">
                <h2>Recent performances by towertracker users</h2>
            </div>
            <div class="recent-performances-list">
                {#each data.recentPerformances || [] as perf}
                    <div class="performance-card">
                        <div class="performance-content">
                            <div class="performance-main">
                                <p class="performance-title">{perf.Changes || 'N/A'} {perf.Method || ''}</p>
                                <p class="performance-date">{formatDate(perf.Date)}{perf.Duration ? ` in ${perf.Duration}` : ''}</p>
                                <div class="performance-details">
                                    <p>{perf.Association || ''}</p>
                                    <p>{perf.Place || ''}{perf.Dedication ? `, ${perf.Dedication}` : ''}{perf.County ? `, ${perf.County}` : ''}{perf.TenorWeightLbs ? ` (${convertToHundredweight(perf.TenorWeightLbs)}${perf.TenorKey ? ` in ${perf.TenorKey}` : ''})` : ''}</p>
                                    {#if perf.ringers.length}
                                        <div class="footnotes-list">
                                            {#each perf.ringers as ringer, index}
                                                <div class="footnote-item">
                                                    <strong class="bell-number">{getBellLabel(perf.ringers, ringer, index)}.</strong>
                                                    {#if ringer.profile}
                                                        <a href="/u/{ringer.profile.username.replace(/ /g, '-')}" class="ringer-profile-link">{ringer.name}</a>
                                                    {:else}
                                                        {ringer.name}
                                                    {/if}
                                                    {ringer.conductor ? ' (C)' : ''}
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                    {#each perf.footnotes as footnote}<div class="footnote-item">{footnote}</div>{/each}
                                </div>
                            </div>
                            <a class="performance-link" href="/bellboard/performance?id={perf.PerformanceID}">View Details</a>
                        </div>
                    </div>
                {/each}
            </div>
        </aside>
    </div>
</main>

<Footer />
