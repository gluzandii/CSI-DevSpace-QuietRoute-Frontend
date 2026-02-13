<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Marker } from 'leaflet';

	interface Props {
		startMarker: Marker | null;
		endMarker: Marker | null;
	}

	let { startMarker = $bindable(), endMarker = $bindable() }: Props = $props();
</script>

{#if startMarker && endMarker}
	<div class="coordinates-box" transition:fade={{ duration: 400 }}>
		<div class="coord-item">
			<span class="coord-label">Start:</span>
			<span class="coord-value">
				{startMarker.getLatLng().lat.toFixed(6)}, {startMarker.getLatLng().lng.toFixed(6)}
			</span>
		</div>
		<div class="coord-item">
			<span class="coord-label">End:</span>
			<span class="coord-value">
				{endMarker.getLatLng().lat.toFixed(6)}, {endMarker.getLatLng().lng.toFixed(6)}
			</span>
		</div>
	</div>
{/if}

<style>
	/* Coordinates Box */
	.coordinates-box {
		position: absolute;
		top: 20px;
		right: 20px;
		z-index: 999;
		padding: 16px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(12px);
		border-radius: 12px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.6);
		min-width: 280px;
	}

	.coord-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 12px;
	}

	.coord-item:last-child {
		margin-bottom: 0;
	}

	.coord-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #64748b;
		letter-spacing: 0.05em;
	}

	.coord-value {
		font-size: 0.875rem;
		font-family: 'Courier New', monospace;
		font-weight: 600;
		color: #0f172a;
		word-break: break-all;
	}
</style>

