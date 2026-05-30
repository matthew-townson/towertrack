<script>
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { onDestroy, onMount } from 'svelte';
    
    export let data;
    
    let loading = false;
    let progress = null;
    let pollInterval = null;
    let importResult = null;
    
    function formatDate(date) {
        if (!date) return 'Never';
        return new Date(date).toLocaleString();
    }
    
    function getTimeSinceImport(date) {
        if (!date) return 'Never imported';
        const now = new Date();
        const lastImport = new Date(date);
        const hours = Math.floor((now - lastImport) / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days === 1 ? '' : 's'} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        } else {
            const minutes = Math.floor((now - lastImport) / (1000 * 60));
            return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        }
    }
    
    async function pollProgress() {
        try {
            const res = await fetch('/api/bb-import-progress');
            if (res.ok) {
                progress = await res.json();
                
                // Stop polling when import is complete or errored
                if (progress.status === 'complete' || progress.status === 'error') {
                    stopPolling();
                    loading = false;
                    if (progress.status === 'complete') {
                        importResult = { success: true, message: progress.message };
                    } else {
                        importResult = { success: false, message: progress.message };
                    }
                    await invalidateAll();
                }
            }
        } catch (e) {
            console.error('Failed to poll progress:', e);
        }
    }
    
    function startPolling() {
        pollProgress(); // Immediate first poll
        pollInterval = setInterval(pollProgress, 1000);
    }
    
    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }
    
    onDestroy(() => {
        stopPolling();
    });

    onMount(async () => {
        await pollProgress();
        if (progress && progress.status === 'running') {
            loading = true;
            startPolling();
        }
    });
</script>

<svelte:head>
    <title>Import BellBoard Data | towertracker</title>
    <link rel="stylesheet" href="/assets/css/bellboard-import.css">
</svelte:head>

<main class="bb-import-page">
    <h1>Import BellBoard Data</h1>
    <p>Import performance data from BellBoard for all users</p>
    
    <div class="import-status">
        <h2>Import Status</h2>
        
        <!-- Last Import Status -->
        {#if data.lastImportStatus && data.lastImportStatus.status !== 'unknown'}
            <div class="last-status {data.lastImportStatus.status}">
                <p class="status-header">
                    <strong>Last Import:</strong>
                    <span class="status-badge {data.lastImportStatus.status}">
                        {#if data.lastImportStatus.status === 'success'}
                            ✓ Success
                        {:else if data.lastImportStatus.status === 'error'}
                            ✗ Failed
                        {:else}
                            ? Unknown
                        {/if}
                    </span>
                </p>
                {#if data.lastImportStatus.lastAttemptTime}
                    <p class="status-time">{formatDate(data.lastImportStatus.lastAttemptTime)} ({getTimeSinceImport(data.lastImportStatus.lastAttemptTime)})</p>
                {/if}
                {#if data.lastImportStatus.status === 'success' && data.lastImportStatus.lastMessage}
                    <p class="status-message success-message">{data.lastImportStatus.lastMessage}</p>
                {/if}
                {#if data.lastImportStatus.status === 'error' && data.lastImportStatus.lastError}
                    <div class="error-box">
                        <p class="error-message">{data.lastImportStatus.lastError.message}</p>
                    </div>
                {/if}
            </div>
        {:else}
            <p><strong>Last Import:</strong> Never</p>
        {/if}
    </div>
    
    {#if importResult}
        <div class="result-box {importResult.success ? 'success' : 'error'}">
            <p>{importResult.message}</p>
            <button on:click={() => { importResult = null; progress = null; }}>Dismiss</button>
        </div>
    {/if}
    
    {#if loading && progress && progress.status === 'running'}
        <div class="progress-container">
            <h3>Import Progress</h3>
            <p class="progress-message">{progress.message}</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {progress.totalUsers > 0 ? Math.round((progress.completedUsers / progress.totalUsers) * 100) : 0}%"></div>
            </div>
            <p class="progress-stats">
                <span>Users: {progress.completedUsers}/{progress.totalUsers}</span>
                <span>✓ {progress.successCount}</span>
                <span>✗ {progress.failCount}</span>
            </p>
            
            <div class="user-progress-list">
                {#each progress.users as user, i}
                    <div class="user-progress-item {user.status}">
                        <span class="user-status-icon">
                            {#if user.status === 'pending'}
                                ○
                            {:else if user.status === 'importing'}
                                ◐
                            {:else if user.status === 'success'}
                                ✓
                            {:else if user.status === 'error'}
                                ✗
                            {/if}
                        </span>
                        <span class="user-name">{user.username}</span>
                        {#if user.status === 'error' && user.error}
                            <span class="user-error" title={user.error}>Error</span>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    {/if}
    
    <div class="controls">
        <form method="POST" action="?/import" use:enhance={() => {
            loading = true;
            importResult = null;
            progress = null;
            startPolling();
            return async ({ result }) => {
                // Don't stop loading here - let polling handle it
            };
        }}>
            <button type="submit" disabled={loading}>
                {loading ? 'Importing...' : 'Import BellBoard Data Now'}
            </button>
        </form>
    </div>
</main>
