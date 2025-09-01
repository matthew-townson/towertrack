<script>
	export let user = null;
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
			<a href="/account/settings">Settings</a>
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
