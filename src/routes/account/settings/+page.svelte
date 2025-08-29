<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let form;
	export let data;
	
	let newAlias = '';
	
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

<main>
    <h1>Settings</h1>
    
    <!-- Email Section -->
    <form class="login-box" method="post" action="?/updateEmail">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" value={data.user?.username ?? ''} readonly disabled />
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="Enter your email address" value={data.user?.email ?? ''} autocomplete="off" required />
        <br>
        <button type="submit">Update Email</button>
        <br>
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
    </form>

    <!-- Additional Names Section -->
    <form id="alias-form" class="login-box" method="post" action="?/updateAlias">
        <h2>Additional Names</h2>
        <div class="alias-edit">
			{#if data.aliases && data.aliases.length > 0}
				<div class="alias-list">
					{#each data.aliases as alias}
						<div class="alias-item">
							<span>{alias.Name}</span>
							<button type="button" on:click={() => removeAlias(alias.id)} class="remove-btn">Remove</button>
						</div>
					{/each}
				</div>
			{:else}
                <br>
				<p class="no-aliases">No additional names added yet.</p>
                <br>
			{/if}
			
			<div class="add-alias">
				<input 
					type="text" 
					bind:value={newAlias} 
					placeholder="Enter additional name/alias" 
					on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
				/>
                <br><br>
				<button type="button" on:click={addAlias} disabled={!newAlias.trim()}>Add Name</button>
			</div>
			<div class="info">
				<p>Add other variations of your name as they may appear on BellBoard or other ringing records</p>
			</div>
		</div>
        {#if form?.action === 'updateAlias' && form?.error}
            <div class="error">
                <h3>❗Error</h3>
                <p>{form.message}</p>
            </div>
        {:else if form?.action === 'updateAlias' && form?.success}
            <div class="success">
                <h3>❕Success</h3>
                <p>{form.message}</p>
            </div>
        {/if}
    </form>

    <!-- Password Section -->
    <form class="login-box" method="post" action="?/changePassword">
        <h2>Change Password</h2>
        <label for="currentPassword">Current Password</label>
        <input type="password" id="currentPassword" name="currentPassword" placeholder="Enter your current password" autocomplete="off" required />
        <br>
        <label for="newPassword">New Password</label>
        <input type="password" id="newPassword" name="newPassword" placeholder="8 character minimum (At least one letter and one number)" autocomplete="off" required />
        <br>
        <label for="confirmNewPassword">Confirm New Password</label>
        <input type="password" id="confirmNewPassword" name="confirmNewPassword" placeholder="Confirm your new password" autocomplete="off" required />
        <div class="info">
            <p>All fields are required to change your password</p>
        </div>
        <br>
        
        <button type="submit">Change Password</button>
        <br>
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
    </form>
</main>

<Footer />
