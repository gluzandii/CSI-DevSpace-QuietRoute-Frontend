import type { LatLng, Map, Marker } from 'leaflet';
import type { NearestRoadCoord, NearestRoadResponse } from './types';

export interface MapState {
    statusText: string;
    startMarker: Marker | null;
    endMarker: Marker | null;
}

async function checkNearestRoad(lat: number, lon: number): Promise<{ lat: number; lon: number } | null> {
    try {
        const response = await fetch('http://localhost:3000/nearestRoad', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat, lon })
        });

        if (!response.ok) {
            console.warn(`Failed to check nearest road: ${response.status}`);
            return null;
        }

        const data: NearestRoadResponse = await response.json();

        if (data.coord) {
            // Show alert about relocation
            alert(
                `📍 Relocating to nearest road\n\nDistance: ${data.coord.distanceMeters.toFixed(
                    1
                )}m\n\n${data.message}`
            );
            return { lat: data.coord.lat, lon: data.coord.lon };
        }

        return null;
    } catch (error) {
        console.error('Error checking nearest road:', error);
        return null;
    }
}

export async function handleMapClick(
    e: { latlng: LatLng },
    map: Map,
    L: typeof import('leaflet'),
    state: MapState,
    updateState: (updates: Partial<MapState>) => void
) {
    let finalLatLng = e.latlng;

    // Check if point is near a road and relocate if needed
    const nearestRoad = await checkNearestRoad(e.latlng.lat, e.latlng.lng);
    if (nearestRoad) {
        finalLatLng = L.latLng(nearestRoad.lat, nearestRoad.lon);
    }

    if (!state.startMarker) {
        const marker = L.marker(finalLatLng).addTo(map).bindPopup('Start (click to remove)').openPopup();
        marker.on('click', (event) => {
            event.originalEvent.stopPropagation();
            removeStartMarker(map, updateState);
        });
        updateState({
            startMarker: marker,
            statusText: 'Start set! Click again for destination.'
        });
    } else if (!state.endMarker) {
        const marker = L.marker(finalLatLng)
            .addTo(map)
            .bindPopup('Destination (click to remove)')
            .openPopup();
        marker.on('click', (event) => {
            event.originalEvent.stopPropagation();
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
