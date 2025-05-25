<script>
	export let user = null;
</script>

<div class="banner">
	<a href="/"><h1>towertracker</h1></a>
	<nav>
		<a href="/">Home</a>
		<a href="/about">About</a>
		{#if user}
			<a href="/logout">Logout</a>
		{:else}
			<a href="/register">Register</a>
			<a href="/login">Login</a>
		{/if}
	</nav>
</div>
