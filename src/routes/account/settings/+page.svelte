<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	export let form;
	export let data;

	let newAlias = '';
	let activeSection = 'profile';

	onMount(() => {
		const urlSection = $page.url.searchParams.get('section');
		if (urlSection && ['profile','aliases','privacy','password','grabs'].includes(urlSection)) {
			activeSection = urlSection;
		}
	});

	$: if (form?.redirect) {
		const match = form.redirect.match(/section=([a-z]+)/);
		if (match && match[1]) {
			activeSection = match[1];
		}
	}

	function setActiveSection(section) {
		activeSection = section;
	}

	function addAlias() {
		if (newAlias.trim()) {
			const aliasInput = document.createElement('input');
			aliasInput.type = 'hidden';
			aliasInput.name = 'addAlias';
			aliasInput.value = newAlias.trim();
			document.querySelector('#alias-form').appendChild(aliasInput);
			document.querySelector('#alias-form').submit();
		}
	}

	function removeAlias(aliasId) {
		const removeInput = document.createElement('input');
		removeInput.type = 'hidden';
		removeInput.name = 'removeAlias';
		removeInput.value = aliasId;
		document.querySelector('#alias-form').appendChild(removeInput);
		document.querySelector('#alias-form').submit();
	}

	let imageUploadStatus = '';
	let imageUploadError = '';
	let isUploadingImage = false;
	let selectedImageFile = null;

	async function handleImageUpload(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		selectedImageFile = file;
		
		// Validate file size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			imageUploadError = 'File size must be less than 5MB';
			selectedImageFile = null;
			return;
		}

		// Validate file type
		const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (!validTypes.includes(file.type)) {
			imageUploadError = 'Only JPEG, PNG, WebP, and GIF images are allowed';
			selectedImageFile = null;
			return;
		}

		imageUploadError = '';
	}

	async function uploadProfileImage() {
		if (!selectedImageFile) return;

		isUploadingImage = true;
		imageUploadError = '';
		imageUploadStatus = 'Uploading...';

		try {
			const formData = new FormData();
			formData.append('image', selectedImageFile);

			const response = await fetch('/api/profile-image', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Upload failed');
			}

			imageUploadStatus = 'Profile image uploaded successfully!';
			selectedImageFile = null;
			const fileInput = document.querySelector('#profile-image-input');
			if (fileInput) fileInput.value = '';
			
			// Refresh after 2 seconds to show new image
			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} catch (error) {
			imageUploadError = error.message || 'Failed to upload image';
			imageUploadStatus = '';
		} finally {
			isUploadingImage = false;
		}
	}

	async function deleteProfileImage() {
		if (!confirm('Are you sure you want to delete your profile image?')) return;

		isUploadingImage = true;
		imageUploadError = '';
		imageUploadStatus = 'Deleting...';

		try {
			const response = await fetch('/api/profile-image', {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Delete failed');
			}

			imageUploadStatus = 'Profile image deleted successfully!';
			selectedImageFile = null;
			const fileInput = document.querySelector('#profile-image-input');
			if (fileInput) fileInput.value = '';

			// Refresh after 2 seconds
			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} catch (error) {
			imageUploadError = error.message || 'Failed to delete image';
			imageUploadStatus = '';
		} finally {
			isUploadingImage = false;
		}
	}
</script>

<svelte:head>
    <title>Settings | towertracker</title>
    <meta name="description" content="Change account settings"/>
</svelte:head>

<Header user={data.user} />

<main class="settings-container">
    <div class="settings-sidebar box is-dark is-radiusless is-shadowless">
        <h2 class="has-text-light">Settings</h2>
        <nav class="settings-nav">
            <button 
                class="nav-item {activeSection === 'profile' ? 'active' : ''} has-text-light"
                on:click={() => setActiveSection('profile')}
            >
                Profile
            </button>
            <button 
                class="nav-item {activeSection === 'aliases' ? 'active' : ''} has-text-light"
                on:click={() => setActiveSection('aliases')}
            >
                Additional Names
            </button>
            <button 
                class="nav-item {activeSection === 'privacy' ? 'active' : ''} has-text-light"
                on:click={() => setActiveSection('privacy')}
            >
                Privacy
            </button>
            <button 
                class="nav-item {activeSection === 'password' ? 'active' : ''} has-text-light"
                on:click={() => setActiveSection('password')}
            >
                Password
            </button>
            <button 
                class="nav-item {activeSection === 'grabs' ? 'active' : ''} has-text-light"
                on:click={() => setActiveSection('grabs')}
            >
                Grab Settings
            </button>
            <a href="/lists" class="nav-item has-text-light" style="text-align: left; cursor: pointer;">
                User Lists
            </a>
        </nav>
    </div>
    
    <div class="settings-content">
        {#if activeSection === 'profile'}
            <form class="settings-section box is-dark" method="post" action="?/updateEmail">
                <h2 class="title is-5 has-text-light mb-4">Profile Settings</h2>
                <div class="field">
                    <label class="label has-text-light" for="username">Username</label>
                    <input class="input is-dark" type="text" id="username" name="username" value={data.user?.username ?? ''} readonly disabled />
                </div>
                <div class="field">
                    <label class="label has-text-light" for="email">Email</label>
                    <input class="input is-dark" type="email" id="email" name="email" placeholder="Enter your email address" value={data.user?.email ?? ''} autocomplete="off" required />
                </div>
                <button type="submit" class="button is-danger is-fullwidth mt-3">Update Email</button>
                {#if form?.action === 'updateEmail' && form?.error}
                    <div class="notification is-danger mt-3">
                        <strong>Error:</strong> {form.message}
                    </div>
                {:else if form?.action === 'updateEmail' && form?.success}
                    <div class="notification is-success mt-3">
                        <strong>Success:</strong> {form.message}
                    </div>
                {/if}
            </form>

            <div class="settings-section box is-dark mt-4">
                <h2 class="title is-5 has-text-light mb-4">Profile Image</h2>
                <div class="field mb-4">
                    <div class="mb-3">
                        <p class="has-text-light is-size-7">Upload a profile picture (Max 5MB, JPEG/PNG/WebP/GIF)</p>
                    </div>
                    <div class="file is-dark">
                        <label class="file-label">
                            <input 
                                id="profile-image-input"
                                class="file-input" 
                                type="file" 
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                on:change={handleImageUpload}
                                disabled={isUploadingImage}
                            />
                            <span class="file-cta">
                                <span class="file-label has-text-light">Choose a file…</span>
                            </span>
                            <span class="file-name has-text-light">
                                {selectedImageFile?.name || 'No file selected'}
                            </span>
                        </label>
                    </div>
                </div>

                {#if imageUploadError}
                    <div class="notification is-danger mb-3">
                        {imageUploadError}
                    </div>
                {/if}

                {#if imageUploadStatus}
                    <div class="notification is-success mb-3">
                        {imageUploadStatus}
                    </div>
                {/if}

                <div class="is-flex is-flex-wrap-wrap is-gap-2">
                    {#if selectedImageFile || data.user?.profileImage}
                        <button 
                            type="button" 
                            class="button is-success {isUploadingImage ? 'is-loading' : ''}"
                            on:click={uploadProfileImage}
                            disabled={!selectedImageFile || isUploadingImage}
                        >
                            Upload Image
                        </button>
                    {/if}
                    {#if data.user?.profileImage}
                        <button 
                            type="button" 
                            class="button is-danger {isUploadingImage ? 'is-loading' : ''}"
                            on:click={deleteProfileImage}
                            disabled={isUploadingImage}
                        >
                            Delete Current Image
                        </button>
                    {/if}
                </div>
            </div>
        {/if}

        {#if activeSection === 'aliases'}
            <form id="alias-form" class="settings-section box is-dark" method="post" action="?/updateAlias">
                <h2 class="title is-5 has-text-light mb-4">Additional Names</h2>
                <div class="notification is-info mb-4">
                    Add other variations of your name as they may appear on BellBoard or other ringing records.
                </div>
                <div class="field">
                    <div class="label has-text-light">Your Username</div>
                    <div class="control is-flex is-align-items-center is-justify-content-space-between">
                        <span>
                            <span class="has-text-weight-semibold has-text-light">{data.user?.username ?? ''}</span>
                            &nbsp;-&nbsp;
                            <a href="https://bb.ringingworld.co.uk/search.php?ringer={data.user?.username ?? ''}&bells_type=tower&automated_ringing=0&simulated_sound=0&pagesize=9999" target="_blank" class="has-text-link">Link</a>
                        </span>
                        <span class="tag is-info is-light">Username</span>
                    </div>
                </div>
                {#if data.aliases && data.aliases.length > 0}
                    {#each data.aliases as alias}
                        <div class="field">
                            <div class="label has-text-light">Alias</div>
                            <div class="control is-flex is-align-items-center is-justify-content-space-between">
                                <span>
                                    <span class="has-text-weight-semibold has-text-light">{alias.Name}</span>
                                    &nbsp;-&nbsp;
                                    <a href="https://bb.ringingworld.co.uk/search.php?ringer={alias.Name}&bells_type=tower&automated_ringing=0&simulated_sound=0&pagesize=9999" target="_blank" class="has-text-link">Link</a>
                                </span>
                                <button type="button" on:click={() => removeAlias(alias.id)} class="button is-danger is-light is-small">Remove</button>
                            </div>
                        </div>
                    {/each}
                {/if}
                <div class="field is-grouped mt-4">
                    <div class="control is-expanded">
                        <input 
                            type="text" 
                            bind:value={newAlias} 
                            placeholder="Enter name/alias" 
                            class="input is-dark"
                            on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                        />
                    </div>
                    <div class="control">
                        <button type="button" class="button is-primary" on:click={addAlias} disabled={!newAlias.trim()}>Add</button>
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
            <form class="settings-section box is-dark" method="post" action="?/updatePrivacy">
                <h2 class="title is-5 has-text-light mb-4">Privacy Settings</h2>
                <div class="field">
                    <label class="label has-text-light" for="profileVisibility">Profile Visibility</label>
                    <div class="control">
                        <div class="select is-dark is-fullwidth">
                            <select id="profileVisibility" name="profileVisibility">
                                <option value="1" selected={data.privacy?.profileVisibility}>Public</option>
                                <option value="0" selected={!data.privacy?.profileVisibility}>Private</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="field">
                    <label class="label has-text-light" for="dataVisibility">Data Visibility</label>
                    <div class="control">
                        <div class="select is-dark is-fullwidth">
                            <select id="dataVisibility" name="dataVisibility">
                                <option value="1" selected={data.privacy?.dataVisibility}>Visible</option>
                                <option value="0" selected={!data.privacy?.dataVisibility}>Hidden</option>
                            </select>
                        </div>
                    </div>
                </div>
                <button type="submit" class="button is-danger is-fullwidth mt-3">Update Privacy Settings</button>
                {#if form?.action === 'updatePrivacy' && form?.error}
                    <div class="notification is-danger mt-3">
                        <strong>Error:</strong> {form.message}
                    </div>
                {:else if form?.action === 'updatePrivacy' && form?.success}
                    <div class="notification is-success mt-3">
                        <strong>Success:</strong> {form.message}
                    </div>
                {/if}
            </form>
        {/if}

        {#if activeSection === 'password'}
            <form class="settings-section box is-dark" method="post" action="?/changePassword">
                <h2 class="title is-5 has-text-light mb-4">Change Password</h2>
                <div class="field">
                    <label class="label has-text-light" for="currentPassword">Current Password</label>
                    <input class="input is-dark" type="password" id="currentPassword" name="currentPassword" placeholder="Enter your current password" autocomplete="off" required />
                </div>
                <div class="field">
                    <label class="label has-text-light" for="newPassword">New Password</label>
                    <input class="input is-dark" type="password" id="newPassword" name="newPassword" placeholder="8 character minimum (At least one letter and one number)" autocomplete="off" required />
                </div>
                <div class="field">
                    <label class="label has-text-light" for="confirmNewPassword">Confirm New Password</label>
                    <input class="input is-dark" type="password" id="confirmNewPassword" name="confirmNewPassword" placeholder="Confirm your new password" autocomplete="off" required />
                </div>
                <button type="submit" class="button is-danger is-fullwidth mt-3">Change Password</button>
                {#if form?.action === 'changePassword' && form?.error}
                    <div class="notification is-danger mt-3">
                        <strong>Error:</strong> {form.message}
                    </div>
                {:else if form?.action === 'changePassword' && form?.success}
                    <div class="notification is-success mt-3">
                        <strong>Success:</strong> {form.message}
                    </div>
                {/if}
            </form>
        {/if}

        {#if activeSection === 'grabs'}
            <form class="settings-section box is-dark" method="post" action="?/updateGrabSettings">
                <h2 class="title is-5 has-text-light mb-4">Grab Settings</h2>
                <div class="notification is-info mb-4">
                    Configure what qualifies as a "grab" when importing BellBoard data.
                </div>
                <div class="field">
                    <label class="label has-text-light" for="bellsPercent">Percentage of Bells</label>
                    <div class="control">
                        <input class="input is-dark" type="number" id="bellsPercent" name="bellsPercent" 
                               value={data.grabSettings?.bellsPercent} 
                               min="1" max="100" required />
                    </div>
                </div>
                <div class="field">
                    <label class="checkbox has-text-light" for="excludeShortTouches">
                        <input 
                            type="checkbox" 
                            id="excludeShortTouches" 
                            name="excludeShortTouches"
                            checked={!!data.grabSettings?.exShort}
                        />
                        Exclude short touches
                    </label>
                </div>
                <button type="submit" class="button is-danger is-fullwidth mt-3">Update Grab Settings</button>
                {#if form?.action === 'updateGrabSettings' && form?.error}
                    <div class="notification is-danger mt-3">
                        <strong>Error:</strong> {form.message}
                    </div>
                {:else if form?.action === 'updateGrabSettings' && form?.success}
                    <div class="notification is-success mt-3">
                        <strong>Success:</strong> {form.message}
                    </div>
                {/if}
            </form>
        {/if}


    </div>
</main>

<Footer />
