<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let data;

	const raw = data?.changelog;
	const loadError = data?.error ?? null;

	function entriesFromRaw(r) {
		if (!r) return [];
		if (Array.isArray(r)) return r;
		if (r.releases && Array.isArray(r.releases)) return r.releases;
		if (r.entries && Array.isArray(r.entries)) return r.entries;
		if (typeof r === 'object' && (r.version || r.title || r.items || r.changes || r.description)) {
			return [r];
		}
		if (typeof r === 'object') {
			const vals = Object.values(r);
			const hasReleaseLike = vals.some(v => v && typeof v === 'object' && (v.version || v.items || v.changes));
			if (hasReleaseLike) return vals;
		}
		return [{ version: 'Release', date: '', items: [typeof r === 'string' ? r : JSON.stringify(r)] }];
	}

	const entries = entriesFromRaw(raw);
</script>

<svelte:head>
	<title>Updates | towertracker</title>
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="content">
			<h1 class="title">Updates</h1>
			<p class="subtitle">See the latest features, improvements, and fixes for towertracker.</p>
		</div>

		{#if loadError}
			<div class="notification is-danger">
				<strong>Error:</strong> {loadError}
			</div>
		{/if}

		{#if entries && entries.length > 0}
			<div class="columns is-multiline">
				{#each entries as u}
					<div class="column is-half-desktop is-full-mobile">
						<article class="box">
							<header class="level is-mobile">
								<div class="level-left">
									<h2 class="title is-5">{u.version || u.title || 'Release'}</h2>
								</div>
								<div class="level-right">
									{#if u.date}
										<time datetime={u.date} class="has-text-grey">{u.date}</time>
									{/if}
								</div>
							</header>
							<div class="content">
								{#if u.items && u.items.length > 0}
									<ul>
										{#each u.items as it}
											<li>{it}</li>
										{/each}
									</ul>
								{:else}
									<p class="is-italic has-text-grey">No details for this release.</p>
								{/if}
							</div>
						</article>
					</div>
				{/each}
			</div>
		{:else}
			<div class="notification is-info">
				No updates found.
			</div>
		{/if}
	</div>
</main>

<Footer />
