<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;
</script>

<svelte:head>
    <title>towertracker</title>
    <link rel="stylesheet" href="/assets/css/home.css">
</svelte:head>

<Header user={data.user} />

<main>
Tracking statistics of {data.userCount ? `${data.userCount} users` : 'no users'}
</main>

<Footer />
