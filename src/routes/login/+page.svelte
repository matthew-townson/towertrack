<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let form;
    export let data;
</script>

<svelte:head>
    <title>Login | towertracker</title>
    <meta name="description" content="Login to towertracker"/>  
</svelte:head>

<Header user={data?.user} />

<main>
    <h1>Login</h1>
    <form class="login-box" method="post">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="Enter your name as it appears on BellBoard" value={form?.username ?? ''} autocomplete="off" required />
        <br>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="off" required />
        <br>
        <a href="/account/register">Don't have an account? Register here</a>
        <br>
        <button type="submit">Login</button>

        {#if form?.error}
            <p class="error">{form.message}</p>
        {/if}
    </form>
</main>

<Footer />
