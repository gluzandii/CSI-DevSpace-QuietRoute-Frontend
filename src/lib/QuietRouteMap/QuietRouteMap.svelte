<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import 'leaflet/dist/leaflet.css';
	import type { LatLng, LayerGroup, Map, Marker, Polyline } from 'leaflet';
	import { handleMapClick, type MapState, resetMap } from './quietRouteMap.client';
	import CoordinatesBox from '../CoordinateBox/CoordinatesBox.svelte';
	import type { RouteResponse } from './types';

	import { browser } from '$app/environment';

	if (!browser) {
		throw new Error('This component can only be rendered on the client');
	}

	// State
	let mapContainer: HTMLElement;
	let statusText = $state<string>('Click the map to set markers.');

	// Leaflet Instances
	let map: Map;
	let L: typeof import('leaflet');
	let routeLayerGroup = $state<LayerGroup | null>(null);
	let startMarker = $state<Marker | null>(null);
	let endMarker = $state<Marker | null>(null);
	let routePolyline = $state<Polyline | null>(null);

	type RouteStyle = 'dotted' | 'solid';
	const routeStyle: RouteStyle = 'dotted';

	function isValidLatLon(lat: number, lon: number): boolean {
		return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
	}

	function endpointScore(
		coordinates: [number, number][],
		start: { lat: number; lng: number },
		end: { lat: number; lng: number }
	): number {
		if (coordinates.length < 2) return Number.POSITIVE_INFINITY;

		const first = coordinates[0];
		const last = coordinates[coordinates.length - 1];
		const sq = (value: number) => value * value;
		const dist = (p: [number, number], q: { lat: number; lng: number }) =>
			sq(p[0] - q.lat) + sq(p[1] - q.lng);

		const forward = dist(first, start) + dist(last, end);
		const reverse = dist(first, end) + dist(last, start);

		return Math.min(forward, reverse);
	}

	function normalizeRouteCoordinates(
		rawCoordinates: number[][],
		start: { lat: number; lng: number },
		end: { lat: number; lng: number }
	): [number, number][] {
		const geoJsonOrder: [number, number][] = [];
		const latLonOrder: [number, number][] = [];

		for (const coord of rawCoordinates) {
			if (!Array.isArray(coord) || coord.length < 2) continue;

			const first = Number(coord[0]);
			const second = Number(coord[1]);
			if (!Number.isFinite(first) || !Number.isFinite(second)) continue;

			const geoJsonCandidate: [number, number] = [second, first];
			const latLonCandidate: [number, number] = [first, second];

			if (isValidLatLon(geoJsonCandidate[0], geoJsonCandidate[1])) {
				geoJsonOrder.push(geoJsonCandidate);
			}
			if (isValidLatLon(latLonCandidate[0], latLonCandidate[1])) {
				latLonOrder.push(latLonCandidate);
			}
		}

		if (geoJsonOrder.length < 2 && latLonOrder.length < 2) return [];
		if (geoJsonOrder.length < 2) return latLonOrder;
		if (latLonOrder.length < 2) return geoJsonOrder;

		const geoJsonScore = endpointScore(geoJsonOrder, start, end);
		const latLonScore = endpointScore(latLonOrder, start, end);
		return geoJsonScore <= latLonScore ? geoJsonOrder : latLonOrder;
	}

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

				routeLayerGroup = L.layerGroup().addTo(map);

				map.on('click', handleMapClickWrapper);
			}
		})();

		return () => {
			if (map) map.remove();
		};
	});

	async function handleMapClickWrapper(e: { latlng: LatLng }) {
		await handleMapClick(e, map, L, { statusText, startMarker, endMarker }, updateState);
	}

	function resetMapWrapper() {
		if (routeLayerGroup) routeLayerGroup.clearLayers();
		if (routePolyline) map.removeLayer(routePolyline);
		routePolyline = null;
		resetMap(map, { statusText, startMarker, endMarker }, updateState);

		// Reset map view to original position
		map.setView([12.9716, 77.5946], 13);
		map.invalidateSize();
	}

	async function findRoute() {
		if (!startMarker || !endMarker) return;

		const startLatLng = startMarker.getLatLng();
		const endLatLng = endMarker.getLatLng();

		const requestBody = {
			startLat: startLatLng.lat,
			startLon: startLatLng.lng,
			endLat: endLatLng.lat,
			endLon: endLatLng.lng
		};

		try {
			statusText = 'Finding route...';
			const response = await fetch('http://localhost:3000/route', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: RouteResponse = await response.json();
			console.log('Route data received:', data);

			const waypoints = data.geojson.properties.waypoints;
			const distanceKm = data.geojson.properties.distanceKm;

			// Remove existing route if any
			if (routeLayerGroup) routeLayerGroup.clearLayers();
			if (routePolyline) map.removeLayer(routePolyline);
			routePolyline = null;

			if (!routeLayerGroup) {
				routeLayerGroup = L.layerGroup().addTo(map);
			}

			// Extract and normalize coordinates from GeoJSON route geometry.
			const coordinates = normalizeRouteCoordinates(
				data.geojson.geometry.coordinates,
				startLatLng,
				endLatLng
			);

			if (coordinates.length < 2) {
				statusText = 'Route received but contained invalid coordinates.';
				return;
			}

			// Draw a route line with dot-like stroke by default (Google-walk-style feel).
			routePolyline = L.polyline(coordinates, {
				color: '#3B82F6',
				weight: 5,
				opacity: 0.95,
				lineCap: 'round',
				lineJoin: 'round',
				dashArray: routeStyle === 'dotted' ? '1 12' : undefined
			}).addTo(routeLayerGroup);

			// Keep tiles visible below route layers.
			routePolyline.bringToFront();

			// Fit map to show the entire route
			const bounds = routePolyline.getBounds();
			if (bounds && bounds.isValid()) {
				map.fitBounds(bounds, {
					padding: [50, 50],
					maxZoom: 16,
					animate: false
				});
			}

			statusText = `Route found with ${waypoints} waypoints (${distanceKm} km).`;
		} catch (error) {
			console.error('Error fetching route:', error);
			statusText = 'Error finding route. Please try again.';
		}
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

		<button class="reset-btn" disabled={!startMarker && !endMarker} onclick={resetMapWrapper}>
			Reset Map
		</button>
	</section>

	{#if startMarker && endMarker}
		<button
			class="find-route-btn"
			transition:fly={{ y: -100, duration: 500, opacity: 1 }}
			onclick={findRoute}
		>
			Find Route
		</button>
	{/if}

	<CoordinatesBox {endMarker} {startMarker} />

	<div bind:this={mapContainer} class="map-view" role="application"></div>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', sans-serif;
		overflow: hidden;
	}

	.app-container {
		position: relative;
		height: 100vh;
		width: 100vw;
	}
	.map-view {
		height: 100%;
		width: 100%;
		z-index: 1;
	}

	/* Glassmorphism Panel */
	.control-panel {
		position: absolute;
		top: 20px;
		left: 20px;
		z-index: 1000;
		width: 320px;
		padding: 24px;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(12px);
		border-radius: 16px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.5);
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		color: #0f172a;
	}
	.subtitle {
		margin: 4px 0 16px;
		font-size: 0.875rem;
		color: #64748b;
	}

	.status-text {
		font-weight: 500;
		color: #334155;
		margin-bottom: 16px;
	}

	.reset-btn {
		width: 100%;
		padding: 12px;
		background: #0f172a;
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}
	.reset-btn:hover:not(:disabled) {
		background: #1e293b;
		transform: translateY(-1px);
	}
	.reset-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.find-route-btn {
		position: absolute;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		padding: 14px 32px;
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
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
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
		transform: translateX(-50%) translateY(-2px);
		box-shadow: 0 12px 35px rgba(59, 130, 246, 0.5);
	}
	.find-route-btn:active {
		transform: translateX(-50%) translateY(0);
	}
</style>
