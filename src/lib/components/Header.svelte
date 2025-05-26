<script>
	import log from '$lib/log.js';
	export let user = null;
	
	// Debug: log user data to see what we're getting
	$: if (user) {
		log.info(`Header user data: ${JSON.stringify(user)}`);
		log.info(`Permission type: ${typeof user.permission}, Value: ${user.permission}`);
	}
</script>

<div class="banner">
	{#if user}
		<a href="/home"><h1>towertracker</h1></a>
	{:else}
		<a href="/"><h1>towertracker</h1></a>
	{/if}
	<nav>
		{#if user}
			<a href="/home">Home</a>
			<a href="/profile">Profile</a>
			<a href="/map">Map</a>
		{:else}
			<a href="/">Home</a>
			<a href="/about">About</a>
		{/if}
		{#if user}
			{#if user.permission === 0}
				<a href="/admin">Admin</a>
			{/if}
			<a href="/account/logout">Logout</a>
		{:else}
			<a href="/account/register">Register</a>
			<a href="/account/login">Login</a>
		{/if}
	</nav>
</div>
