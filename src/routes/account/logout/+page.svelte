<script>
    import { onMount } from 'svelte';
    import { goto, invalidateAll } from '$app/navigation';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    
    export let data;
    
    onMount(async () => {
        setTimeout(async () => {
            await fetch('/account/logout', { method: 'POST' });
            // refresh user state
            await invalidateAll();
            goto('/', { replaceState: true });
        }, 2000);
    });
</script>

<svelte:head>
    <title>Logging out | towertracker</title>
    <meta name="description" content="Logging out of towertracker"/>
</svelte:head>

<Header user={data?.user} />

<main>
    <h1>Logging out<span class="ellipsis">...</span></h1>
    <p>You will be redirected shortly.</p>
</main>

<Footer />
