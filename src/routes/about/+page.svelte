<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;
</script>

<svelte:head>
    <title>About | towertracker</title>
    <meta name="description" content="Learn more about towertracker, its features, and how to use it."/>
</svelte:head>

<Header user={data.user} />

<main>
    <h1>About Towertracker</h1>
    <p>
        Towertracker is designed to help you track where you have rung and analyse Peals and Quarters at these locations.
        Keep track of your ringing history and view statistics.
    </p>
</main>