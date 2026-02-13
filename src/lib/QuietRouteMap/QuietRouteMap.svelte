<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import 'leaflet/dist/leaflet.css';
	import type { LatLng, LayerGroup, Map, Marker, Polyline } from 'leaflet';
	import { handleMapClick, type MapState, resetMap } from './quietRouteMap.client';
	import CoordinatesBox from '../CoordinateBox/CoordinatesBox.svelte';
	import type { RouteMetadata, RouteResponse } from './types';

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
	let routeMetadata = $state<RouteMetadata | null>(null);

	type RouteStyle = 'dotted' | 'solid';
	const routeStyle: RouteStyle = 'dotted';

	function isValidLatLon(lat: number, lon: number): boolean {
		return (
			Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
		);
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

	function clearRoutePlot() {
		if (routeLayerGroup) routeLayerGroup.clearLayers();
		if (routePolyline && map) map.removeLayer(routePolyline);
		routePolyline = null;
		routeMetadata = null;
	}

	function formatPercent(value: number): string {
		if (!Number.isFinite(value)) return '0%';
		const decimals = value % 1 === 0 ? 0 : 1;
		return `${value.toFixed(decimals)}%`;
	}

	function formatMeters(value: number): string {
		if (!Number.isFinite(value)) return '0m';
		return `${Math.round(value)}m`;
	}

	// Helper to update state
	const updateState = (updates: Partial<MapState>) => {
		if (updates.statusText !== undefined) statusText = updates.statusText;

		const nextStartMarker = updates.startMarker !== undefined ? updates.startMarker : startMarker;
		const nextEndMarker = updates.endMarker !== undefined ? updates.endMarker : endMarker;

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

		if (!nextStartMarker || !nextEndMarker) {
			clearRoutePlot();
		}
	};

	onMount(() => {
		// Dynamic import for SSR compatibility
		   (async () => {
			   L = await import('leaflet');

			   // Fix Leaflet marker icon paths for production
			   L.Icon.Default.mergeOptions({
				   iconRetinaUrl: '/leaflet-images/marker-icon-2x.png',
				   iconUrl: '/leaflet-images/marker-icon.png',
				   shadowUrl: '/leaflet-images/marker-shadow.png'
			   });

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
		clearRoutePlot();
		resetMap(map, { statusText, startMarker, endMarker }, updateState);

		// Reset map view to original position
		map.setView([12.9716, 77.5946], 13);
		map.invalidateSize();
	}

	async function findRoute() {
		if (!startMarker || !endMarker) {
			clearRoutePlot();
			return;
		}

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
			clearRoutePlot();

			routeMetadata = data.metadata ?? null;

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
				routeMetadata = null;
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
			routeMetadata = null;
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

	{#if routeMetadata}
		<div class="route-stats-box" transition:fade={{ duration: 400 }}>
			<div class="stats-title">Route Stats</div>
			<div class="stats-grid">
				<div class="stats-item">
					<span class="stats-label">Total distance</span>
					<span class="stats-value">{formatMeters(routeMetadata.totalDistanceMeters)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Average safety score</span>
					<span class="stats-value">{routeMetadata.averageSafetyScore.toFixed(2)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Safety percentage</span>
					<span class="stats-value">{formatPercent(routeMetadata.safetyPercentage)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Lit segments</span>
					<span class="stats-value">
						{routeMetadata.litSegmentsCount} / {routeMetadata.totalSegments}
					</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Well-lit percentage</span>
					<span class="stats-value">{formatPercent(routeMetadata.litPercentage)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Nearest police (start)</span>
					<span class="stats-value">{formatMeters(routeMetadata.nearestPoliceStartMeters)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Nearest police (end)</span>
					<span class="stats-value">{formatMeters(routeMetadata.nearestPoliceEndMeters)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Nearest light (start)</span>
					<span class="stats-value">{formatMeters(routeMetadata.nearestLightStartMeters)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Nearest light (end)</span>
					<span class="stats-value">{formatMeters(routeMetadata.nearestLightEndMeters)}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Safety rating</span>
					<span class="stats-value">{routeMetadata.safetyRating}</span>
				</div>
			</div>
		</div>
	{/if}

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

	.route-stats-box {
		position: absolute;
		bottom: 20px;
		left: 20px;
		z-index: 999;
		width: 320px;
		max-height: 45vh;
		overflow: auto;
		padding: 16px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(12px);
		border-radius: 12px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.6);
	}
	.stats-title {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #64748b;
		margin-bottom: 12px;
	}
	.stats-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
	}
	.stats-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(248, 250, 252, 0.9);
		border: 1px solid rgba(226, 232, 240, 0.9);
	}
	.stats-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #94a3b8;
		letter-spacing: 0.06em;
	}
	.stats-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: #0f172a;
		word-break: break-word;
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
