<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import UserSearch from '$lib/components/UserSearch.svelte';

	export let data;

	function handleUserSelect(user) {
		// Could be extended to do something with selected user
		console.log('User selected:', user);
	}
</script>

<svelte:head>
	<title>Find Users | towertracker</title>
	<meta name="description" content="Search and find users on towertracker" />
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="columns is-variable is-8">
			<div class="column">
				<!-- Header -->
				<div class="mb-6">
					<h1 class="title is-2 mb-2">Find Users</h1>
					<p class="subtitle is-5 has-text-grey">Search for users by username</p>
				</div>

				<!-- User Search Component -->
				<div class="box">
					<UserSearch on:userSelected={handleUserSelect} />
				</div>
			</div>
		</div>
	</div>
</main>

<Footer />

<style>
	main {
		min-height: calc(100vh - 200px);
	}
</style>
