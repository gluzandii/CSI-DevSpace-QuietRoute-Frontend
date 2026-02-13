import type { LatLng, Map, Marker } from 'leaflet';

export interface MapState {
	statusText: string;
	startMarker: Marker | null;
	endMarker: Marker | null;
}

export function handleMapClick(
	e: { latlng: LatLng },
	map: Map,
	L: typeof import('leaflet'),
	state: MapState,
	updateState: (updates: Partial<MapState>) => void
) {
	if (!state.startMarker) {
		const marker = L.marker(e.latlng).addTo(map).bindPopup('Start').openPopup();
		updateState({
			startMarker: marker,
			statusText: 'Start set! Click again for destination.'
		});
	} else if (!state.endMarker) {
		const marker = L.marker(e.latlng).addTo(map).bindPopup('Destination').openPopup();
		updateState({
			endMarker: marker,
			statusText: 'Both markers set!'
		});

		// Show alert with coordinates
		const startLat = state.startMarker.getLatLng().lat.toFixed(6);
		const startLon = state.startMarker.getLatLng().lng.toFixed(6);
		const endLat = e.latlng.lat.toFixed(6);
		const endLon = e.latlng.lng.toFixed(6);

		alert(`Start: (${startLat}, ${startLon})\nEnd: (${endLat}, ${endLon})`);
	}
}

export function resetMap(
	map: Map,
	state: MapState,
	updateState: (updates: Partial<MapState>) => void
) {
	if (state.startMarker) map.removeLayer(state.startMarker);
	if (state.endMarker) map.removeLayer(state.endMarker);

	updateState({
		startMarker: null,
		endMarker: null,
		statusText: 'Click the map to set markers.'
	});
}
