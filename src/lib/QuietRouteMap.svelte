<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import 'leaflet/dist/leaflet.css';
	import type { LatLng, Map, Marker } from 'leaflet';
	import { handleMapClick, type MapState, resetMap } from './quietRouteMap.client';
	import CoordinatesBox from './CoordinatesBox.svelte';

	import { browser } from '$app/environment';

	if (!browser) {
		throw new Error('This component can only be rendered on the client');
	}

	// State
	let mapContainer: HTMLElement;
	let statusText = $state<string>("Click the map to set markers.");

	// Leaflet Instances
	let map: Map;
	let L: typeof import('leaflet');
	let startMarker = $state<Marker | null>(null);
	let endMarker = $state<Marker | null>(null);

	// Helper to update state
	const updateState = (updates: Partial<MapState>) => {
		if (updates.statusText !== undefined) statusText = updates.statusText;
		if (updates.startMarker !== undefined) {
			// Remove old marker from map if it exists
			if (startMarker) map.removeLayer(startMarker);
			startMarker = updates.startMarker;
		}
		if (updates.endMarker !== undefined) {
			// Remove old marker from map if it exists
			if (endMarker) map.removeLayer(endMarker);
			endMarker = updates.endMarker;
		}
	};

	onMount(() => {
		// Dynamic import for SSR compatibility
		(async () => {
			L = await import('leaflet');

			if (mapContainer) {
				map = L.map(mapContainer, { zoomControl: false }).setView([12.9716, 77.5946], 13);

				L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
					attribution: '&copy; OpenStreetMap contributors'
				}).addTo(map);

				map.on('click', handleMapClickWrapper);
			}
		})();

		return () => {
			if (map) map.remove();
		};
	});

	function handleMapClickWrapper(e: { latlng: LatLng }) {
		handleMapClick(e, map, L, { statusText, startMarker, endMarker }, updateState);
	}

	function resetMapWrapper() {
		resetMap(map, { statusText, startMarker, endMarker }, updateState);
	}
</script>

<main class="app-container">
	<section class="control-panel">
		<header>
			<h1>🌙 QuietRoute</h1>
			<p class="subtitle">Bangalore Safety Navigation</p>
		</header>

		<div class="status-box">
			<p class="status-text">{statusText}</p>
		</div>

		<button
			class="reset-btn"
			disabled={!startMarker && !endMarker}
			onclick={resetMapWrapper}
		>
			Reset Map
		</button>
	</section>

	{#if startMarker && endMarker}
		<button
			class="find-route-btn"
			transition:fly={{ y: -100, duration: 500, opacity: 1 }}
		>
			Find Route
		</button>
	{/if}

	<CoordinatesBox {endMarker} {startMarker} />

	<div
		bind:this={mapContainer}
		class="map-view"
		role="application"
	></div>
</main>

<style>
    :global(body) { margin: 0; font-family: 'Inter', sans-serif; overflow: hidden; }

    .app-container { position: relative; height: 100vh; width: 100vw; }
    .map-view { height: 100%; width: 100%; z-index: 1; }

    /* Glassmorphism Panel */
    .control-panel {
        position: absolute; top: 20px; left: 20px; z-index: 1000;
        width: 320px; padding: 24px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(12px);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        border: 1px solid rgba(255,255,255,0.5);
    }

    h1 { margin: 0; font-size: 1.5rem; color: #0f172a; }
    .subtitle { margin: 4px 0 16px; font-size: 0.875rem; color: #64748b; }

    .status-text { font-weight: 500; color: #334155; margin-bottom: 16px; }

    .reset-btn {
        width: 100%; padding: 12px;
        background: #0f172a; color: white;
        border: none; border-radius: 8px;
        font-weight: 600; cursor: pointer;
        transition: all 0.2s;
    }
    .reset-btn:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
    .reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .find-route-btn {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        padding: 14px 32px;
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
        transition: all 0.2s;
    }
    .find-route-btn:hover {
        background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
        transform: translateX(-50%) translateY(-2px);
        box-shadow: 0 12px 35px rgba(59, 130, 246, 0.5);
    }
    .find-route-btn:active {
        transform: translateX(-50%) translateY(0);
    }
</style>
