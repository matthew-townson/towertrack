<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    const currentYear = new Date().getFullYear();
    export let error;
    export let status;
    export let data;

    // Use page store values as fallback, but prioritize exported props
    $: displayStatus = status ?? $page.status ?? 404;
    $: displayMessage = error?.message ?? $page.error?.message ?? 'An unexpected error occurred';

    // Log error details to console for debugging
    $: if (error || $page.error) {
        console.error('Error page rendered:', {
            status: displayStatus,
            message: displayMessage,
            error: error || $page.error,
            url: $page.url?.pathname
        });
    }

    function getErrorTitle(statusCode) {
        switch(statusCode) {
            case 404: return 'Page Not Found';
            case 403: return 'Access Forbidden';
            case 500: return 'Internal Server Error';
            case 503: return 'Service Unavailable';
            default: return 'Error';
        }
    }

    function getErrorDescription(statusCode) {
        switch(statusCode) {
            case 404: return 'The page you\'re looking for doesn\'t exist or has been moved.';
            case 403: return 'You don\'t have permission to access this resource.';
            case 500: return 'Something went wrong on our end. Please try again later.';
            case 503: return 'The service is temporarily unavailable. Please try again later.';
            default: return 'An unexpected error occurred.';
        }
    }

    function goHome() {
        try {
            goto('/');
        } catch (err) {
            console.error('Failed to navigate to home:', err);
            window.location.href = '/';
        }
    }

    function goBack() {
        try {
            if (typeof window !== 'undefined' && window.history.length > 1) {
                history.back();
            } else {
                goto('/');
            }
        } catch (err) {
            console.error('Failed to navigate back:', err);
            window.location.href = '/';
        }
    }
</script>

<svelte:head>
    <title>{getErrorTitle(displayStatus)} - TowerTrack</title>
    <link rel="stylesheet" href="/assets/css/error.css">
</svelte:head>

<Header user={data?.user} />

<main class="error-page">
    <div class="error-container">
        <div class="error-icon">
            {#if displayStatus === 404}
                🤷
            {:else if displayStatus === 403}
                🔒
            {:else if displayStatus === 500}
                ⚠️
            {:else}
                ❌
            {/if}
        </div>
        
        <div class="error-code">{displayStatus}</div>
        <h1 class="error-title">{getErrorTitle(displayStatus)}</h1>
        <p class="error-description">{getErrorDescription(displayStatus)}</p>
        
        {#if displayMessage && displayMessage !== getErrorDescription(displayStatus)}
            <div class="error-details">
                <strong>Details:</strong> {displayMessage}
            </div>
        {/if}

        <div class="error-actions">
            <button on:click={goBack} class="btn btn-secondary">
                ← Go Back
            </button>
            <button on:click={goHome} class="btn btn-primary">
                🏠 Home
            </button>
        </div>
    </div>
</main>

<Footer />