<script>
    export let data;

    // pagination
    let page = 1;
    const pageSize = 100;

    // new: filter + sort by type
    let selectedType = 'All'; // All, Info, Error, Success, Warn, Debug
    let sortByType = false;
    let sortAsc = true;

    $: allLogs = data?.logs ?? [];

    // filtered by selectedType
    $: filteredLogs = selectedType === 'All'
        ? allLogs
        : allLogs.filter(l => (l.type || '').toLowerCase() === selectedType.toLowerCase());

    // sorted if requested (stable-ish)
    $: sortedLogs = sortByType
        ? filteredLogs.slice().sort((a, b) => {
            const ta = (a.type || '').toLowerCase();
            const tb = (b.type || '').toLowerCase();
            if (ta === tb) return 0;
            return sortAsc ? (ta < tb ? -1 : 1) : (ta < tb ? 1 : -1);
        })
        : filteredLogs;

    // pagination derived from sortedLogs
    $: totalPages = Math.max(1, Math.ceil(sortedLogs.length / pageSize));
    $: startIndex = (page - 1) * pageSize;
    $: endIndex = Math.min(page * pageSize, sortedLogs.length);
    $: pagedLogs = sortedLogs.slice(startIndex, endIndex);

    // group current page by date string
    $: grouped = pagedLogs.reduce((acc, l) => {
        const d = l.timestamp ? new Date(l.timestamp).toLocaleDateString() : 'Unknown';
        (acc[d] = acc[d] || []).push(l);
        return acc;
    }, {});

    function prev() {
        if (page > 1) page -= 1;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function next() {
        if (page < totalPages) page += 1;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function goTo(n) {
        const v = Number(n);
        if (!isNaN(v)) {
            page = Math.max(1, Math.min(totalPages, v));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
</script>

<svelte:head>
    <title>Application Logs | towertracker</title>
    <link rel="stylesheet" href="/assets/css/admin.css">
</svelte:head>

<div class="logs-page">
    <h1>Application Logs</h1>

    {#if data.error}
        <div class="logs-error">{data.error}</div>
    {:else}
        <div class="logs-controls columns is-vcentered is-multiline">
            <div class="column is-narrow logs-info">
                Showing {startIndex + 1}–{endIndex} of {sortedLogs.length} logs
            </div>
            <div class="column">
                <div class="field is-grouped is-grouped-right is-align-items-center" role="toolbar" aria-label="Log controls">
                    <div class="control">
                        <button class="button is-small" on:click={prev} disabled={page === 1}>Prev</button>
                    </div>

                    <div class="control">
                        <div class="select is-small">
                            <select bind:value={selectedType} on:change={() => page = 1}>
                                <option>All</option>
                                <option>Info</option>
                                <option>Error</option>
                                <option>Success</option>
                                <option>Warn</option>
                                <option>Debug</option>
                            </select>
                        </div>
                    </div>

                    <div class="control">
                        <button class="button is-small" on:click={() => { sortByType = !sortByType; page = 1; }} aria-pressed={sortByType}>
                            {#if sortByType}Sort: {sortAsc ? 'Type ▲' : 'Type ▼'}{:else}Sort: Off{/if}
                        </button>
                    </div>
                    {#if sortByType}
                        <div class="control">
                            <button class="button is-small" on:click={() => { sortAsc = !sortAsc; page = 1; }}>
                                Toggle ↑/↓
                            </button>
                        </div>
                    {/if}

                    <div class="control">
                        <span class="is-size-7" style="color:var(--muted,#cbd5e1); margin-right:0.5rem;">Page</span>
                    </div>
                    <div class="control">
                        <input class="input is-small" type="number" min="1" max={totalPages} bind:value={page} on:change={(e) => goTo(e.target.value)} style="width:4.5ch;" />
                    </div>
                    <div class="control">
                        <span class="is-size-7" style="color:var(--muted,#cbd5e1);">/ {totalPages}</span>
                    </div>

                    <div class="control">
                        <button class="button is-small" on:click={next} disabled={page === totalPages}>Next</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="logs-container" role="region" aria-label="Logs list">
            {#if pagedLogs.length === 0}
                <div class="empty">No logs to display for this page.</div>
            {:else}
                {#each Object.entries(grouped) as [date, items]}
                    <section class="log-section">
                        <h3 class="section-header">{date} — {items.length} {items.length === 1 ? 'entry' : 'entries'}</h3>
                        <table class="logs-table table is-fullwidth is-hoverable is-striped">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Type</th>
                                    <th>Timestamp</th>
                                    <th>Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each items as log}
                                    <tr>
                                        <td class="mono">{log.id}</td>
                                        <td class={"log-type-" + log.type}>{log.type}</td>
                                        <td>{log.timestamp}</td>
                                        <td style="white-space: pre-wrap">{log.text}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </section>
                {/each}
            {/if}
        </div>

        <div class="logs-footer">
            <div class="logs-info">Showing {startIndex + 1}–{endIndex} of {sortedLogs.length}</div>
            <nav class="pagination is-small" aria-label="pagination">
                <button class="pagination-previous button is-small" on:click={prev} disabled={page === 1}>Prev</button>
                <button class="pagination-next button is-small" on:click={next} disabled={page === totalPages}>Next</button>
                <ul class="pagination-list" style="margin-left:0.75rem;">
                    <li>
                        <span
                            class="pagination-link is-current"
                            role="status"
                            aria-current="page"
                        >Page {page} / {totalPages}</span>
                    </li>
                </ul>
            </nav>
        </div>
    {/if}
</div>