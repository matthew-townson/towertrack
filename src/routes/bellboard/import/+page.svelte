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
                <select id="username" name="username" required>
                    <option value={data.user.username} selected>{data.user.username}</option>
                    {#each data.aliases as alias}
                        <option value={alias.Name}>{alias.Name}</option>
                    {/each}
                </select>
                <br>
                <label for="exclude-length">Exclude lengths</label>
                <div class="checkbox-group">
                    <label class="checkbox-item">
                        <input type="checkbox" name="exclude-length" value="short_touches" />
                        Short Touches
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" name="exclude-length" value="eighth-peals" />
                        Eighth Peals
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" name="exclude-length" value="quarter-peals" />
                        Quarter Peals
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" name="exclude-length" value="date-touches" />
                        Date Touches
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" name="exclude-length" value="half-peals" />
                        Half Peals
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" name="exclude-length" value="peals" />
                        Peals
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" name="exclude-length" value="long-lengths" />
                        Long Lengths
                    </label>
                </div>
                <br>
                <button type="submit">Add this search</button>
            </form>
        </div>
        
        <div class="import-section">
            <h2>Use a saved BellBoard search</h2>

            <form method="POST" action="?/import-saved-search" use:enhance>
                <label for="search">Saved search ID/link</label>
                <input type="text" id="search" name="search" placeholder="https://bb.ringingworld.co.uk/search.php?id=6205" autocomplete="off" required />
                <button type="submit">Import a Saved Search</button>
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
