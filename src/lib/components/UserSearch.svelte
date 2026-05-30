<script>
	export let onUserSelect = null;
	export let showAddButton = false;
	export let maxHeight = '400px';
	export let placeholder = 'Search by username...';
	export let excludeUserIds = [];

	let searchQuery = '';
	let searchResults = [];
	let searching = false;

	$: filteredResults = excludeUserIds.length > 0 
		? searchResults.filter(u => !excludeUserIds.includes(u.id))
		: searchResults;

	async function searchUsers(query) {
		if (!query || query.trim().length === 0) {
			searchResults = [];
			return;
		}

		searching = true;
		try {
			const response = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`);
			if (response.ok) {
				searchResults = await response.json();
			}
		} catch (error) {
			console.error('Search error:', error);
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	function handleUserClick(user) {
		if (onUserSelect) {
			onUserSelect(user);
			searchQuery = '';
			searchResults = [];
		}
	}
</script>

<div class="user-search-container">
	<div class="field">
		<div class="control has-icons-right">
			<input 
				class="input" 
				type="text" 
				placeholder={placeholder}
				bind:value={searchQuery}
				on:input={(e) => searchUsers(e.target.value)}
			/>
			{#if searching}
				<span class="icon is-right has-text-info">
					<i class="fas fa-spinner fa-spin"></i>
				</span>
			{/if}
		</div>
	</div>

		{#if filteredResults.length > 0}
			<div class="user-results" style="max-height: {maxHeight}; overflow-y: auto;">
				{#each filteredResults as user (user.id)}
					<div class="user-result-row">
						<div class="user-avatar-container">
							{#if user.profileImage}
								<img 
									src="/uploads/profiles/{user.profileImage}" 
									alt="{user.username}"
									style="width: 100%; height: 100%; object-fit: cover; object-position: center; display: block;"
								/>
							{:else}
								<div 
									style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #a1e9f5 0%, #6ac6c6 100%); color: #073642; font-weight: bold;"
								>
									{user.username.charAt(0).toUpperCase()}
								</div>
							{/if}
						</div>
						<div class="user-result-info">
							<a href="/u/{user.username.replace(/ /g, '-')}" class="has-text-link">
								<strong>{user.username}</strong>
							</a>
						</div>
						{#if showAddButton}
							<slot {user}>
								<button 
									class="button is-success is-small"
									on:click={() => handleUserClick(user)}
								>
									Select
								</button>
							</slot>
						{/if}
					</div>
				{/each}
			</div>
		{:else if searchQuery && !searching}
			<p class="help has-text-grey has-text-centered py-3">No users found matching "{searchQuery}".</p>
		{:else if searching}
			<p class="help has-text-grey has-text-centered py-3">Searching...</p>
		{/if}
</div>

<style>
	.user-search-container {
		width: 100%;
	}

	.user-results {
		border: 1px solid #ddd;
		border-radius: 4px;
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
	}

	@media (prefers-color-scheme: dark) {
		.user-results {
			border-color: #3b3f45;
		}
	}

	@media (prefers-color-scheme: light) {
		.user-results {
			border-color: #ddd;
		}
	}

	.user-result-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-bottom: 1px solid #eee;
		transition: background-color 0.2s;
	}

	.user-result-row:last-child {
		border-bottom: none;
	}

	.user-result-row:hover {
		background-color: rgba(195, 60, 84, 0.05);
	}

	@media (prefers-color-scheme: dark) {
		.user-result-row {
			border-bottom-color: #3b3f45;
		}

		.user-result-row:hover {
			background-color: rgba(142, 227, 239, 0.05);
		}
	}

	.user-avatar-container {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		overflow: hidden;
	}

	.user-result-info {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
