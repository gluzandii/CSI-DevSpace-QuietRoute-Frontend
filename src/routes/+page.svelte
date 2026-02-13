<script lang="ts">
	import { browser } from '$app/environment';
	import QuietRouteMap from '$lib/QuietRouteMap/QuietRouteMap.svelte';
</script>

{#if browser}
	<QuietRouteMap />
{/if}
