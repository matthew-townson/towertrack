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
    <h1>Welcome to towertracker</h1>
    <p>Tracking {data.grabCount} tower grabs and {data.performanceCount} performances of {data.userCount ? `${data.userCount} users` : 'no users'}</p>
    <br>
    <h2>See your tower grabs and peal locations</h2>
    <img src="assets/image/homepage/map.png" alt="Map of tower grabs" width="30%" height="auto"/>
    <br><br>
    <h2>Grab towers</h2>
    <img src="assets/image/homepage/tower.png" alt="Grab a tower" width="30%" height="auto"/>
    <br><br>
    <h2>Get started here</h2>
    <a href="/account/register" class="button">Register</a>
</main>

<Footer />
