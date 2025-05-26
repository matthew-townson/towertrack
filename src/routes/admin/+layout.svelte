<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let data;
</script>

<Header user={data.user} />

<slot />

<Footer />
