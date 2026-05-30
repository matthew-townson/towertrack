<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { onMount } from 'svelte';

	export let data;

	let query = '';
	let results = [];
	let loading = false;
	let error = '';
	let typingTimeout = null;

	function debounce(fn, wait = 50) {
		return (...args) => {
			clearTimeout(typingTimeout);
			typingTimeout = setTimeout(() => fn.apply(this, args), wait);
		};
	}

	async function doSearch(q) {
		error = '';
		if (!q || q.trim().length < 2) {
			results = [];
			loading = false;
			return;
		}
		loading = true;
		try {
			const res = await fetch(`/api/search-users?q=${encodeURIComponent(q.trim())}`);
			if (res.status === 401) {
				error = 'You must be logged in to search users.';
				results = [];
			} else if (!res.ok) {
				error = 'Search failed';
				results = [];
			} else {
				results = await res.json();
			}
		} catch (e) {
			error = 'Network error';
			results = [];
		} finally {
			loading = false;
		}
	}

	const debouncedSearch = debounce(doSearch, 200);

	$: if (query !== undefined) {
		if (!query || query.trim().length < 2) {
			results = [];
			loading = false;
			error = '';
		} else {
			debouncedSearch(query);
		}
	}

	function onKeydown(e) {
		if (e.key === 'Enter' && results.length > 0) {
			const first = results[0];
			if (first && first.username) {
				location.href = `/u/${first.username.replace(/ /g, '-')}`;
			}
		}
	}
</script>

<svelte:head>
	<title>Find Users | towertracker</title>
	<meta name="description" content="Search and find users on towertracker" />
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-two-thirds">
				<h1 class="title">Find Users</h1>

				<div class="box">
					<div class="field">
						<label class="label" for="user-search">Username</label>
						<div class="control has-icons-left has-icons-right">
							<input
								id="user-search"
								class="input is-medium"
								type="search"
								placeholder="e.g. Matthew Townson"
								bind:value={query}
								on:keydown={onKeydown}
								autocomplete="off"
								aria-label="Search users"
							/>
							<span class="icon is-left">🔍</span>
							{#if loading}
								<span class="icon is-right">⏳</span>
							{/if}
						</div>
						<p class="help">Press Enter to visit the first result.</p>
					</div>
				</div>

				{#if error}
					<div class="notification is-danger">{error}</div>
				{/if}

				{#if !loading && results.length === 0 && query && query.trim().length >= 2 && !error}
					<div class="notification is-warning">No users found matching "{query}"</div>
				{/if}

				{#if results.length > 0}
					<div class="box">
						<ul style="list-style:none; margin:0; padding:0;">
							{#each results as user}
								<li>
									<article class="media">
										<div class="media-left" style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
											{#if user.profileImage}
												<img 
													src="/uploads/profiles/{user.profileImage}" 
													alt="{user.username}"
													style="width: 100%; height: 100%; object-fit: cover; object-position: center; display: block;"
												/>
											{:else}
												<div 
													style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #a1e9f5 0%, #6ac6c6 100%); color: #073642; font-weight: bold; font-size: 1.2rem;"
												>
													{user.username.charAt(0).toUpperCase()}
												</div>
											{/if}
										</div>
										<div class="media-content">
											<div class="content">
												<p class="mb-1">
													<a href="/u/{user.username.replace(/ /g, '-')}" class="has-text-weight-semibold is-size-5">
														{user.username}
													</a>
												</p>
											</div>
										</div>

										<div class="media-right">
											<div class="buttons">
												<a class="button is-small is-info" href="/u/{user.username.replace(/ /g, '-')}">Profile</a>
											</div>
										</div>
									</article>
									<hr class="m-0" />
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<Footer />
