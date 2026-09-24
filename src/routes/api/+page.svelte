<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';

    export let data;
</script>

<svelte:head>
    <title>API documentation | towertracker</title>
    <meta name="description" content="towertracker API documentation." />
    <link rel="stylesheet" href="/assets/css/api.css" />
</svelte:head>

<Header user={data.user} />

<main class="container section api-documentation">
    <h1 class="title">API documentation</h1>

    <p>
        All application API routes are rooted at <code>/api</code>. JSON endpoints use the
        authenticated session cookie unless noted otherwise. A failed request returns an
        appropriate HTTP status and a JSON body containing an <code>error</code> message.
    </p>

    <h2 class="subtitle">User grabs</h2>

    <p><code>GET /api/user-grabs</code></p>

    <p>Returns grab data for the signed-in user. The optional <code>view</code> query parameter controls the response:</p>

    <table class="table is-fullwidth">
        <thead>
            <tr>
                <th>View</th>
                <th>Response</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>dashboard</code> (default)</td>
                <td><code>{'{ grabCount, recentGrabs }'}</code>, with up to five recent grabs</td>
            </tr>
            <tr>
                <td><code>full</code></td>
                <td><code>{'{ grabCount, recentGrabs, grabs }'}</code>, including grabbed bell details</td>
            </tr>
            <tr>
                <td><code>existing</code></td>
                <td><code>{'{ userGrabs }'}</code>, containing <code>towerID</code> and <code>ringID</code> for each grab</td>
            </tr>
        </tbody>
    </table>

    <p>
        Example: <code>GET /api/user-grabs?view=existing</code>
    </p>

    <p>
        The endpoint returns <code>401 Unauthorized</code> when there is no signed-in user and
        <code>400 Invalid view</code> for an unsupported view.
    </p>

    <h2 class="subtitle">Related read endpoints</h2>

    <ul>
        <li><code>GET /api/search-towers?query=&lt;text&gt;</code> searches towers for the signed-in user.</li>
        <li><code>GET /api/tower?id=&lt;towerId&gt;</code> returns one tower.</li>
        <li><code>GET /api/bells?towerId=&lt;towerId&gt;&amp;ringId=&lt;ringId&gt;</code> returns bells for a tower.</li>
        <li><code>GET /api/user-lists</code> returns the signed-in user's lists.</li>
        <li><code>GET /api/search-users?q=&lt;text&gt;</code> searches users for the signed-in user.</li>
        <li><code>GET /api/map-filters</code> returns the available map filter values.</li>
    </ul>

    <p>
        The route files under <code>src/routes/api</code> are the source of truth for the full
        API surface, including write operations and administrator-only endpoints.
    </p>
</main>

<Footer />