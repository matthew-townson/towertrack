<script>
	import { enhance } from '$app/forms';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let data;
</script>

<svelte:head>
    <title>Import BellBoard Data | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main>
    <h1>Import BellBoard Data</h1>
    <p>Import your BellBoard data to automatically grab towers where applicable, and get further analysis on your peals and quarter peals</p>
    
    <div class="import-options">
        <div class="import-section">
            <h2>Build a search</h2>
            <form method="POST" action="?/import" use:enhance>
                <label for="username">BellBoard name</label>
                <input type="text" id="username" name="username" placeholder="Enter your name as it appears on BellBoard" value={data.user?.username ?? ''} autocomplete="off" required />
                <br>
                <label for="length">Length</label>
                <select id="length" name="length">
                    <option value="all">All lengths</option>
                    <option value="quarters">Quarter peals</option>
                    <option value="quarters+">Quarters and longer</option>
                    <option value="peals">Peals</option>
                    <option value="peals+">Peals and longer</option>
                    <option value="long">Long length</option>
                </select>
                <br>
                <label for="type">Type (Tower or Hand)</label>
                <select id="type" name="type">
                    <option value="all">All</option>
                    <option value="tower">Tower bells</option>
                    <option value="hand">Handbells</option>
                </select>
                <br>
                <button type="submit">Import BellBoard Data</button>
            </form>
        </div>
        
        <div class="import-section">
            <h2>Use a saved BellBoard search</h2>

            <form method="POST" action="?/import-saved-search" use:enhance>
                <label for="search">Saved search ID/link</label>
                <input type="text" id="search" name="search" placeholder="https://bb.ringingworld.co.uk/search.php?id=6205" autocomplete="off" required />
                <button type="submit">Import Saved Search</button>
            </form>
            <br>
            <div class="info">
                <h3>ℹ️ Info</h3>
                <p>You can see your saved searches <a href="https://bb.ringingworld.co.uk/preferences.php#saved-performance-searches" target="_blank">here</a></p>
                <p>Saved searches must be published</p>
            </div>
        </div>
    </div>
    <br>
    <h2>Change what qualifies as a grab</h2>
    <p>Go to <a href="/account/settings">settings</a></p>
</main>

<Footer />
