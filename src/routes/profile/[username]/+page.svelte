<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
	export let data;

	const profile = data?.profile || {};
	const settings = data?.settings || {};
	const stats = data?.stats || null;

	let activeSection = 'quarters'; // 'quarters' or 'peals'
	let hoveredSlice = null;

	function setActiveSection(section) {
		activeSection = section;
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
								{#if profile.otherNames}
									<p><strong>Other names / also goes by:</strong> {profile.otherNames}</p>
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
									<p>No settings available.</p>
								{/if}
							</div>

							{#if stats}
								<hr />
								<h3 class="subtitle is-5">Statistics</h3>
								
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
								<div class="box mt-4">
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
												<p><strong>Leading Co-Ringers:</strong></p>
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
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<Footer />

<style>
/* Profile avatar styles */
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

/* Chart styles */
.chart-container {
	max-width: 250px;
	margin: 1.5rem auto;
}

.pie-chart {
	width: 100%;
	height: auto;
	display: block;
}

.pie-slice.clickable {
	cursor: pointer;
	transition: transform 0.2s, opacity 0.2s;
	transform-origin: center;
}

.pie-slice.clickable:hover,
.pie-slice.clickable.hovered {
	opacity: 0.85;
	transform: scale(1.05);
}

.pie-slice.clickable:focus {
	outline: 3px solid #4a4a4a;
	outline-offset: 3px;
}

.legend-color {
	width: 20px;
	height: 20px;
	border-radius: 4px;
	flex-shrink: 0;
}

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