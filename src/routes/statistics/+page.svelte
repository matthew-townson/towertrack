<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	
	export let data;
	
	const stats = data?.stats || null;
	const quarterPealStats = data?.quarterPealStats || null;
	const pealStats = data?.pealStats || null;
	const otherStats = data?.otherStats || null;
	const grabStats = data?.grabStats || null;
	
	let activeSection = 'quarters'; // 'quarters', 'peals', 'other', or 'grabs'
	let hoveredSlice = null;
	
	function setActiveSection(section) {
		activeSection = section;
	}
	
	// Calculate percentages for pie chart
	$: totalQP = quarterPealStats?.count || 0;
	$: totalPeals = pealStats?.count || 0;
	$: totalOther = otherStats?.count || 0;
	$: totalPerformances = totalQP + totalPeals + totalOther;
	
	$: qpPercent = totalPerformances > 0 ? (totalQP / totalPerformances * 100) : 0;
	$: pealPercent = totalPerformances > 0 ? (totalPeals / totalPerformances * 100) : 0;
	$: otherPercent = totalPerformances > 0 ? (totalOther / totalPerformances * 100) : 0;
	
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
	
	// Format date
	function formatDate(dateStr) {
		if (!dateStr) return 'Unknown date';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
	
	// Format weight in hundredweight format (cwt-qtr-lb)
	function formatWeight(weight) {
		if (!weight) return 'Unknown';
		// Weight is already in the format "X-Y-Z" from the database
		return `${weight}`;
	}
</script>

<svelte:head>
	<title>My Statistics | towertracker</title>
	<link rel="stylesheet" href="/assets/css/statistics.css">
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-two-thirds">
				<h1 class="title">My Statistics</h1>
				
				{#if data.error}
					<div class="notification is-danger">
						<p>{data.error}</p>
					</div>
				{:else if stats}
					<div class="box">
						<!-- Pie Chart -->
						{#if totalPerformances > 0}
							<div class="chart-container">
								<svg viewBox="0 0 200 200" class="pie-chart" aria-label="Performance distribution chart">
									<!-- Quarter Peals slice -->
									{#if qpPercent > 0}
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
											aria-label="Quarter peals section"
										/>
									{/if}
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
											fill="#f59e0b"
											class="pie-slice clickable"
											class:hovered={hoveredSlice === 'other'}
											on:click={() => setActiveSection('other')}
											on:mouseenter={() => hoveredSlice = 'other'}
											on:mouseleave={() => hoveredSlice = null}
											on:keypress={(e) => e.key === 'Enter' && setActiveSection('other')}
											role="button"
											tabindex="0"
											aria-label="Other performances section"
										/>
									{/if}
								</svg>
								<div class="mt-4 legend-container">
									<div class="is-flex is-align-items-center mb-2">
										<span class="legend-color mr-2" style="background: #48c78e;"></span>
										<span class="is-size-7 legend-text">Quarter Peals ({qpPercent.toFixed(1)}%)</span>
									</div>
									<div class="is-flex is-align-items-center mb-2">
										<span class="legend-color mr-2" style="background: #3e8ed0;"></span>
										<span class="is-size-7 legend-text">Peals ({pealPercent.toFixed(1)}%)</span>
									</div>
									<div class="is-flex is-align-items-center">
										<span class="legend-color mr-2" style="background: #f59e0b;"></span>
										<span class="is-size-7 legend-text">Other ({otherPercent.toFixed(1)}%)</span>
									</div>
								</div>
							</div>
						{:else}
							<div class="has-text-centered py-5">
								<p class="has-text-grey">No performance data available.</p>
							</div>
						{/if}
						
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
							<button 
								class="button {activeSection === 'other' ? 'is-warning is-selected' : ''}"
								on:click={() => setActiveSection('other')}
							>
								Other
							</button>
							<button 
								class="button {activeSection === 'grabs' ? 'is-link is-selected' : ''}"
								on:click={() => setActiveSection('grabs')}
							>
								Grabs
							</button>
						</div>
						
						<!-- Details Section -->
						<div class="mt-4">
							{#if activeSection === 'quarters'}
								<h4 class="subtitle is-5">Quarter Peal Highlights</h4>
								{#if quarterPealStats && quarterPealStats.count > 0}
									<div class="content">
										<p><strong>Total:</strong> {quarterPealStats.count}</p>
										
										<ul class="statistics-list">
											{#if quarterPealStats.heaviestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Heaviest Bell:</span>
														<span class="stat-value">
															{formatWeight(quarterPealStats.heaviestBell.weight)} ({quarterPealStats.heaviestBell.weightPounds} lbs)
															<br>
															<a href="/bellboard/performance?id={quarterPealStats.heaviestBell.performanceId}" class="is-size-7">
																{quarterPealStats.heaviestBell.place} • {formatDate(quarterPealStats.heaviestBell.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if quarterPealStats.lightestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Lightest Bell:</span>
														<span class="stat-value">
															{formatWeight(quarterPealStats.lightestBell.weight)} ({quarterPealStats.lightestBell.weightPounds} lbs)
															<br>
															<a href="/bellboard/performance?id={quarterPealStats.lightestBell.performanceId}" class="is-size-7">
																{quarterPealStats.lightestBell.place} • {formatDate(quarterPealStats.lightestBell.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if quarterPealStats.longestDuration}
												<li>
													<div class="stat-row">
														<span class="stat-label">Longest Duration:</span>
														<span class="stat-value">
															{quarterPealStats.longestDuration.duration} ({quarterPealStats.longestDuration.durationMinutes} mins)
															<br>
															<a href="/bellboard/performance?id={quarterPealStats.longestDuration.performanceId}" class="is-size-7">
																{quarterPealStats.longestDuration.place} • {formatDate(quarterPealStats.longestDuration.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if quarterPealStats.shortestDuration}
												<li>
													<div class="stat-row">
														<span class="stat-label">Shortest Duration:</span>
														<span class="stat-value">
															{quarterPealStats.shortestDuration.duration} ({quarterPealStats.shortestDuration.durationMinutes} mins)
															<br>
															<a href="/bellboard/performance?id={quarterPealStats.shortestDuration.performanceId}" class="is-size-7">
																{quarterPealStats.shortestDuration.place} • {formatDate(quarterPealStats.shortestDuration.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if quarterPealStats.mostChanges}
												<li>
													<div class="stat-row">
														<span class="stat-label">Most Changes:</span>
														<span class="stat-value">
															{quarterPealStats.mostChanges.changes}
															<br>
															<a href="/bellboard/performance?id={quarterPealStats.mostChanges.performanceId}" class="is-size-7">
																{quarterPealStats.mostChanges.place} • {formatDate(quarterPealStats.mostChanges.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
										</ul>
									</div>
								{:else}
									<p class="has-text-grey">No quarter peals found.</p>
								{/if}
								
							{:else if activeSection === 'peals'}
								<h4 class="subtitle is-5">Peal Highlights</h4>
								{#if pealStats && pealStats.count > 0}
									<div class="content">
										<p><strong>Total:</strong> {pealStats.count}</p>
										
										<ul class="statistics-list">
											{#if pealStats.heaviestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Heaviest Bell:</span>
														<span class="stat-value">
															{formatWeight(pealStats.heaviestBell.weight)} ({pealStats.heaviestBell.weightPounds} lbs)
															<br>
															<a href="/bellboard/performance?id={pealStats.heaviestBell.performanceId}" class="is-size-7">
																{pealStats.heaviestBell.place} • {formatDate(pealStats.heaviestBell.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if pealStats.lightestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Lightest Bell:</span>
														<span class="stat-value">
															{formatWeight(pealStats.lightestBell.weight)} ({pealStats.lightestBell.weightPounds} lbs)
															<br>
															<a href="/bellboard/performance?id={pealStats.lightestBell.performanceId}" class="is-size-7">
																{pealStats.lightestBell.place} • {formatDate(pealStats.lightestBell.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if pealStats.longestDuration}
												<li>
													<div class="stat-row">
														<span class="stat-label">Longest Duration:</span>
														<span class="stat-value">
															{pealStats.longestDuration.duration} ({pealStats.longestDuration.durationMinutes} mins)
															<br>
															<a href="/bellboard/performance?id={pealStats.longestDuration.performanceId}" class="is-size-7">
																{pealStats.longestDuration.place} • {formatDate(pealStats.longestDuration.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if pealStats.shortestDuration}
												<li>
													<div class="stat-row">
														<span class="stat-label">Shortest Duration:</span>
														<span class="stat-value">
															{pealStats.shortestDuration.duration} ({pealStats.shortestDuration.durationMinutes} mins)
															<br>
															<a href="/bellboard/performance?id={pealStats.shortestDuration.performanceId}" class="is-size-7">
																{pealStats.shortestDuration.place} • {formatDate(pealStats.shortestDuration.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if pealStats.mostChanges}
												<li>
													<div class="stat-row">
														<span class="stat-label">Most Changes:</span>
														<span class="stat-value">
															{pealStats.mostChanges.changes}
															<br>
															<a href="/bellboard/performance?id={pealStats.mostChanges.performanceId}" class="is-size-7">
																{pealStats.mostChanges.place} • {formatDate(pealStats.mostChanges.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
										</ul>
									</div>
								{:else}
									<p class="has-text-grey">No peals found.</p>
								{/if}
								
							{:else if activeSection === 'other'}
								<h4 class="subtitle is-5">Other Performance Highlights</h4>
								{#if otherStats && otherStats.count > 0}
									<div class="content">
										<p><strong>Total:</strong> {otherStats.count}</p>
										
										<ul class="statistics-list">
											{#if otherStats.heaviestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Heaviest Bell:</span>
														<span class="stat-value">
															{formatWeight(otherStats.heaviestBell.weight)} ({otherStats.heaviestBell.weightPounds} lbs)
															<br>
															<a href="/bellboard/performance?id={otherStats.heaviestBell.performanceId}" class="is-size-7">
																{otherStats.heaviestBell.place} • {formatDate(otherStats.heaviestBell.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if otherStats.lightestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Lightest Bell:</span>
														<span class="stat-value">
															{formatWeight(otherStats.lightestBell.weight)} ({otherStats.lightestBell.weightPounds} lbs)
															<br>
															<a href="/bellboard/performance?id={otherStats.lightestBell.performanceId}" class="is-size-7">
																{otherStats.lightestBell.place} • {formatDate(otherStats.lightestBell.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if otherStats.longestDuration}
												<li>
													<div class="stat-row">
														<span class="stat-label">Longest Duration:</span>
														<span class="stat-value">
															{otherStats.longestDuration.duration} ({otherStats.longestDuration.durationMinutes} mins)
															<br>
															<a href="/bellboard/performance?id={otherStats.longestDuration.performanceId}" class="is-size-7">
																{otherStats.longestDuration.place} • {formatDate(otherStats.longestDuration.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if otherStats.shortestDuration}
												<li>
													<div class="stat-row">
														<span class="stat-label">Shortest Duration:</span>
														<span class="stat-value">
															{otherStats.shortestDuration.duration} ({otherStats.shortestDuration.durationMinutes} mins)
															<br>
															<a href="/bellboard/performance?id={otherStats.shortestDuration.performanceId}" class="is-size-7">
																{otherStats.shortestDuration.place} • {formatDate(otherStats.shortestDuration.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if otherStats.mostChanges}
												<li>
													<div class="stat-row">
														<span class="stat-label">Most Changes:</span>
														<span class="stat-value">
															{otherStats.mostChanges.changes}
															<br>
															<a href="/bellboard/performance?id={otherStats.mostChanges.performanceId}" class="is-size-7">
																{otherStats.mostChanges.place} • {formatDate(otherStats.mostChanges.date)}
															</a>
														</span>
													</div>
												</li>
											{/if}
										</ul>
									</div>
								{:else}
									<p class="has-text-grey">No other performances found.</p>
								{/if}
							
							{:else if activeSection === 'grabs'}
								<h4 class="subtitle is-5">Grab Highlights</h4>
								{#if grabStats && grabStats.count > 0}
									<div class="content">
										<p><strong>Total:</strong> {grabStats.count}</p>
										
										<ul class="statistics-list">
											{#if grabStats.heaviestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Heaviest Bell:</span>
														<span class="stat-value">
															{formatWeight(grabStats.heaviestBell.weight)} ({grabStats.heaviestBell.weightPounds} lbs)
															<br>
															<a href="/tower/{grabStats.heaviestBell.towerId}" class="is-size-7">
																{grabStats.heaviestBell.place}
															</a>
														</span>
													</div>
												</li>
											{/if}
											
											{#if grabStats.lightestBell}
												<li>
													<div class="stat-row">
														<span class="stat-label">Lightest Bell:</span>
														<span class="stat-value">
															{formatWeight(grabStats.lightestBell.weight)} ({grabStats.lightestBell.weightPounds} lbs)
															<br>
															<a href="/tower/{grabStats.lightestBell.towerId}" class="is-size-7">
																{grabStats.lightestBell.place}
															</a>
														</span>
													</div>
												</li>
											{/if}
										</ul>
									</div>
								{:else}
									<p class="has-text-grey">No grabs found.</p>
								{/if}
							{/if}
						</div>
					</div>
				{:else}
					<div class="notification is-info">
						<p>No statistics available.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<Footer />