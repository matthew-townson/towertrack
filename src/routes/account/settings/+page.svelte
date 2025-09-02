<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let form;
	export let data;
	
	let newAlias = '';
	let activeSection = 'profile'; // Default to profile section
	
	function setActiveSection(section) {
		activeSection = section;
	}
	
	function addAlias() {
		if (newAlias.trim()) {
			// Add the new alias to the form data
			const aliasInput = document.createElement('input');
			aliasInput.type = 'hidden';
			aliasInput.name = 'addAlias';
			aliasInput.value = newAlias.trim();
			document.querySelector('#alias-form').appendChild(aliasInput);
			
			// Submit the form
			document.querySelector('#alias-form').submit();
		}
	}
	
	function removeAlias(aliasId) {
		// Add the alias ID to remove to the form data
		const removeInput = document.createElement('input');
		removeInput.type = 'hidden';
		removeInput.name = 'removeAlias';
		removeInput.value = aliasId;
		document.querySelector('#alias-form').appendChild(removeInput);
		
		// Submit the form
		document.querySelector('#alias-form').submit();
	}
</script>

<svelte:head>
    <title>Settings | towertracker</title>
    <meta name="description" content="Change account settings"/>
</svelte:head>

<Header user={data.user} />

<main class="settings-container">
    <div class="settings-sidebar">
        <h2>Settings</h2>
        <nav class="settings-nav">
            <button 
                class="nav-item {activeSection === 'profile' ? 'active' : ''}"
                on:click={() => setActiveSection('profile')}
            >
                Profile
            </button>
            <button 
                class="nav-item {activeSection === 'aliases' ? 'active' : ''}"
                on:click={() => setActiveSection('aliases')}
            >
                Additional Names
            </button>
            <button 
                class="nav-item {activeSection === 'privacy' ? 'active' : ''}"
                on:click={() => setActiveSection('privacy')}
            >
                Privacy
            </button>
            <button 
                class="nav-item {activeSection === 'password' ? 'active' : ''}"
                on:click={() => setActiveSection('password')}
            >
                Password
            </button>
            <button 
                class="nav-item {activeSection === 'grabs' ? 'active' : ''}"
                on:click={() => setActiveSection('grabs')}
            >
                Grab Settings
            </button>
        </nav>
    </div>
    
    <div class="settings-content">
        {#if activeSection === 'profile'}
            <form class="settings-section" method="post" action="?/updateEmail">
                <h2>Profile Settings</h2>
                <div class="login-box">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" value={data.user?.username ?? ''} readonly disabled />
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" placeholder="Enter your email address" value={data.user?.email ?? ''} autocomplete="off" required />
                    <button type="submit">Update Email</button>
                    {#if form?.action === 'updateEmail' && form?.error}
                        <div class="error">
                            <h3>❗Error</h3>
                            <p>{form.message}</p>
                        </div>
                    {:else if form?.action === 'updateEmail' && form?.success}
                        <div class="success">
                            <h3>❕Success</h3>
                            <p>{form.message}</p>
                        </div>
                    {/if}
                </div>
            </form>
        {/if}

        {#if activeSection === 'aliases'}
            <form id="alias-form" class="box" method="post" action="?/updateAlias">
                <h2 class="title is-5 mb-4">Additional Names</h2>
                <div class="notification is-info mb-4">
                    Add other variations of your name as they may appear on BellBoard or other ringing records.
                </div>
                <div>
                    <div>
                        <!-- Show username as non-removable item -->
                        <div class="box has-background-light mb-2 is-flex is-align-items-center is-justify-content-space-between">
                            <span>
                                <span class="has-text-weight-semibold">{data.user?.username ?? ''}</span>
                                &nbsp;-&nbsp;
                                <a href="https://bb.ringingworld.co.uk/search.php?ringer={data.user?.username ?? ''}&bells_type=tower&automated_ringing=0&simulated_sound=0&pagesize=9999" target="_blank" class="has-text-link">Link</a>
                            </span>
                            <span class="tag is-info is-light">Username</span>
                        </div>
                        {#if data.aliases && data.aliases.length > 0}
                            {#each data.aliases as alias}
                                <div class="box mb-2 is-flex is-align-items-center is-justify-content-space-between">
                                    <span>
                                        <span class="has-text-weight-semibold">{alias.Name}</span>
                                        &nbsp;-&nbsp;
                                        <a href="https://bb.ringingworld.co.uk/search.php?ringer={alias.Name}&bells_type=tower&automated_ringing=0&simulated_sound=0&pagesize=9999" target="_blank" class="has-text-link">Link</a>
                                    </span>
                                    <button type="button" on:click={() => removeAlias(alias.id)} class="button is-danger is-light is-small">Remove</button>
                                </div>
                            {/each}
                        {/if}
                    </div>
                    <div class="field is-grouped mt-4">
                        <div class="control is-expanded">
                            <input 
                                type="text" 
                                bind:value={newAlias} 
                                placeholder="Enter name/alias" 
                                class="input"
                                on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                            />
                        </div>
                        <div class="control">
                            <button type="button" class="button is-primary" on:click={addAlias} disabled={!newAlias.trim()}>Add</button>
                        </div>
                    </div>
                </div>
                {#if form?.action === 'updateAlias' && form?.error}
                    <div class="notification is-danger mt-3">
                        <strong>Error:</strong> {form.message}
                    </div>
                {:else if form?.action === 'updateAlias' && form?.success}
                    <div class="notification is-success mt-3">
                        <strong>Success:</strong> {form.message}
                    </div>
                {/if}
            </form>
        {/if}

        {#if activeSection === 'privacy'}
            <form class="settings-section" method="post" action="?/updatePrivacy">
                <h2>Privacy Settings</h2>
                <div class="login-box">
                    <label for="profileVisibility">Profile Visibility</label>
                    <select id="profileVisibility" name="profileVisibility">
                        <option value="1" selected={data.privacy?.profileVisibility}>Public</option>
                        <option value="0" selected={!data.privacy?.profileVisibility}>Private</option>
                    </select>
                    <label for="dataVisibility">Data Visibility</label>
                    <select id="dataVisibility" name="dataVisibility">
                        <option value="1" selected={data.privacy?.dataVisibility}>Visible</option>
                        <option value="0" selected={!data.privacy?.dataVisibility}>Hidden</option>
                    </select>
                    <br>
                    <br>
                    <button type="submit">Update Privacy Settings</button>
                    {#if form?.action === 'updatePrivacy' && form?.error}
                        <div class="error">
                            <h3>❗Error</h3>
                            <p>{form.message}</p>
                        </div>
                    {:else if form?.action === 'updatePrivacy' && form?.success}
                        <div class="success">
                            <h3>❕Success</h3>
                            <p>{form.message}</p>
                        </div>
                    {/if}
                </div>
            </form>
        {/if}

        {#if activeSection === 'password'}
            <form class="settings-section" method="post" action="?/changePassword">
                <h2>Change Password</h2>
                <div class="login-box">
                    <label for="currentPassword">Current Password</label>
                    <input type="password" id="currentPassword" name="currentPassword" placeholder="Enter your current password" autocomplete="off" required />
                    <label for="newPassword">New Password</label>
                    <input type="password" id="newPassword" name="newPassword" placeholder="8 character minimum (At least one letter and one number)" autocomplete="off" required />
                    <label for="confirmNewPassword">Confirm New Password</label>
                    <input type="password" id="confirmNewPassword" name="confirmNewPassword" placeholder="Confirm your new password" autocomplete="off" required />
                    <button type="submit">Change Password</button>
                    {#if form?.action === 'changePassword' && form?.error}
                        <div class="error">
                            <h3>❗Error</h3>
                            <p>{form.message}</p>
                        </div>
                    {:else if form?.action === 'changePassword' && form?.success}
                        <div class="success">
                            <p>{form.message}</p>
                        </div>
                    {/if}
                </div>
            </form>
        {/if}

        {#if activeSection === 'grabs'}
            <form class="settings-section" method="post" action="?/updateGrabSettings">
                <h2>Grab Settings</h2>
                <div class="login-box">
                    <div class="info">
                        <p>Configure what qualifies as a "grab" when importing BellBoard data</p>
                    </div>

                    <br>
                    
                    <label for="bellsPercent">Percentage of Bells</label>
                    <input type="number" id="bellsPercent" name="bellsPercent" 
                           value={data.grabSettings?.bellsPercent} 
                           min="1" max="100" required />
                    
                    <button type="submit">Update Grab Settings</button>
                    {#if form?.action === 'updateGrabSettings' && form?.error}
                        <div class="error">
                            <h3>❗Error</h3>
                            <p>{form.message}</p>
                        </div>
                    {:else if form?.action === 'updateGrabSettings' && form?.success}
                        <div class="success">
                            <h3>❕Success</h3>
                            <p>{form.message}</p>
                        </div>
                    {/if}
                </div>
            </form>
        {/if}
    </div>
</main>

<Footer />
