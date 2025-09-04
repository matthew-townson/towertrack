<script>
    import { enhance } from '$app/forms';
    export let data;
    export let form;
    let loading = false;
</script>

<main>
    <h1>BellBoard Summary</h1>
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
