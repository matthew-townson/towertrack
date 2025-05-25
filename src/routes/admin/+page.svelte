<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let data;
</script>

<svelte:head>
	<title>Admin | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main>
	<h1>Admin Panel</h1>
	<p>Welcome, {data.user.username}!</p>
</main>

<Footer />
