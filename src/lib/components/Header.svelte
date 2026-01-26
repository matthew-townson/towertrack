<script>
	export let user = null;
	let menuOpen = false;

	$: userSlug = user ? user.username.replace(/ /g, '-') : '';
</script>

<nav class="navbar has-shadow is-spaced custom-banner-bg" aria-label="main navigation">
	<div class="navbar-brand">
		<a class="navbar-item" href="/">
			<h1 class="title is-4 has-text-white">towertracker</h1>
		</a>
		<button type="button"
			class="navbar-burger has-text-white"
			aria-label="menu"
			aria-expanded={menuOpen}
			on:click={() => menuOpen = !menuOpen}
		>
			<span aria-hidden="true"></span>
			<span aria-hidden="true"></span>
			<span aria-hidden="true"></span>
		</button>
	</div>
	<div class="navbar-menu" class:is-active={menuOpen}>
		<div class="navbar-start">
			{#if user}
				<a class="navbar-item has-text-white" href="/home">Home</a>
				<a class="navbar-item has-text-white" href="/tower/search">Towers</a>
				<a class="navbar-item has-text-white" href="/statistics">Statistics</a>
				<a class="navbar-item has-text-white" href="/grab">Grabs</a>
				<a class="navbar-item has-text-white" href="/bellboard/summary">BellBoard Data</a>
				<a class="navbar-item has-text-white" href="/u/{userSlug}">Profile</a>
				<a class="navbar-item has-text-white" href="/map">Map</a>
			{:else}
				<a class="navbar-item has-text-white" href="/">Home</a>
				<a class="navbar-item has-text-white" href="/about">About</a>
			{/if}
		</div>
		<div class="navbar-end">
			{#if user}
				{#if user.permission === 0}
					<a class="navbar-item has-text-white" href="/admin">Admin</a>
				{/if}
				<a class="navbar-item has-text-white" href="/account/settings">Settings</a>
				<a class="navbar-item has-text-white" href="/account/logout">Logout</a>
			{:else}
				<a class="navbar-item has-text-white" href="/account/register">Register</a>
				<a class="navbar-item has-text-white" href="/account/login">Login</a>
			{/if}
		</div>
	</div>
</nav>
