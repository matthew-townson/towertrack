<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
	export let data;

	const profile = data?.profile || {};
	const settings = data?.settings || {};
</script>

<svelte:head>
	<title>{profile.username ? `${profile.username} — Profile` : 'Profile'} | towertracker</title>
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
								<div class="profile-avatar" role="img" aria-label="Profile image placeholder">
									<span class="avatar-initials">{profile.username ? profile.username.charAt(0).toUpperCase() : '?'}</span>
								</div>
							</div>

							<div class="column">
								<h1 class="title is-4 mb-1" style="margin-bottom:0.25rem; text-align:left;">{profile.username}</h1>
								{#if profile.otherNames}
									<div class="subtitle is-6" style="margin-top:0.25rem; text-align:left;">{profile.otherNames}</div>
								{/if}
								{#if profile.permission !== undefined}
									<div class="is-size-7 has-text-grey" style="text-align:left;">Permission: {profile.permission}</div>
								{/if}
							</div>
						</div>

						{#if profile.isPrivate}
							<div class="notification is-info mt-3">
								This profile is private.
							</div>
						{:else}
							<div class="content mt-3">
								<p><strong>Username:</strong> {profile.username}</p>
								{#if profile.otherNames}
									<p><strong>Other names / aliases:</strong> {profile.otherNames}</p>
								{/if}
								<hr />
								<h3 class="subtitle is-6">Visible Settings</h3>
								{#if settings}
									<ul>
										<li><strong>Profile visibility:</strong> {settings.profileVisibility ? 'Public' : 'Private'}</li>
										<li><strong>Data visibility:</strong> {settings.dataVisibility ? 'Public' : 'Restricted'}</li>
										<li><strong>Minimum bells percent for imports:</strong> {settings.bellsPercent ?? '100'}%</li>
										<li><strong>Include vshort imports (exShort):</strong> {settings.exShort ? 'Yes' : 'No'}</li>
									</ul>
								{:else}
									<p class="has-text-grey">No settings available.</p>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<Footer />

<style>
/* New profile-top avatar styles */
.profile-avatar {
	width: 96px;
	height: 96px;
	border-radius: 50%;
	background: linear-gradient(135deg,#8ee3ef 0%,#6ac6c6 100%);
	display:flex;
	justify-content:center;
	align-items:center;
	color:#073642;
	font-weight:700;
	font-size:32px;
	box-shadow: 0 2px 6px rgba(0,0,0,0.12);
	flex-shrink:0;
}

.avatar-initials { line-height:1; }

@media (max-width: 768px) {
	.profile-avatar {
		width:72px;
		height:72px;
		font-size:24px;
	}
	.profile-top .column {
		padding-left: 0.5rem;
	}
}
</style>