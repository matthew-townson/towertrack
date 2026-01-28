<script>
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { onDestroy } from 'svelte';
    
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
    
    function getNextImportTime(lastImport) {
        if (!lastImport) return null;
        return new Date(new Date(lastImport).getTime() + 24 * 60 * 60 * 1000);
    }
    
    async function pollProgress() {
        try {
            const res = await fetch('/api/dove-import-progress');
            if (res.ok) {
                progress = await res.json();
                
                // Stop polling when import is complete or errored
                if (progress.status === 'complete' || progress.status === 'error') {
                    stopPolling();
                    loading = false;
                    if (progress.status === 'complete') {
                        importResult = { success: true, message: progress.message };
                    } else {
                        importResult = { success: false, message: progress.error };
                    }
                    // Refresh page data
                    await invalidateAll();
                }
            }
        } catch (e) {
            console.error('Failed to poll progress:', e);
        }
    }
    
    function startPolling() {
        pollProgress(); // Immediate first poll
        pollInterval = setInterval(pollProgress, 500);
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
    
    function getProgressPercent() {
        if (!progress) return 0;
        if (progress.stage === 'towers' && progress.towersTotal > 0) {
            return Math.round((progress.towersProcessed / progress.towersTotal) * 50);
        } else if (progress.stage === 'bells' && progress.bellsTotal > 0) {
            return 50 + Math.round((progress.bellsProcessed / progress.bellsTotal) * 45);
        } else if (progress.stage === 'optimizing') {
            return 95;
        } else if (progress.status === 'complete') {
            return 100;
        }
        return 0;
    }
</script>

<svelte:head>
    <title>Import Dove Data | towertracker</title>
</svelte:head>

<main>
    <h1>Import Dove Data</h1>
    
    <div class="import-status">
        <h2>Import Status</h2>
        
        <!-- Last Import Status -->
        {#if data.lastImportStatus}
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
        
        <hr>
        
        <p><strong>Automatic Import:</strong> 
            <span class="status {data.schedulerEnabled ? 'enabled' : 'disabled'}">
                {data.schedulerEnabled ? 'Enabled' : 'Disabled'}
            </span>
        </p>
        {#if data.schedulerEnabled && data.lastImportTime}
            <p><strong>Next Import:</strong> {formatDate(getNextImportTime(data.lastImportTime))}</p>
        {:else if data.schedulerEnabled}
            <p><strong>Next Import:</strong> Will run on next server restart</p>
        {:else}
            <p><strong>Next Import:</strong> Automatic import is disabled</p>
        {/if}
    </div>
    
    {#if importResult}
        <div class="result-box {importResult.success ? 'success' : 'error'}">
            <p>{importResult.message}</p>
            <button on:click={() => importResult = null}>Dismiss</button>
        </div>
    {/if}
    
    {#if loading && progress}
        <div class="progress-container">
            <h3>Import Progress</h3>
            <p class="progress-message">{progress.message}</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {getProgressPercent()}%"></div>
            </div>
            <div class="progress-stats">
                {#if progress.towersTotal > 0}
                    <span>Towers: {progress.towersProcessed}/{progress.towersTotal}</span>
                {/if}
                {#if progress.bellsTotal > 0}
                    <span>Bells: {progress.bellsProcessed}/{progress.bellsTotal}</span>
                {/if}
            </div>
        </div>
    {/if}
    
    <div class="controls">
        <form method="POST" action="?/import" use:enhance={() => {
            loading = true;
            importResult = null;
            progress = null;
            startPolling();
            return async ({ result, update }) => {
                // Don't stop loading here - let polling handle it
                // Result comes back before import is done because it's async
                if (result.type === 'success' && result.data?.skipped) {
                    stopPolling();
                    loading = false;
                    importResult = { success: true, message: result.data.message };
                    await invalidateAll();
                }
            };
        }}>
            <button type="submit" disabled={loading}>
                {loading ? 'Importing...' : 'Manual Import Now'}
            </button>
        </form>
        
        <form method="POST" action="?/{data.schedulerEnabled ? 'disableScheduler' : 'enableScheduler'}" use:enhance={() => {
            return async ({ result }) => {
                await invalidateAll();
            };
        }}>
            <button type="submit" class="scheduler-toggle {data.schedulerEnabled ? 'disable' : 'enable'}">
                {data.schedulerEnabled ? 'Disable Daily Import' : 'Enable Daily Import'}
            </button>
        </form>
    </div>
</main>

<style>
    main {
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
    }
    
    h1 {
        margin-bottom: 1.5rem;
    }
    
    .import-status {
        background: var(--card-bg, #f5f5f5);
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }
    
    .import-status h2 {
        margin-top: 0;
        margin-bottom: 1rem;
    }
    
    .import-status p {
        margin: 0.5rem 0;
    }
    
    .import-status hr {
        margin: 1rem 0;
        border: none;
        border-top: 1px solid var(--border-color, #ddd);
    }
    
    .last-status {
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 0.5rem;
    }
    
    .last-status.success {
        background: rgba(40, 167, 69, 0.1);
        border-left: 4px solid #28a745;
    }
    
    .last-status.error {
        background: rgba(220, 53, 69, 0.1);
        border-left: 4px solid #dc3545;
    }
    
    .last-status.unknown {
        background: rgba(108, 117, 125, 0.1);
        border-left: 4px solid #6c757d;
    }
    
    .status-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
    }
    
    .status-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: bold;
    }
    
    .status-badge.success {
        background: #28a745;
        color: white;
    }
    
    .status-badge.error {
        background: #dc3545;
        color: white;
    }
    
    .status-badge.unknown {
        background: #6c757d;
        color: white;
    }
    
    .status-time {
        font-size: 0.9rem;
        color: var(--text-muted, #666);
        margin: 0.25rem 0;
    }
    
    .status-message {
        margin: 0.5rem 0 0 0;
    }
    
    .success-message {
        color: #155724;
    }
    
    .status {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-weight: bold;
    }
    
    .status.enabled {
        background: #d4edda;
        color: #155724;
    }
    
    .status.disabled {
        background: #f8d7da;
        color: #721c24;
    }
    
    .error-box {
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
        padding: 1rem;
        border-radius: 4px;
        margin-top: 0.5rem;
    }
    
    .error-message {
        font-family: monospace;
        font-size: 0.9rem;
        word-break: break-all;
    }
    
    .error-time {
        font-size: 0.8rem;
        opacity: 0.8;
    }
    
    .result-box {
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .result-box.success {
        background: #d4edda;
        color: #155724;
    }
    
    .result-box.error {
        background: #f8d7da;
        color: #721c24;
    }
    
    .result-box button {
        background: transparent;
        border: 1px solid currentColor;
        color: inherit;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .progress-container {
        background: var(--card-bg, #f5f5f5);
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }
    
    .progress-container h3 {
        margin-top: 0;
        margin-bottom: 0.5rem;
    }
    
    .progress-message {
        margin-bottom: 1rem;
        color: var(--text-muted, #666);
    }
    
    .progress-bar {
        height: 20px;
        background: #e0e0e0;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 0.5rem;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4caf50, #8bc34a);
        transition: width 0.3s ease;
    }
    
    .progress-stats {
        display: flex;
        gap: 2rem;
        font-size: 0.9rem;
        color: var(--text-muted, #666);
    }
    
    .controls {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
    }
    
    .controls button {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        transition: opacity 0.2s;
    }
    
    .controls button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .controls button[type="submit"]:not(.scheduler-toggle) {
        background: #4caf50;
        color: white;
    }
    
    .scheduler-toggle.enable {
        background: #2196f3;
        color: white;
    }
    
    .scheduler-toggle.disable {
        background: #ff9800;
        color: white;
    }
    
    @media (prefers-color-scheme: dark) {
        .import-status, .progress-container {
            background: #2a2a2a;
        }
        
        .status.enabled {
            background: #1b4332;
            color: #95d5b2;
        }
        
        .status.disabled {
            background: #5c1a1a;
            color: #f8d7da;
        }
        
        .error-box {
            background: #5c1a1a;
            border-color: #721c24;
            color: #f8d7da;
        }
        
        .result-box.success {
            background: #1b4332;
            color: #95d5b2;
        }
        
        .result-box.error {
            background: #5c1a1a;
            color: #f8d7da;
        }
        
        .progress-bar {
            background: #444;
        }
        
        .last-status.success {
            background: rgba(40, 167, 69, 0.2);
        }
        
        .last-status.error {
            background: rgba(220, 53, 69, 0.2);
        }
        
        .last-status.unknown {
            background: rgba(108, 117, 125, 0.2);
        }
        
        .success-message {
            color: #95d5b2;
        }
        
        .status-time {
            color: #aaa;
        }
        
        .import-status hr {
            border-top-color: #444;
        }
    }
</style>
