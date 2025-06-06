<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;
</script>

<svelte:head>
    <title>towertracker</title>
</svelte:head>

<Header user={data.user} />

<main>
    <p>Homepage</p>
</main>

<Footer />
