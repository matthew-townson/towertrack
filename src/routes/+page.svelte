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

<main class="landing-page">
    <div class="landing-page__container">
        <section class="landing-page__box">
            <h1>Welcome to towertracker</h1>
            <h2>The site for tracking tower grabs and performance data.</h2>
            <p>Tracking <strong>{data.grabCount}</strong> tower grabs, and <strong>{data.performanceCount}</strong> performances of {data.userCount ? `${data.userCount} users` : 'no users'}</p>
            <p>Users have accumulated a total of <strong>{data.totalChanges}</strong> changes, rung across <strong>{data.pealCount}</strong> peals, and <strong>{data.quarterPealCount}</strong> quarter peals</p>
            <p>Total time spent ringing: <strong>{data.totalTimeSpent}</strong></p>
        </section>

        <section class="landing-page__box">
            <h2>See your tower grabs and peal locations</h2>
            <img class="landing-page__image" src="/assets/image/homepage/map.png" alt="Map of tower grabs" />
        </section>

        <section class="landing-page__box">
            <h2>Grab towers</h2>
            <img class="landing-page__image" src="/assets/image/homepage/tower.png" alt="Grab a tower" />
        </section>

        <section class="landing-page__box">
            <h2>Get started here</h2>
            <a href="/account/register" class="button is-danger">Register</a>
        </section>
    </div>
</main>

<Footer />
