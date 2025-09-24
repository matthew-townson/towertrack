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

<div class="logs-page" style="font-family: 'Inter', Arial, sans-serif;">
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

<style>
/* filepath: /home/matthew/projects/matthew-townson/towertrack/src/routes/admin/logs/+page.svelte */
/* Dark theme container */
.logs-page {
    color: #f3f4f6;
    background: transparent;
    padding: 0.5rem 0;
}

/* Controls */
.logs-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
}
.logs-info {
    color: #cbd5e1;
    font-size: 0.95rem;
}
.pagination {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.pagination.small { margin-top: 0.5rem; justify-content: flex-end; }

/* removed unused .page-btn rules (Bulma buttons used instead) */

/* new: filter select */
.page-filter {
    padding: 0.25rem 0.4rem;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    color: #f3f4f6;
    font-size: 0.9rem;
    margin-right: 0.5rem;
}

/* Scrollable logs area */
.logs-container {
    max-height: calc(100vh - 240px); /* adjust to fit other UI chrome */
    overflow-y: auto;
    padding: 0.5rem;
    background: #23262b;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.03);
    box-shadow: none;
}

/* Section header */
.log-section {
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px dashed rgba(255,255,255,0.02);
}
.section-header {
    margin: 0 0 0.5rem 0;
    color: #8ee3ef;
    font-size: 0.95rem;
    font-weight: 600;
}

/* Table */
.logs-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: transparent;
    color: #f3f4f6;
}
.logs-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: rgba(255,255,255,0.02);
    padding: 8px 10px;
    text-align: left;
    color: #cbd5e1;
    font-weight: 600;
    border-bottom: 1px solid rgba(255,255,255,0.03);
}
.logs-table td {
    padding: 10px;
    vertical-align: top;
    border-bottom: 1px solid rgba(255,255,255,0.02);
    font-size: 0.95rem;
    color: #e6eef8;
}
.logs-table tr:nth-child(even) td {
    background: rgba(255,255,255,0.007);
}

/* small monospace id */
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; color: #c33c54; }

/* log type colours (keep consistent with global CSS if present) */
.log-type-INFO { color: #8ee3ef; font-weight: 600; }
.log-type-ERROR { color: #fca5a5; font-weight: 700; }
.log-type-SUCCESS { color: #bbf7d0; font-weight: 700; }
.log-type-DEBUG { color: #caa2ff; font-weight: 600; }
.log-type-WARN { color: #fbbf24; font-weight: 700; }

/* Ensure consistent type colours (supporting case variations) */
.log-type-INFO,
.log-type-Info,
.log-type-info {
  color: #06b6d4 !important; /* cyan */
  font-weight: 700;
}

.log-type-ERROR,
.log-type-Error,
.log-type-error {
  color: #ef4444 !important; /* red */
  font-weight: 700;
}

.log-type-SUCCESS,
.log-type-Success,
.log-type-success {
  color: #16a34a !important; /* green */
  font-weight: 700;
}

.log-type-WARN,
.log-type-Warn,
.log-type-warn {
  color: #f59e0b !important; /* yellow */
  font-weight: 700;
}

/* error panel */
.logs-error {
    background: rgba(239,68,68,0.09);
    border: 1px solid rgba(239,68,68,0.22);
    padding: 0.75rem;
    border-radius: 6px;
    color: #fecaca;
}

/* footer area */
.logs-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    gap: 1rem;
    color: #cbd5e1;
    font-size: 0.95rem;
}

/* responsive */
@media (max-width: 640px) {
    .logs-controls { flex-direction: column; align-items: stretch; }
    .pagination { justify-content: center; flex-wrap: wrap; gap: 0.5rem; }
    .logs-container { max-height: calc(100vh - 320px); }
}
</style>