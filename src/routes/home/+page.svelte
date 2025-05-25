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
	<h1>Home</h1>
	<p>Welcome back {data.user.username}!</p>
</main>

<Footer />
