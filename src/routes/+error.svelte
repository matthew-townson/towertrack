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

<style>
    .error-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    }

    .error-container {
        background: white;
        border-radius: 16px;
        padding: 3rem;
        text-align: center;
        max-width: 600px;
        width: 100%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }

    .error-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
    }

    .error-code {
        font-size: 6rem;
        font-weight: bold;
        color: #e74c3c;
        line-height: 1;
        margin-bottom: 0.5rem;
    }

    .error-title {
        font-size: 2rem;
        color: #2c3e50;
        margin-bottom: 1rem;
        font-weight: 600;
    }

    .error-description {
        font-size: 1.1rem;
        color: #666;
        margin-bottom: 1.5rem;
        line-height: 1.5;
    }

    .error-details {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
        color: #6c757d;
        font-size: 0.9rem;
    }

    .error-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin: 2rem 0;
        flex-wrap: wrap;
    }

    .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: #3498db;
        color: white;
    }

    .btn-primary:hover {
        background: #2980b9;
        transform: translateY(-2px);
    }

    .btn-secondary {
        background: #95a5a6;
        color: white;
    }

    .btn-secondary:hover {
        background: #7f8c8d;
        transform: translateY(-2px);
    }

    @media (max-width: 768px) {
        .error-container {
            padding: 2rem;
            margin: 1rem;
        }

        .error-code {
            font-size: 4rem;
        }

        .error-title {
            font-size: 1.5rem;
        }

        .error-actions {
            flex-direction: column;
        }
    }
</style>