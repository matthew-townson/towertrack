<script>
	import { onMount } from 'svelte';
	export let data;

	onMount(() => {
		const username = data?.user?.username || '';
		const params = new URLSearchParams({
			ringer: username,
			bells_type: 'tower',
			automated_ringing: '0',
			simulated_sound: '0',
			pagesize: '9999'
		});
		const target = `https://bb.ringingworld.co.uk/search.php?${params.toString()}`;
		// Use replace so the redirect page is not kept in history
		window.location.replace(target);
	});
</script>

<svelte:head>
	<title>Redirecting to BellBoard…</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="section">
	<p>Redirecting to the BellBoard search for your username. If you are not redirected automatically, <a href={`https://bb.ringingworld.co.uk/search.php?ringer=${encodeURIComponent(data?.user?.username || '')}&bells_type=tower&automated_ringing=0&simulated_sound=0&pagesize=9999`} target="_blank" rel="noopener noreferrer">click here</a>.</p>
</main>