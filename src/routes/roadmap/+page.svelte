<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let data;
</script>

<svelte:head>
	<title>Roadmap | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="content">
			<h1 class="title">Roadmap</h1>
			<p class="subtitle">Planned fixes/changes updates</p>

            <div class="box">
                <h2 class="title is-4">Upcoming Features/Fixes</h2>
                <p>
                    - Improvements to map filtering<br>
                    - User profiles<br>
                    - Statistics and analysis of BellBoard data and grabs<br>
                </p>
		</div>
	</div>
</main>

<Footer />
