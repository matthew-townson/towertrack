<script>
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    export let data;

    onMount(() => {
        if (data?.user?.username) {
            const userSlug = data.user.username.replace(/ /g, '-');
            goto(`/u/${userSlug}/performance-data`);
        } else {
            goto('/account/login');
        }
    });
</script>
