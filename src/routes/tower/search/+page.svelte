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
			const res = await fetch(`/api/search-towers?query=${encodeURIComponent(q.trim())}`);
			if (res.status === 401) {
				error = 'You must be logged in to search towers.';
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
			// navigate to first result
			const first = results[0];
			if (first && first.TowerID) {
				location.href = `/tower/${first.TowerID}`;
			}
		}
	}

	function formatBrief(t) {
		const parts = [];
		if (t.Dedicn) parts.push(t.Dedicn);
		if (t.County) parts.push(t.County);
		if (t.Bells) parts.push(`${t.Bells} bells`);
		return parts.join(' • ');
	}
</script>

<svelte:head>
	<title>Search Towers | towertracker</title>
	<meta name="description" content="Search towers by place, dedication or county" />
	<link rel="stylesheet" href="/assets/css/tower.css">
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-two-thirds">
				<h1 class="title">Search Towers</h1>

				<div class="box">
					<div class="field">
						<label class="label" for="tower-search">Place, dedication or county</label>
						<div class="control has-icons-left has-icons-right">
							<input
								id="tower-search"
								class="input is-medium"
								type="search"
								placeholder="e.g. Lancaster, Priory Ch of S Mary"
								bind:value={query}
								on:keydown={onKeydown}
								autocomplete="off"
								aria-label="Search towers"
							/>
							<span class="icon is-left">🔍</span>
							{#if loading}
								<span class="icon is-right">⏳</span>
							{/if}
						</div>
						<p class="help">Type at least 2 characters. Press Enter to open the top result.</p>
					</div>
				</div>

				{#if error}
					<div class="notification is-danger">{error}</div>
				{/if}

				{#if !loading && results.length === 0 && query && query.trim().length >= 2 && !error}
					<div class="notification is-warning">No towers found matching "{query}"</div>
				{/if}

				{#if results.length > 0}
					<div class="box">
						<ul style="list-style:none; margin:0; padding:0;">
							{#each results as t}
								<li>
									<article class="media">
										<div class="media-content">
											<div class="content">
												<p class="mb-1">
													<a href={"/tower/" + t.TowerID} class="has-text-weight-semibold is-size-5">
														{t.Place}{t.Dedicn ? `, ${t.Dedicn}` : ''}
													</a>
													{#if t.UR === '1' || t.UR === 1}
														<span class="tag is-danger is-light" style="margin-left:0.5rem;">U/R</span>
													{/if}
												</p>
												<p class="is-size-7 has-text-grey">
													{formatBrief(t)}
												</p>
											</div>
										</div>

										<div class="media-right">
											<div class="buttons">
												<a class="button is-small is-info" href={"/tower/" + t.TowerID}>Details</a>
												<a class="button is-small" href={"/grab/add?towerId=" + t.TowerID}>Grab</a>
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

<style>
	/* minimal page-local tweaks */
	:global(.help) { margin-top:0.25rem; }
</style>
