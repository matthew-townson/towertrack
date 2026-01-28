<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	export let data;

	let newListName = '';
	let newListDescription = '';
	let creatingList = false;
	let lists = data.lists || [];
	let listError = '';
	let listSuccess = '';
	let expandedListId = null;
	let listMembers = {};
	let loadingMembers = {};
	let selectedListForSearch = null;
	let searchQuery = '';
	let searchResults = [];
	let searching = false;
	let addingUserToList = null;

	async function createList() {
		if (!newListName.trim()) {
			listError = 'List name is required';
			return;
		}

		creatingList = true;
		listError = '';
		listSuccess = '';

		try {
			const response = await fetch('/api/user-lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newListName.trim(),
					description: newListDescription.trim() || null
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create list');
			}

			const result = await response.json();
			lists = [...lists, { ...result, memberCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
			newListName = '';
			newListDescription = '';
			listSuccess = 'List created successfully!';
			setTimeout(() => { listSuccess = ''; }, 3000);
		} catch (error) {
			listError = error.message || 'Failed to create list';
		} finally {
			creatingList = false;
		}
	}

	async function toggleListDetails(listId) {
		if (expandedListId === listId) {
			expandedListId = null;
			return;
		}

		expandedListId = listId;
		if (listMembers[listId]) return;

		loadingMembers[listId] = true;

		try {
			const response = await fetch(`/api/user-lists/${listId}`);
			if (!response.ok) throw new Error('Failed to load members');

			const result = await response.json();
			listMembers[listId] = result.members || [];
		} catch (error) {
			listError = error.message || 'Failed to load list members';
		} finally {
			loadingMembers[listId] = false;
		}
	}

	async function removeMember(listId, memberId) {
		if (!confirm('Remove this user from the list?')) return;

		try {
			const response = await fetch(`/api/user-lists/${listId}/members/${memberId}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to remove member');

			listMembers[listId] = listMembers[listId].filter(m => m.id !== memberId);
			
			// Update member count
			const list = lists.find(l => l.id === listId);
			if (list) list.memberCount--;
			lists = lists;

			listSuccess = 'Member removed from list!';
			setTimeout(() => { listSuccess = ''; }, 3000);
		} catch (error) {
			listError = error.message || 'Failed to remove member';
		}
	}

	async function deleteList(listId) {
		if (!confirm('Are you sure you want to delete this list?')) return;

		try {
			const response = await fetch(`/api/user-lists/${listId}`, { method: 'DELETE' });
			
			if (!response.ok) throw new Error('Failed to delete list');
			
			lists = lists.filter(l => l.id !== listId);
			if (expandedListId === listId) expandedListId = null;
			delete listMembers[listId];

			listSuccess = 'List deleted successfully!';
			setTimeout(() => { listSuccess = ''; }, 3000);
		} catch (error) {
			listError = error.message || 'Failed to delete list';
		}
	}

	async function searchUsers(query) {
		if (!query || query.trim().length < 2) {
			searchResults = [];
			return;
		}

		searching = true;
		try {
			const response = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`);
			if (response.ok) {
				const results = await response.json();
				// Filter out users already in the selected list
				if (selectedListForSearch && listMembers[selectedListForSearch]) {
					const memberIds = listMembers[selectedListForSearch].map(m => m.id);
					searchResults = results.filter(u => !memberIds.includes(u.id));
				} else {
					searchResults = results;
				}
			}
		} catch (error) {
			console.error('Search error:', error);
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	async function addUserToList(listId, userId, username) {
		addingUserToList = userId;
		try {
			const response = await fetch(`/api/user-lists/${listId}/members/${userId}`, {
				method: 'POST'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to add user');
			}

			// Reload members for this list
			if (listMembers[listId]) {
				const userToAdd = searchResults.find(u => u.id === userId);
				if (userToAdd) {
					listMembers[listId] = [...listMembers[listId], userToAdd];
				}
			}

			// Update member count
			const list = lists.find(l => l.id === listId);
			if (list) list.memberCount++;
			lists = lists;

			// Remove from search results
			searchResults = searchResults.filter(u => u.id !== userId);
			
			listSuccess = `${username} added to list!`;
			setTimeout(() => { listSuccess = ''; }, 3000);
		} catch (error) {
			listError = error.message || 'Failed to add user to list';
		} finally {
			addingUserToList = null;
		}
	}

</script>

<svelte:head>
	<title>User Lists | towertracker</title>
	<meta name="description" content="Manage your user lists" />
	<style>
		main.lists-page {
			min-height: calc(100vh - 200px);
			padding: 2rem 0;
		}

		.list-members {
			display: flex;
			flex-direction: column;
			max-height: 400px;
			overflow-y: auto;
			border: 1px solid #ddd;
			border-radius: 4px;
		}

		@media (prefers-color-scheme: dark) {
			.list-members {
				border-color: #3b3f45;
			}
		}

		@media (prefers-color-scheme: light) {
			.list-members {
				border-color: #ddd;
			}
		}

		.list-row {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.75rem;
			border-bottom: 1px solid #eee;
			transition: background-color 0.2s;
		}

		.list-row:last-child {
			border-bottom: none;
		}

		.list-row:hover {
			background-color: rgba(195, 60, 84, 0.05);
		}

		@media (prefers-color-scheme: dark) {
			.list-row {
				border-bottom-color: #3b3f45;
			}

			.list-row:hover {
				background-color: rgba(142, 227, 239, 0.05);
			}
		}

		.list-row-avatar {
			flex-shrink: 0;
			width: 40px;
			height: 40px;
			border-radius: 50%;
			object-fit: cover;
		}

		.list-row-avatar-placeholder {
			flex-shrink: 0;
			width: 40px;
			height: 40px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-weight: 700;
			font-size: 0.875rem;
		}

		.list-row-name {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.list-row-action {
			flex-shrink: 0;
		}

		.member-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
			gap: 1rem;
			margin-top: 1rem;
		}

		@media (max-width: 768px) {
			.member-grid {
				grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
			}
		}
	</style>
</svelte:head>

<Header user={data.user} />

<main class="section lists-page">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-full-mobile is-four-fifths-tablet is-three-quarters-widescreen">
				<!-- Header -->
				<div class="mb-6">
					<h1 class="title is-2 mb-2">Your Lists</h1>
					<p class="subtitle is-5 has-text-grey">Create and manage custom lists of ringers</p>
				</div>

				<!-- Alerts -->
				{#if listError}
					<div class="notification is-danger mb-4">
							<button class="delete" aria-label="Close error notification" on:click={() => listError = ''}></button>
						<strong>Error:</strong> {listError}
					</div>
				{/if}
				{#if listSuccess}
					<div class="notification is-success mb-4">
							<button class="delete" aria-label="Close success notification" on:click={() => listSuccess = ''}></button>
						<strong>Success:</strong> {listSuccess}
					</div>
				{/if}

				<!-- Create List Section -->
				<div class="box mb-5">
					<h2 class="subtitle is-4 mb-4">Create New List</h2>
					<div class="field">
						<label class="label" for="newListName">List Name</label>
						<input 
							id="newListName"
							class="input" 
							type="text" 
							placeholder="e.g., Quarter and Curry Ringers, Local Quarter Peal Band"
							bind:value={newListName}
							disabled={creatingList}
						/>
					</div>
					<div class="field">
						<label class="label" for="newListDescription">Description (optional)</label>
						<textarea 
							id="newListDescription"
							class="textarea" 
							placeholder="Add a description for this list"
							bind:value={newListDescription}
							disabled={creatingList}
							rows="2"
						></textarea>
					</div>
					<button 
						class="button is-success is-medium {creatingList ? 'is-loading' : ''}"
						on:click={createList}
						disabled={creatingList || !newListName.trim()}
					>
						<span>Create List</span>
					</button>
				</div>

				<!-- Lists Display -->
				{#if lists.length > 0}
					<div class="mb-4">
						<h2 class="subtitle is-4 mb-3">Your Lists <span class="tag is-info">{lists.length}</span></h2>
					</div>
					<div class="columns is-multiline">
						{#each lists as list (list.id)}
							<div class="column is-full-tablet is-half-desktop">
								<div class="box">
									<!-- List Header -->
									<div class="mb-4">
										<div class="is-flex is-justify-content-space-between is-align-items-start mb-2">
											<div style="flex: 1;">
												<h3 class="title is-5 mb-1">{list.name}</h3>
												{#if list.description}
													<p class="help has-text-grey-light">{list.description}</p>
												{/if}
											</div>
										</div>
										<div class="tags">
										<span class="tag is-info">{list.memberCount} {list.memberCount === 1 ? 'member' : 'members'}</span>
										</div>
									</div>

									<!-- List Actions -->
									<div class="is-flex is-gap-2 mb-4">
										<button 
											class="button is-info is-small is-flex-grow-1"
											on:click={() => toggleListDetails(list.id)}
										>
											<span class="icon is-small">
												<i class="fas fa-{expandedListId === list.id ? 'chevron-up' : 'chevron-down'}"></i>
											</span>
											<span>{expandedListId === list.id ? 'Hide' : 'Show'} Members</span>
										</button>
										<button 
											class="button is-danger is-small"
											on:click={() => deleteList(list.id)}
											aria-label="Delete this list"
											title="Delete this list"
										>
											<span class="icon is-small">
												<p>x</p>
											</span>
										</button>
									</div>

									<!-- Members List (Expandable) -->
									{#if expandedListId === list.id}
										<div class="has-background-black-bis p-4 mb-4" style="border-radius: 6px;">
											{#if loadingMembers[list.id]}
												<div class="has-text-centered py-4">
													<span class="icon is-large has-text-info">
														<i class="fas fa-spinner fa-spin fa-2x"></i>
													</span>
													<p class="help has-text-grey mt-2">Loading members...</p>
												</div>
											{:else if listMembers[list.id] && listMembers[list.id].length > 0}
												<div class="mb-4 pb-4">
													<h4 class="subtitle is-6 mb-3">Members ({listMembers[list.id].length})</h4>
													<div class="list-members">
														{#each listMembers[list.id] as member (member.id)}
															<div class="list-row">
																{#if member.profileImage}
																	<img 
																		src="/uploads/profiles/{member.profileImage}" 
																		alt="{member.username}"
																		class="list-row-avatar"
																	/>
																{:else}
																	<div 
																		class="list-row-avatar-placeholder"
																		style="background: linear-gradient(135deg, #8ee3ef 0%, #6ac6c6 100%); color: #073642;"
																	>
																		{member.username.charAt(0).toUpperCase()}
																	</div>
																{/if}
																<div class="list-row-name">
																	<a href="/u/{member.username.replace(/ /g, '-')}" class="has-text-link">
																		<strong>{member.username}</strong>
																	</a>
																</div>
																<div class="list-row-action">
																	<button 
																		class="button is-danger is-small"
																		on:click={() => removeMember(list.id, member.id)}
																		title="Remove from list"
																	>
																		Remove
																	</button>
																</div>
															</div>
														{/each}
													</div>
												</div>
											{:else}
												<p class="help has-text-grey has-text-centered py-3">No members in this list yet.</p>
											{/if}

											<!-- Add Users Section -->
											<div class="search-results-container">
												<h4 class="subtitle is-6 mb-3">Add Users</h4>
												<div class="field">
													<div class="control has-icons-right">
														<input 
															class="input" 
															type="text" 
															placeholder="Search by username or alias..."
															bind:value={searchQuery}
															on:input={(e) => {
																searchQuery = e.target.value;
																selectedListForSearch = list.id;
																searchUsers(searchQuery);
															}}
														/>
														{#if searching}
															<span class="icon is-right has-text-info">
																<i class="fas fa-spinner fa-spin"></i>
															</span>
														{/if}
													</div>
												</div>

												{#if searchResults.length > 0}
													<div class="list-members mt-3">
														{#each searchResults as user (user.id)}
															<div class="list-row">
																{#if user.profileImage}
																	<img 
																		src="/uploads/profiles/{user.profileImage}" 
																		alt="{user.username}"
																		class="list-row-avatar"
																	/>
																{:else}
																	<div 
																		class="list-row-avatar-placeholder"
																		style="background: linear-gradient(135deg, #a1e9f5 0%, #6ac6c6 100%); color: #073642;"
																	>
																		{user.username.charAt(0).toUpperCase()}
																	</div>
																{/if}
																<div class="list-row-name">
																	<a href="/u/{user.username.replace(/ /g, '-')}" class="has-text-link">
																		<strong>{user.username}</strong>
																	</a>
																</div>
																<div class="list-row-action">
																	<button 
																		class="button is-success is-small {addingUserToList === user.id ? 'is-loading' : ''}"
																		on:click={() => addUserToList(list.id, user.id, user.username)}
																		disabled={addingUserToList !== null}
																	>
																		Add
																	</button>
																</div>
															</div>
														{/each}
													</div>
												{:else if searchQuery && !searching}
													<p class="help has-text-grey has-text-centered py-3">No users found matching "{searchQuery}".</p>
												{:else if searching}
													<p class="help has-text-grey has-text-centered py-3">Searching...</p>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="has-text-centered py-8">
						<p class="icon is-large has-text-grey-light mb-4">
							<i class="fas fa-list fa-3x"></i>
						</p>
						<p class="help has-text-grey">You don't have any lists yet. Create one to get started!</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<Footer />

<style>
	:global(.py-8) {
		padding-top: 4rem !important;
		padding-bottom: 4rem !important;
	}

	:global(.p-5) {
		padding: 1.5rem;
	}

	:global(.mb-6) {
		margin-bottom: 2rem;
	}

	:global(.is-flex-grow-1) {
		flex: 1;
	}

	:global(.ml-2) {
		margin-left: 0.5rem;
	}
</style>
