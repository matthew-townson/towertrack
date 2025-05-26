<script>
	import { enhance } from '$app/forms';
	
	let loading = false;
</script>

<svelte:head>
	<title>Import Dove Data | towertracker</title>
</svelte:head>

<main>
	<h1>Import Dove Data</h1>
	
	<form method="POST" action="?/import" use:enhance={() => {
		loading = true;
		return async ({ result }) => {
			loading = false;
		};
	}}>
		<button type="submit" disabled={loading}>
			{loading ? 'Importing...' : 'Import Dove Data'}
		</button>
	</form>
</main>
