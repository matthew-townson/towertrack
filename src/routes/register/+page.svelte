<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let form;
</script>

<svelte:head>
    <title>Register | towertracker</title>
    <meta name="description" content="Register for towertracker"/>
</svelte:head>

<Header />

<main>
	<h1>Sign Up</h1>
	<form class="login-box" method="post">
		<label for="username">Username</label>
		<input type="text" id="username" name="username" placeholder="Enter your name as it appears on BellBoard" required />
		<br>
		<label for="password">Password</label>
		<input type="password" id="password" name="password" placeholder="8 character minimum" required/>
		<br>
		<label for="email">Email</label>
		<input type="email" id="email" name="email" placeholder="ringer@email.com" required />
		<br>
		<label for="confirmEmail">Confirm Email</label>
		<input type="email" id="confirmEmail" name="confirmEmail" placeholder="ringer@email.com" required />
		<br>
		<button type="submit">Login</button>

		{#if form?.error}
			<p class="error">{form.message}</p>
		{/if}
	</form>
</main>

<Footer />