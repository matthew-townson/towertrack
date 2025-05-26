<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	
	export let data;
	
	let loading = false;
	
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
		} else {
			return `${hours} hour${hours === 1 ? '' : 's'} ago`;
		}
	}
</script>

<svelte:head>
	<title>Import Dove Data | towertracker</title>
</svelte:head>

<main>
	<h1>Import Dove Data</h1>
	
	<div class="import-status">
		<h2>Import Status</h2>
		<p><strong>Last Import:</strong> {formatDate(data.lastImportTime)} ({getTimeSinceImport(data.lastImportTime)})</p>
		<p><strong>Automatic Import:</strong> 
			<span class="status {data.schedulerEnabled ? 'enabled' : 'disabled'}">
				{data.schedulerEnabled ? 'Enabled' : 'Disabled'}
			</span>
		</p>
		{#if data.schedulerEnabled && data.lastImportTime}
			<p><strong>Next Import:</strong> {formatDate(new Date(new Date(data.lastImportTime).getTime() + 24 * 60 * 60 * 1000))}</p>
		{:else}
			<p><strong>Next Import:</strong> Automatic import is disabled</p>
		{/if}
		
		{#if data.lastImportError}
			<p><strong>Last Import Error:</strong> {data.lastImportError}</p>
		{:else}
			<p><strong>Last Import Error:</strong> None</p>
		{/if}
	</div>
	
	<div class="controls">
		<form method="POST" action="?/import" use:enhance={() => {
			loading = true;
			return async ({ result }) => {
				loading = false;
				// Refresh the page data to get updated import time
				await invalidateAll();
			};
		}}>
			<button type="submit" disabled={loading}>
				{loading ? 'Importing...' : 'Manual Import Now'}
			</button>
		</form>
		
		<form method="POST" action="?/{data.schedulerEnabled ? 'disableScheduler' : 'enableScheduler'}" use:enhance={() => {
			return async ({ result }) => {
				// Invalidate all to refresh data
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
	.import-status {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 2rem;
	}
	
	.import-status h2 {
		margin-top: 0;
	}
	
	.import-status p {
		margin: 0.5rem 0;
	}
	
	.status {
		font-weight: bold;
	}
	
	.status.enabled {
		color: #22c55e;
	}
	
	.status.disabled {
		color: #ef4444;
	}
	
	.controls {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	
	.scheduler-toggle.enable {
		background-color: #22c55e;
	}
	
	.scheduler-toggle.disable {
		background-color: #ef4444;
	}
	
	.scheduler-toggle.enable:hover {
		background-color: #16a34a;
	}
	
	.scheduler-toggle.disable:hover {
		background-color: #dc2626;
	}
</style>
