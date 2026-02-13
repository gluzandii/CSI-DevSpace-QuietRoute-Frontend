<script lang="ts">
	import { browser } from '$app/environment';
	import QuietRouteMap from '$lib/QuietRouteMap.svelte';
</script>

{#if browser}
	<QuietRouteMap />
{/if}
