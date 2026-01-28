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
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-two-thirds">
				<div class="box">
					<div class="mb-4">
						<a href="/account/settings?section=lists" class="button is-small is-light">
							← Back to Settings
						</a>
					</div>

					<h1 class="title">User Lists</h1>
					<p class="subtitle">Create and manage lists of ringers</p>

					{#if listError}
						<div class="notification is-danger mb-4">{listError}</div>
					{/if}
					{#if listSuccess}
						<div class="notification is-success mb-4">{listSuccess}</div>
					{/if}

					<!-- Create List Section -->
					<div class="box mb-4" style="background-color: rgba(255,255,255,0.05);">
						<h2 class="subtitle is-5">Create New List</h2>
						<div class="field">
							<label class="label" for="newListName">List Name</label>
							<input 
								id="newListName"
								class="input" 
								type="text" 
								placeholder="e.g., Strong Ringers, Friends, Band Members"
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
							class="button is-success {creatingList ? 'is-loading' : ''}"
							on:click={createList}
							disabled={creatingList || !newListName.trim()}
						>
							Create List
						</button>
					</div>

					<!-- Lists Display -->
					{#if lists.length > 0}
						<h2 class="subtitle is-5 mb-4">Your Lists ({lists.length})</h2>
						{#each lists as list (list.id)}
							<div class="box mb-3">
								<div class="is-flex is-justify-content-space-between is-align-items-start mb-3">
									<div style="flex: 1;">
										<h3 class="title is-6 mb-1">{list.name}</h3>
										{#if list.description}
											<p class="help mb-2">{list.description}</p>
										{/if}
										<p class="help has-text-grey">
											{list.memberCount} {list.memberCount === 1 ? 'member' : 'members'}
										</p>
									</div>
									<div class="is-flex is-gap-2 is-flex-wrap-wrap">
										<button 
											class="button is-small is-info"
											on:click={() => toggleListDetails(list.id)}
										>
											{expandedListId === list.id ? 'Hide' : 'Show'} Members
										</button>
										<button 
											class="button is-small is-danger is-light"
											on:click={() => deleteList(list.id)}
										>
											Delete
										</button>
									</div>
								</div>

								<!-- Members List -->
								{#if expandedListId === list.id}
									<div class="box" style="background-color: rgba(255,255,255,0.02);">
										{#if loadingMembers[list.id]}
											<p class="help has-text-grey">Loading members...</p>
										{:else if listMembers[list.id] && listMembers[list.id].length > 0}
											<div class="columns is-multiline is-mobile">
												{#each listMembers[list.id] as member (member.id)}
													<div class="column is-full-mobile is-half-tablet is-one-third-desktop">
														<div class="box" style="background-color: rgba(255,255,255,0.05); height: 100%;">
															<div class="is-flex is-align-items-center mb-2">
																{#if member.profileImage}
																	<img 
																		src="/uploads/profiles/{member.profileImage}" 
																		alt="{member.username}"
																		style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 0.75rem;"
																	/>
																{:else}
																	<div 
																		style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #8ee3ef 0%, #6ac6c6 100%); display: flex; align-items: center; justify-content: center; color: #073642; font-weight: 700; margin-right: 0.75rem;"
																	>
																		{member.username.charAt(0).toUpperCase()}
																	</div>
																{/if}
																<div style="flex: 1;">
																	<a href="/u/{member.username.replace(/ /g, '-')}" class="has-text-link">
																		<strong>{member.username}</strong>
																	</a>
																	{#if member.otherNames}
																		<p class="help is-size-7">{member.otherNames}</p>
																	{/if}
																</div>
															</div>
															<button 
																class="button is-danger is-light is-small is-fullwidth"
																on:click={() => removeMember(list.id, member.id)}
															>
																Remove
															</button>
														</div>
													</div>
												{/each}
											</div>
										{:else}
											<p class="help has-text-grey">No members in this list yet.</p>
										{/if}

										<!-- Add Users Section -->
										<div class="mt-4 pt-4" style="border-top: 1px solid rgba(255,255,255,0.1);">
											<h4 class="subtitle is-6">Add Users</h4>
											<div class="field">
												<label class="label" for="search-{list.id}">Search Users</label>
												<input 
													id="search-{list.id}"
													class="input" 
													type="text" 
													placeholder="Type to search by username or alias..."
													bind:value={searchQuery}
													on:input={(e) => {
														searchQuery = e.target.value;
														selectedListForSearch = list.id;
														searchUsers(searchQuery);
													}}
												/>
											</div>

											{#if searchResults.length > 0}
												<div class="columns is-multiline is-mobile">
													{#each searchResults as user (user.id)}
														<div class="column is-full-mobile is-half-tablet is-one-third-desktop">
															<div class="box" style="background-color: rgba(255,255,255,0.05);">
																<div class="is-flex is-align-items-center mb-2">
																	{#if user.profileImage}
																		<img 
																			src="/uploads/profiles/{user.profileImage}" 
																			alt="{user.username}"
																			style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 0.75rem;"
																		/>
																	{:else}
																		<div 
																			style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #a1e9f5 0%, #6ac6c6 100%); display: flex; align-items: center; justify-content: center; color: #073642; font-weight: 700; margin-right: 0.75rem;"
																		>
																			{user.username.charAt(0).toUpperCase()}
																		</div>
																	{/if}
																	<div style="flex: 1;">
																		<a href="/u/{user.username.replace(/ /g, '-')}" class="has-text-link">
																			<strong>{user.username}</strong>
																		</a>
																		{#if user.otherNames}
																			<p class="help is-size-7">{user.otherNames}</p>
																		{/if}
																	</div>
																</div>
																<button 
																	class="button is-success is-light is-small is-fullwidth {addingUserToList === user.id ? 'is-loading' : ''}"
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
												<p class="help has-text-grey">No users found matching "{searchQuery}".</p>
											{:else if searching}
												<p class="help has-text-grey">Searching...</p>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						<p class="help has-text-grey">No lists yet. Create one to get started!</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</main>

<Footer />
