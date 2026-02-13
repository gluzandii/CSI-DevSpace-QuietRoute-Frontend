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
		const marker = L.marker(e.latlng).addTo(map).bindPopup('Start (click to remove)').openPopup();
		marker.on('click', (event) => {
			event.originalEvent.stopPropagation();
			if (state.startMarker) map.removeLayer(state.startMarker);
			removeStartMarker(map, updateState);
		});
		updateState({
			startMarker: marker,
			statusText: 'Start set! Click again for destination.'
		});
	} else if (!state.endMarker) {
		const marker = L.marker(e.latlng)
			.addTo(map)
			.bindPopup('Destination (click to remove)')
			.openPopup();
		marker.on('click', (event) => {
			event.originalEvent.stopPropagation();
			if (state.endMarker) map.removeLayer(state.endMarker);
			removeEndMarker(map, state, updateState);
		});
		updateState({
			endMarker: marker,
			statusText: 'Both markers set!'
		});
	}
}

export function removeStartMarker(map: Map, updateState: (updates: Partial<MapState>) => void) {
	updateState({
		startMarker: null,
		statusText: 'Start marker removed. Click the map to set a new start.'
	});
}

export function removeEndMarker(
	map: Map,
	state: MapState,
	updateState: (updates: Partial<MapState>) => void
) {
	updateState({
		endMarker: null,
		statusText: 'End marker removed. Click the map for destination.'
	});
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
