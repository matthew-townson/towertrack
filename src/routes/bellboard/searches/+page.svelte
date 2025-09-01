<script>
    import { enhance } from '$app/forms';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;

    $: usedNames = new Set(data.savedSearches.map(s => s.name));
    let selectedName = data.user.username;
    $: isDuplicate = usedNames.has(selectedName);
    let editingId = null;

    function startEdit(id) {
        editingId = id;
    }
    function cancelEdit() {
        editingId = null;
    }
    function deleteSearch(id) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '?/delete';
        form.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'searchId';
        input.value = id;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
    }
</script>

<svelte:head>
    <title>Import BellBoard Data | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main>
    <h1>Import BellBoard Data</h1>
    <p>Import your BellBoard data to automatically grab towers where applicable, and get further analysis on your peals and quarter peals</p>
    
    <div class="import-options">
        <div class="import-section search-section">
            <h2>Build a search</h2>
            <form method="POST" action="?/import" use:enhance>
                <div class="form-group">
                <div class="info">
                    <h3>ℹ️ Info</h3>
                    <p>Add searchable names <a href="/settings">here</a></p>
                </div>
                    <label for="username">BellBoard name</label>
                    <select
                        id="username"
                        name="username"
                        required
                        bind:value={selectedName}
                    >
                        <option value={data.user.username} disabled={usedNames.has(data.user.username)}>
                            {data.user.username}{usedNames.has(data.user.username) ? ' (already used)' : ''}
                        </option>
                        {#each data.aliases as alias}
                            <option value={alias.Name} disabled={usedNames.has(alias.Name)}>
                                {alias.Name}{usedNames.has(alias.Name) ? ' (already used)' : ''}
                            </option>
                        {/each}
                    </select>
                </div>
                <div class="form-group">
                    <span class="group-label">Exclude lengths</span>
                    <div class="checkbox-group">
                        <label class="checkbox-item" for="exclude-short">
                            <input id="exclude-short" type="checkbox" name="exclude-length" value="short_touches" />
                            Short Touches
                        </label>
                        <label class="checkbox-item" for="exclude-eighth">
                            <input id="exclude-eighth" type="checkbox" name="exclude-length" value="eighth-peals" />
                            Eighth Peals
                        </label>
                    </div>
                </div>
                <button type="submit" class="search-btn" disabled={isDuplicate}>Add this search</button>
                {#if isDuplicate}
                    <div style="color:#c33c54;font-size:0.95rem;margin-top:0.5rem;">
                        This name is already used for a saved search.
                    </div>
                {/if}
            </form>
        </div>
    </div>
    <br>

    <h2>Saved Searches</h2>
    {#if data.savedSearches.length === 0}
        <p>No saved searches yet.</p>
    {:else}
        <table class="user-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Exclude Short Touches</th>
                    <th>Exclude Eighth Peals</th>
                    <th>Edit</th>
                    <th>Delete</th>
                </tr>
            </thead>
            <tbody>
                {#each data.savedSearches as search}
                    <tr>
                        <td>{search.name}</td>
                        <td>
                            {#if editingId === search.id}
                                <input type="checkbox" name="exclude-length" value="short_touches" checked={search.exShort} form={"edit-form-" + search.id} />
                            {:else}
                                <input type="checkbox" disabled checked={search.exShort} />
                            {/if}
                        </td>
                        <td>
                            {#if editingId === search.id}
                                <input type="checkbox" name="exclude-length" value="eighth-peals" checked={search.exEighth} form={"edit-form-" + search.id} />
                            {:else}
                                <input type="checkbox" disabled checked={search.exEighth} />
                            {/if}
                        </td>
                        <td>
                            {#if editingId === search.id}
                                <form id={"edit-form-" + search.id} method="POST" action="?/edit" use:enhance style="display:inline;">
                                    <input type="hidden" name="searchId" value={search.id} />
                                    <button type="submit" class="update-btn" style="padding:2px 8px;">Save</button>
                                    <button type="button" class="update-btn" style="padding:2px 8px;background:#6c757d;margin-left:4px;" on:click={cancelEdit}>Cancel</button>
                                    <span style="margin-left:8px;color:#c33c54;font-weight:bold;">Editing…</span>
                                </form>
                            {:else}
                                <button type="button" class="update-btn" style="padding:2px 8px;" on:click={() => startEdit(search.id)}>Edit</button>
                            {/if}
                        </td>
                        <td>
                            <button type="button" class="delete-btn" style="padding:2px 8px;" on:click={() => deleteSearch(search.id)}>Delete</button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    <br>

    <h2>Change what qualifies as a grab</h2>
    <p>Go to <a href="/account/settings">settings</a></p>
</main>

<Footer />
