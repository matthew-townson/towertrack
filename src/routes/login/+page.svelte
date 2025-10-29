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
        <div class="field">
            <label for="username">Username</label>
            <input class="input" type="text" id="username" name="username" placeholder="Enter your name as it appears on BellBoard" value={form?.username ?? ''} autocomplete="off" required />
            <br>
        </div>
        <div class="field">
            <label for="password">Password</label>
            <input class="input" type="password" id="password" name="password" autocomplete="off" required />
            <br>
        </div>
        <div class="field">
            <a href="/account/register">Register for an account</a>
            <br>
        </div>
        <button type="submit">Login</button>
        
        {#if form?.error}
        <p class="error is-warning">{form.message}</p>
        {/if}
    </form>
</main>

<Footer />
