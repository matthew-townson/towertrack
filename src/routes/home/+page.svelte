	<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { convertToHundredweight } from '$lib/mapUtils.js';
	export let data;

	function formatDate(date) {
		return date ? new Date(date).toLocaleDateString('en-GB') : 'N/A';
	}

	function getBellLabel(ringers, ringer, index) {
		if (ringer?.bell) return ringer.bell;
		return ringers.length ? index + 1 : '';
	}
</script>

<svelte:head>
	<title>Home | towertracker</title>
	<link rel="stylesheet" href="/assets/css/home.css">
	<link rel="stylesheet" href="/assets/css/bellboard-summary.css">
</svelte:head>

<Header user={data.user} />

<main class="home-main">
	<div class="dashboard-container">
		<div class="dashboard-left">
		<div class="dashboard-section">
			<h1>Welcome back {data.user.username}!</h1>
			<h2>Tower grabbing</h2>
            <p class="section-description">Track the towers you've rung at and the bells you've grabbed.</p>
	        
	        <div class="stat-summary">
	            <div class="stat-card">
	                <div class="stat-number">{data.grabCount}</div>
	                <div class="stat-label">Total Grabs</div>
	            </div>
	        </div>
	        
	        <div class="feature-links site-navigation">
		        <a href="/grab/add" class="feature-card">
		            <span class="feature-icon">+</span>
		            <div class="feature-text">
		                <h3>Add a New Grab</h3>
		                <p>Record a new tower you've rung at</p>
		            </div>
		        </a>
		        
		        <a href="/grab" class="feature-card">
		            <span class="feature-icon">📋</span>
		            <div class="feature-text">
		                <h3>See All Grabs</h3>
		                <p>View and manage your tower grab collection</p>
		            </div>
		        </a>
		        
		        <a href="/map?grabbed=true&quartered=true&pealed=true" class="feature-card">
		            <span class="feature-icon">🗺️</span>
		            <div class="feature-text">
		                <h3>View on Map</h3>
		                <p>See your grabbed towers on an interactive map</p>
		            </div>
		        </a>
		        <a href="/statistics" class="feature-card">
		            <span class="feature-icon">📈</span>
		            <div class="feature-text"><h3>Statistics</h3><p>Explore your ringing and grabbing records</p></div>
		        </a>
		        <a href="/calendar" class="feature-card">
		            <span class="feature-icon">📅</span>
		            <div class="feature-text"><h3>Calendar</h3><p>View and organise your ringing events</p></div>
		        </a>
		        <a href="/lists" class="feature-card">
		            <span class="feature-icon">📝</span>
		            <div class="feature-text"><h3>Lists</h3><p>Browse and manage tower lists</p></div>
		        </a>
		    </div>
	    </div>
	    
	    <div class="dashboard-section">
	        <h2>BellBoard data</h2>
            <p class="section-description">Connect with BellBoard to import your performances.</p>
	        
	        <div class="feature-links">
		        <a href="/u/{data.user?.username?.replace(/ /g, '-')}/performance-data" class="feature-card">
		            <span class="feature-icon">📊</span>
		            <div class="feature-text">
		                <h3>BellBoard Summary</h3>
		                <p>View a summary of your performances</p>
		            </div>
		        </a>
		        
		        <a href="/account/settings?/updateAlias" class="feature-card">
		            <span class="feature-icon">🔄</span>
		            <div class="feature-text">
		                <h3>Import from BellBoard</h3>
		                <p>Set up automatic imports from BellBoard</p>
		            </div>
		        </a>
		    </div>
		</div>

		<div class="dashboard-section">
			<h2>Beta feedback</h2>
			<p class="section-description">Welcome to the beta! Please report any issues or feedback.</p>
			<div class="feature-links">
				<a href="{data.whatsappLink}" class="feature-card" target="_blank" rel="noopener noreferrer"><span class="feature-icon">🗣️</span><div class="feature-text"><h3>Join the WhatsApp Community</h3><p>Report bugs and suggest improvements</p></div></a>
				<a href="/updates" class="feature-card"><span class="feature-icon">🛜</span><div class="feature-text"><h3>Latest Updates</h3><p>See the latest features and improvements</p></div></a>
				<a href="/roadmap" class="feature-card"><span class="feature-icon">🗺️</span><div class="feature-text"><h3>Roadmap</h3><p>See what is planned next</p></div></a>
			</div>
		</div>
		</div>

		<aside class="recent-performances-panel">
			<div class="recent-performances-header">
				<h2>Recent performances by towertracker users</h2>
			</div>
			<div class="recent-performances-list">
				{#if data.recentPerformances?.length}
					{#each data.recentPerformances as perf}
						<div class="performance-card">
							<div class="performance-content">
								<div class="performance-main">
									<p class="performance-title">{perf.Changes || 'N/A'} {perf.Method || ''}</p>
									<p class="performance-date">{formatDate(perf.Date)}{perf.Duration ? ` in ${perf.Duration}` : ''}</p>
									<div class="performance-details">
										<p>{perf.Association || ''}</p>
										<p>{perf.Place || ''}{perf.Dedication ? `, ${perf.Dedication}` : ''}{perf.County ? `, ${perf.County}` : ''}{perf.TenorWeightLbs ? ` (${convertToHundredweight(perf.TenorWeightLbs)}${perf.TenorKey ? ` in ${perf.TenorKey}` : ''})` : ''}</p>
										{#if perf.ringers.length}
											<div class="footnotes-list">{#each perf.ringers as ringer, index}<div class="footnote-item"><strong class="bell-number">{getBellLabel(perf.ringers, ringer, index)}.</strong> {ringer.name}{ringer.conductor ? ' (C)' : ''}</div>{/each}</div>
										{/if}
										{#each perf.footnotes as footnote}<div class="footnote-item">{footnote}</div>{/each}
									</div>
								</div>
								<a class="performance-link" href="/bellboard/performance?id={perf.PerformanceID}">View Details</a>
							</div>
						</div>
					{/each}
				{:else}
					<p class="no-recent-performances">No performances found.</p>
				{/if}
			</div>
		</aside>
	</div>
</main>

<Footer />
