<script>
    import { enhance } from '$app/forms';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;
    export let form;
    let loading = false;
</script>

<svelte:head>
    <title>BellBoard Summary | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main>
    <h1>BellBoard Summary for {data.user.username}</h1>

    <form method="POST" action="?/importBBData" use:enhance={() => {
        loading = true;
        return async ({ result }) => {
            loading = false;
        };
    }}>
        <button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update'}
        </button>
    </form>
    <!-- ...existing summary display code... -->
    {#if form?.success}
        <div class="notification is-success">{form.message}</div>
    {/if}
    {#if form?.error}
        <div class="notification is-danger">{form.message}</div>
    {/if}
</main>
