<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
	import TowerMap from '$lib/components/TowerMap.svelte';
	export let data;

	const profile = data?.profile || {};
	const settings = data?.settings || {};
	const stats = data?.stats || null;
	const towerData = data?.towerData || null;
	const permission = data?.permission || null;

	let activeSection = 'quarters'; // 'quarters' or 'peals'
	let hoveredSlice = null;
	let showImageModal = false;
	let selectedImageFile = null;
	let imageUploadStatus = '';
	let imageUploadError = '';
	let isUploadingImage = false;

	const isOwnProfile = data.user?.username === profile.username;

	function setActiveSection(section) {
		activeSection = section;
	}

	function openImageUploadModal() {
		if (!isOwnProfile) return;
		showImageModal = true;
	}

	function closeImageUploadModal() {
		showImageModal = false;
		selectedImageFile = null;
		imageUploadStatus = '';
		imageUploadError = '';
	}

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

	// Calculate percentages for pie chart
	$: totalQP = stats?.quarterCount || 0;
	$: totalPeals = stats?.pealCount || 0;
	$: totalPerformances = stats?.performanceCount || 0;
	$: otherPerformances = totalPerformances - totalQP - totalPeals;
	
	$: qpPercent = totalPerformances > 0 ? (totalQP / totalPerformances * 100) : 0;
	$: pealPercent = totalPerformances > 0 ? (totalPeals / totalPerformances * 100) : 0;
	$: otherPercent = totalPerformances > 0 ? (otherPerformances / totalPerformances * 100) : 0;

	// Helper function to create pie slice path
	function getSlicePath(startAngle, endAngle, radius = 90) {
		const x1 = 100 + radius * Math.cos(startAngle * Math.PI / 180);
		const y1 = 100 + radius * Math.sin(startAngle * Math.PI / 180);
		const x2 = 100 + radius * Math.cos(endAngle * Math.PI / 180);
		const y2 = 100 + radius * Math.sin(endAngle * Math.PI / 180);
		const largeArc = endAngle - startAngle > 180 ? 1 : 0;
		
		return `M 100 100 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
	}

	$: qpEndAngle = qpPercent * 3.6;
	$: pealEndAngle = qpEndAngle + (pealPercent * 3.6);
</script>

<svelte:head>
	<title>{profile.username ? `${profile.username}` : 'Profile'} | towertracker</title>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
		  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
		  crossorigin=""/>
	<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" 
			integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" 
			crossorigin=""></script>
    <link rel="stylesheet" href="/assets/css/map.css">
    <link rel="stylesheet" href="/assets/css/profile.css">
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-two-thirds">
				{#if !profile}
					<div class="notification is-warning">Profile not found.</div>
				{:else}
					<div class="box">
						<div class="columns is-mobile is-vcentered profile-top">
							<div class="column is-narrow">
								{#if profile.profileImage}
									<button
										type="button"
										class="profile-avatar-button {isOwnProfile ? 'is-clickable' : ''}"
										on:click={openImageUploadModal}
										disabled={!isOwnProfile}
										title={isOwnProfile ? 'Click to change profile image' : 'View profile image'}
										aria-label="Profile image"
									>
										<img 
											src="/uploads/profiles/{profile.profileImage}" 
											alt="{profile.username}'s profile image"
											class="profile-avatar"
											loading="lazy"
										/>
									</button>
								{:else}
									<button
										type="button"
										class="profile-avatar-button {isOwnProfile ? 'is-clickable' : ''}"
										on:click={openImageUploadModal}
										disabled={!isOwnProfile}
										title={isOwnProfile ? 'Click to add profile image' : ''}
										aria-label="Profile image placeholder"
									>
										<div class="profile-avatar" role="img">
											<span class="avatar-initials">{profile.username ? profile.username.charAt(0).toUpperCase() : '?'}</span>
										</div>
									</button>
								{/if}
							</div>

							<div class="column">
								<div class="is-flex is-justify-content-space-between is-align-items-start">
									<div style="flex: 1;">
										<h1 class="title is-4 mb-1" style="margin-bottom:0.25rem; text-align:left;">{profile.username}</h1>
										{#if profile.otherNames}
											<div class="subtitle is-6" style="margin-top:0.25rem; text-align:left;">{profile.otherNames}</div>
										{/if}
										{#if profile.permission !== undefined}
											<div class="is-size-7 has-text-grey" style="text-align:left;">Permission: {profile.permission}</div>
										{/if}
									</div>
									{#if isOwnProfile}
										<a href="/account/settings?section=profile" class="button is-small">
											<span>Edit profile →</span>
										</a>
									{/if}
								</div>
							</div>
						</div>

						{#if profile.isPrivate}
							<div class="notification is-info mt-3">
								This profile is private.
							</div>
						{:else}
							<div class="content mt-3">
								{#if profile.otherNames}
									<p><strong>Other names / also goes by:</strong> {profile.otherNames}</p>
								{/if}
								<hr />
								{#if permission === 0}
									<h3 class="subtitle is-6">[DEBUG] Settings</h3>
									{#if settings}
										<ul>
											<li><strong>Profile visibility:</strong> {settings.profileVisibility ? 'Public' : 'Private'}</li>
											<li><strong>Data visibility:</strong> {settings.dataVisibility ? 'Public' : 'Restricted'}</li>
											<li><strong>Minimum bells percent for grab:</strong> {settings.bellsPercent ?? '100'}%</li>
											<li><strong>Exclude vshort imports:</strong> {settings.exShort ? 'Yes' : 'No'}</li>
										</ul>
									{:else}
										<p>No settings available.</p>
									{/if}
								{/if}
							</div>

							{#if stats}
								<hr />
								<h3 class="subtitle is-5">Statistics</h3>
								
								{#if settings.dataVisibility}
									<p class="mb-4">
										<a href="/u/{profile.username?.replace(/ /g, '-')}/performance-data" class="button is-link is-small">
											View Full Performance Data →
										</a>
									</p>
								{/if}
								
								<!-- General Stats -->
								<div class="columns is-mobile is-multiline mb-5">
									<div class="column is-half-mobile is-one-quarter-tablet">
										<div class="box has-text-centered">
											<p class="title is-2 mb-2">{totalPerformances}</p>
											<p class="is-size-7 has-text-weight-semibold">Total Performances</p>
										</div>
									</div>
									<div class="column is-half-mobile is-one-quarter-tablet">
										<div class="box has-text-centered">
											<p class="title is-2 mb-2">{totalQP}</p>
											<p class="is-size-7 has-text-weight-semibold">Quarter Peals</p>
										</div>
									</div>
									<div class="column is-half-mobile is-one-quarter-tablet">
										<div class="box has-text-centered">
											<p class="title is-2 mb-2">{stats.halfPealCount || 0}</p>
											<p class="is-size-7 has-text-weight-semibold">Half Peals</p>
										</div>
									</div>
									<div class="column is-half-mobile is-one-quarter-tablet">
										<div class="box has-text-centered">
											<p class="title is-2 mb-2">{totalPeals}</p>
											<p class="is-size-7 has-text-weight-semibold">Peals</p>
										</div>
									</div>
								</div>

								<!-- Pie Chart -->
								<div class="chart-container">
									<svg viewBox="0 0 200 200" class="pie-chart" xmlns="http://www.w3.org/2000/svg">
										{#if totalPerformances > 0}
											<!-- Quarters slice -->
											<path
												d={getSlicePath(0, qpEndAngle)}
												fill="#48c78e"
												class="pie-slice clickable"
												class:hovered={hoveredSlice === 'quarters'}
												on:click={() => setActiveSection('quarters')}
												on:mouseenter={() => hoveredSlice = 'quarters'}
												on:mouseleave={() => hoveredSlice = null}
												on:keypress={(e) => e.key === 'Enter' && setActiveSection('quarters')}
												role="button"
												tabindex="0"
												aria-label="Quarter Peals section"
											/>
											<!-- Peals slice -->
											{#if pealPercent > 0}
												<path
													d={getSlicePath(qpEndAngle, pealEndAngle)}
													fill="#3e8ed0"
													class="pie-slice clickable"
													class:hovered={hoveredSlice === 'peals'}
													on:click={() => setActiveSection('peals')}
													on:mouseenter={() => hoveredSlice = 'peals'}
													on:mouseleave={() => hoveredSlice = null}
													on:keypress={(e) => e.key === 'Enter' && setActiveSection('peals')}
													role="button"
													tabindex="0"
													aria-label="Peals section"
												/>
											{/if}
											<!-- Other slice -->
											{#if otherPercent > 0}
												<path
													d={getSlicePath(pealEndAngle, 360)}
													fill="#b5b5b5"
													class="pie-slice"
												/>
											{/if}
										{:else}
											<circle cx="100" cy="100" r="90" fill="#f5f5f5" />
											<text x="100" y="100" text-anchor="middle" dominant-baseline="middle" fill="#7a7a7a" class="is-size-6">No data</text>
										{/if}
									</svg>
									<div class="mt-4">
										<div class="is-flex is-align-items-center mb-2">
											<span class="legend-color mr-2" style="background: #48c78e;"></span>
											<span class="is-size-7">Quarter Peals ({qpPercent.toFixed(1)}%)</span>
										</div>
										<div class="is-flex is-align-items-center mb-2">
											<span class="legend-color mr-2" style="background: #3e8ed0;"></span>
											<span class="is-size-7">Peals ({pealPercent.toFixed(1)}%)</span>
										</div>
										<div class="is-flex is-align-items-center">
											<span class="legend-color mr-2" style="background: #b5b5b5;"></span>
											<span class="is-size-7">Other ({otherPercent.toFixed(1)}%)</span>
										</div>
									</div>
								</div>

								<!-- Toggle Buttons -->
								<div class="buttons has-addons is-centered mt-5">
									<button 
										class="button {activeSection === 'quarters' ? 'is-success is-selected' : ''}"
										on:click={() => setActiveSection('quarters')}
									>
										Quarter Peals
									</button>
									<button 
										class="button {activeSection === 'peals' ? 'is-info is-selected' : ''}"
										on:click={() => setActiveSection('peals')}
									>
										Peals
									</button>
								</div>

								<!-- Details Section -->
								<div id="user-details" class="box mt-4">
									{#if activeSection === 'quarters'}
										<h4 class="subtitle is-6">Quarter Peal Details</h4>
										<div class="content">
											<p><strong>Total Quarter Peals:</strong> {totalQP}</p>
											{#if stats.leadingQPRingers && stats.leadingQPRingers.length > 0}
												<p><strong>Leading Ringers:</strong></p>
												<ol>
													{#each stats.leadingQPRingers as ringer}
														<li>{ringer.RingerName} ({ringer.count} performances)</li>
													{/each}
												</ol>
											{/if}
											{#if stats.leadingQPConductors && stats.leadingQPConductors.length > 0}
												<p><strong>Leading Conductors:</strong></p>
												<ol>
													{#each stats.leadingQPConductors as conductor}
														<li>{conductor.ConductorName} ({conductor.count} performances)</li>
													{/each}
												</ol>
											{/if}
										</div>
									{:else}
										<h4 class="subtitle is-6">Peal Statistics</h4>
										<div class="content">
											<p><strong>Total Peals:</strong> {totalPeals}</p>
											{#if stats.leadingPealRingers && stats.leadingPealRingers.length > 0}
												<p><strong>Leading Ringers:</strong></p>
												<ol>
													{#each stats.leadingPealRingers as ringer}
														<li>{ringer.RingerName} ({ringer.count} performances)</li>
													{/each}
												</ol>
											{/if}
											{#if stats.leadingPealConductors && stats.leadingPealConductors.length > 0}
												<p><strong>Leading Conductors:</strong></p>
												<ol>
													{#each stats.leadingPealConductors as conductor}
														<li>{conductor.ConductorName} ({conductor.count} performances)</li>
													{/each}
												</ol>
											{/if}
										</div>
									{/if}
								</div>
								
								<!-- Tower Map -->
								{#if towerData && (towerData.grabbed?.length > 0 || towerData.quartered?.length > 0 || towerData.pealed?.length > 0)}
									<div id="tower-map" class="box mt-4">
										<h4 class="subtitle is-6">Tower Map</h4>
										<TowerMap 
											towers={[
												...towerData.grabbed.map(t => ({ ...t, grabbed: true, quartered: false, pealed: false })),
												...towerData.quartered.map(t => ({ ...t, grabbed: false, quartered: true, pealed: false })),
												...towerData.pealed.map(t => ({ ...t, grabbed: false, quartered: false, pealed: true }))
											]}
											bellsFilter={3}
											isMinimumBells={true}
											showUnringable={true}
											practiceNightFilter=""
											displayLimit={1000}
											includeGrabbed={false}
											excludeGrabbed={false}
											includeQuartered={false}
											excludeQuartered={false}
											includePealed={false}
											excludePealed={false}
											showLocationTracking={false}
											showClosestTower={false}
											showTowerCount={true}
											autoFitBounds={true}
											mapHeight="400px"
										/>
									</div>
								{/if}
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<!-- Image Upload Modal -->
<div class="modal" class:is-active={showImageModal}>
	<button 
		class="modal-background" 
		on:click={closeImageUploadModal}
		type="button"
		aria-label="Close modal"
	></button>
	<div class="modal-card">
		<header class="modal-card-head">
			<p class="modal-card-title">Upload Profile Image</p>
			<button class="delete" aria-label="close" on:click={closeImageUploadModal}></button>
		</header>
		<section class="modal-card-body">
			<div class="field mb-4">
				<p class="help mb-3">Max 5MB, JPEG/PNG/WebP/GIF</p>
				<div class="file is-fullwidth">
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
							<span class="file-label">Choose a file…</span>
						</span>
						<span class="file-name">
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
		</section>
		<footer class="modal-card-foot is-flex is-flex-wrap-wrap is-gap-2">
			<button 
				type="button" 
				class="button is-success {isUploadingImage ? 'is-loading' : ''}"
				on:click={uploadProfileImage}
				disabled={!selectedImageFile || isUploadingImage}
			>
				Upload Image
			</button>
			{#if profile.profileImage}
				<button 
					type="button" 
					class="button is-danger {isUploadingImage ? 'is-loading' : ''}"
					on:click={deleteProfileImage}
					disabled={isUploadingImage}
				>
					Delete Current Image
				</button>
			{/if}
			<button type="button" class="button" on:click={closeImageUploadModal}>Cancel</button>
		</footer>
	</div>
</div>

<Footer />