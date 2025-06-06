<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    const currentYear = new Date().getFullYear();
    export let error;
    export let status;
    export let data;

    // If both undefined, assume 404
    $: displayStatus = status ?? 404;
    $: errorMessage = error?.message ?? (status === 404 || displayStatus === 404 ? 'Page not found' : 'Unexpected error occurred');
</script>

<svelte:head>
    <title>error {displayStatus} | towertracker</title>
</svelte:head>

<Header user={data?.user} />

<main style="padding: 2rem; text-align: center;">
    <h1>Error {displayStatus}</h1>
    <p style="color: red; margin-top: 1rem;">
        {errorMessage}
    </p>
    <p style="color: gray; font-size: 0.8rem; margin-top: 1rem;">
        Debug: status={status}, error.message={error?.message}
    </p>
</main>

<Footer />