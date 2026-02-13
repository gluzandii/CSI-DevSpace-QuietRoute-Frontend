<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type { LatLng, Map, Marker } from 'leaflet';
	import { handleMapClick, type MapState, resetMap } from './quietRouteMap.client';

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
			// Remove old marker from map if exists
			if (startMarker) map.removeLayer(startMarker);
			startMarker = updates.startMarker;
		}
		if (updates.endMarker !== undefined) {
			// Remove old marker from map if exists
			if (endMarker) map.removeLayer(endMarker);
			endMarker = updates.endMarker;
		}
	};

	// ...existing code...

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

		{#if startMarker && endMarker}
			<button class="find-route-btn">
				Find Route
			</button>
		{/if}
	</section>

	{#if startMarker && endMarker}
		<div class="coordinates-box">
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
        width: 100%; padding: 12px;
        margin-top: 12px;
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        color: white;
        border: none; border-radius: 8px;
        font-weight: 600; cursor: pointer;
        transition: all 0.2s;
        animation: slideIn 0.4s ease-out;
    }
    .find-route-btn:hover { background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); transform: translateY(-1px); }
    .find-route-btn:active { transform: translateY(0); }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Coordinates Box */
    .coordinates-box {
        position: absolute; top: 20px; right: 20px; z-index: 999;
        padding: 16px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        border: 1px solid rgba(255,255,255,0.6);
        animation: slideIn 0.4s ease-out;
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
