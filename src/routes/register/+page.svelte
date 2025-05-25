<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let form;
	export let data;
</script>

<svelte:head>
    <title>Register | towertracker</title>
    <meta name="description" content="Register for towertracker"/>
</svelte:head>

<Header user={data.user} />

<main>
	<h1>Sign Up</h1>
	<form class="login-box" method="post">
		<label for="username">Username</label>
		<input type="text" id="username" name="username" placeholder="Enter your name as it appears on BellBoard" value={form?.username ?? ''} autocomplete="off" required />
		<br>
		<label for="password">Password</label>
		<input type="password" id="password" name="password" placeholder="8 character minimum (At least one letter and one number)" autocomplete="off" required/>
		<br>
		<label for="email">Email</label>
		<input type="email" id="email" name="email" placeholder="ringer@email.com" value={form?.email ?? ''} autocomplete="off" required />
		<br>
		<label for="confirmEmail">Confirm Email</label>
		<input type="email" id="confirmEmail" name="confirmEmail" placeholder="ringer@email.com" value={form?.confirmEmail ?? ''} autocomplete="off" required />
		<br>
		<button type="submit">Register</button>
		{#if form?.error}
			<p class="error">{form.message}</p>
		{/if}
	</form>
</main>

<Footer />