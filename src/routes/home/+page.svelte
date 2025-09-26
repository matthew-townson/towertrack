	<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let data;
</script>

<svelte:head>
	<title>Home | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main>
	<div class="dashboard-container">
		<div class="dashboard-section">
			<h2>Beta feedback</h2>
			<p class="section-description">Welcome to the beta! Please report any issues or feedback.</p>

			<div class="feature-links">
				<a href="{data.whatsappLink}" class="feature-card" target="_blank" rel="noopener noreferrer">
					<span class="feature-icon">🗣️</span>
					<div class="feature-text">
						<h3>Join the WhatsApp Community</h3>
						<p>Found a bug or want to suggest new features or improvements?
							<br>Let me know!
						</p>
					</div>
				</a>

				<a href="/updates" class="feature-card">
					<span class="feature-icon">🛜</span>
					<div class="feature-text">
						<h3>See Latest Updates</h3>
						<p>Find out about the latest features and improvements here</p>
					</div>
				</a>

				<a href="/roadmap" class="feature-card">
					<span class="feature-icon">🗺️</span>
					<div class="feature-text">
						<h3>View the Roadmap</h3>
						<p>See what's planned for towertracker and upcoming features</p>
					</div>
				</a>
			</div>
		</div>

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
	        
	        <div class="feature-links">
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
		    </div>
	    </div>
	    
	    <div class="dashboard-section">
	        <h2>BellBoard data</h2>
            <p class="section-description">Connect with BellBoard to import your performances.</p>
	        
	        <div class="feature-links">
		        <a href="/bellboard/summary" class="feature-card">
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
	</div>
</main>

<Footer />
