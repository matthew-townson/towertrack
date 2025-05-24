<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let form;
</script>

<svelte:head>
  <title>Login | towertracker</title>
  <meta name="description" content="Login to towertracker"/>  
</svelte:head>

<Header />

<main>
	<h1>Login</h1>
	<form class="login-box" method="post">
		<label for="username">Username</label>
		<input type="text" id="username" name="username" required />
		<br>
		<label for="password">Password</label>
		<input type="password" id="password" name="password" required />
		<br>
		<button type="submit">Login</button>

		{#if form?.error}
			<p class="error">{form.message}</p>
		{/if}
	</form>
</main>

<Footer />