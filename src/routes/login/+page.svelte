<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let form;
	const currentYear = new Date().getFullYear();
</script>

<Header />

<main>
	<form class="login-box" method="post">
		<label for="username">Username</label>
		<input type="text" id="username" name="username" required />

		<label for="password">Password</label>
		<input type="password" id="password" name="password" required />

		<button type="submit">Login</button>

		{#if form?.error}
			<p class="error">{form.message}</p>
		{/if}
	</form>
</main>

<Footer />