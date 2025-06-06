<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let data;
</script>

<svelte:head>
	<title>Home | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main>
	<h1>Welcome back {data.user.username}!</h1>
	<br>
	<h2>Tower grabbing</h2>
	<ul>
		<li>TODO Add new grabbed towers - <a href="/towers/new" class="button">Add Tower</a></li>
		<li>TODO View your grabbed towers - <a href="/towers" class="button">View Towers</a></li>
		<li>TODO View your grabbed towers on a map - <a href="/towers/map" class="button">View Map</a></li>
		<li>TODO View your grabbed towers on a calendar - <a href="/towers/calendar" class="button">View Calendar</a></li>
		<li>TODO View your grabbed towers on a timeline - <a href="/towers/timeline" class="button">View Timeline</a></li>
	</ul>
	<br><br>
	<h2>BellBoard functions</h2>
	<ul>
		<li>TODO See summary of performances - <a href="/bellboard/summary" class="button">BellBoard Summary</a></li>
		<li>Import performances from BellBoard - <a href="/bellboard/import" class="button">Import BellBoard Performances</a><br><i>(Where applicable, auto-adds to grabbed towers)</i></li>
	</ul>
</main>

<Footer />
