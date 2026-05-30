<script>
    import { onMount } from 'svelte';

    let page = 1;
    const pageSize = 100;
    let selectedType = 'All';
    let sortByType = false;
    let sortAsc = true;
    let search = '';

    let logs = [];
    let totalLogs = 0;
    let loading = false;
    let loadError = '';

    $: startIndex = totalLogs === 0 ? 0 : (page - 1) * pageSize;
    $: endIndex = Math.min(page * pageSize, totalLogs);
    $: totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
    $: grouped = logs.reduce((acc, log) => {
        const dateKey = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'Unknown';
        (acc[dateKey] = acc[dateKey] || []).push(log);
        return acc;
    }, {});

    function scrollToTop() {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    async function loadLogsPage() {
        loading = true;
        loadError = '';

        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
                type: selectedType,
                sortByType: String(sortByType),
                sortAsc: String(sortAsc),
                search: search
            });

            const response = await fetch(`/api/admin/logs?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to load logs');
            }

            const payload = await response.json();
            logs = payload.logs ?? [];
            totalLogs = payload.total ?? 0;
            page = payload.page ?? page;
        } catch (error) {
            loadError = error.message || 'Failed to load logs';
            logs = [];
            totalLogs = 0;
        } finally {
            loading = false;
        }
    }

    function prev() {
        if (page > 1) {
            page -= 1;
            scrollToTop();
            loadLogsPage();
        }
    }

    function next() {
        if (page < totalPages) {
            page += 1;
            scrollToTop();
            loadLogsPage();
        }
    }

    function goTo(n) {
        const v = Number(n);
        if (!isNaN(v)) {
            page = Math.max(1, Math.min(totalPages, v));
            scrollToTop();
            loadLogsPage();
        }
    }

    function onTypeChange() {
        page = 1;
        scrollToTop();
        loadLogsPage();
    }

    function onSearchChange() {
        page = 1;
        scrollToTop();
        loadLogsPage();
    }

    function toggleSortByType() {
        sortByType = !sortByType;
        page = 1;
        scrollToTop();
        loadLogsPage();
    }

    function toggleSortDirection() {
        sortAsc = !sortAsc;
        page = 1;
        scrollToTop();
        loadLogsPage();
    }

    onMount(() => {
        loadLogsPage();
    });
</script>

<svelte:head>
    <title>Application Logs | towertracker</title>
    <link rel="stylesheet" href="/assets/css/admin.css">
</svelte:head>

<div class="logs-page">
    <h1>Application Logs</h1>

    {#if loadError}
        <div class="logs-error">{loadError}</div>
    {:else}
        <div class="logs-controls columns is-vcentered is-multiline">
            <div class="column is-narrow logs-info">
                Showing {totalLogs === 0 ? 0 : startIndex + 1}–{endIndex} of {totalLogs} logs
            </div>
            <div class="column">
                <div class="field is-grouped is-grouped-right is-align-items-center" role="toolbar" aria-label="Log controls">
                    <div class="control is-expanded">
                        <input 
                            class="input is-small" 
                            type="text" 
                            placeholder="Search logs..."
                            bind:value={search}
                            on:change={onSearchChange}
                        />
                    </div>

                    <div class="control">
                        <button class="button is-small" on:click={prev} disabled={page === 1}>Prev</button>
                    </div>

                    <div class="control">
                        <div class="select is-small">
                            <select bind:value={selectedType} on:change={onTypeChange}>
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
                        <button class="button is-small" on:click={toggleSortByType} aria-pressed={sortByType}>
                            {#if sortByType}Sort: {sortAsc ? 'Type ▲' : 'Type ▼'}{:else}Sort: Off{/if}
                        </button>
                    </div>
                    {#if sortByType}
                        <div class="control">
                            <button class="button is-small" on:click={toggleSortDirection}>
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
            {#if loading}
                <div class="empty">Loading logs...</div>
            {:else if logs.length === 0}
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
            <div class="logs-info">Showing {totalLogs === 0 ? 0 : startIndex + 1}–{endIndex} of {totalLogs}</div>
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