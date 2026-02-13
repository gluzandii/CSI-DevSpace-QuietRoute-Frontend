export interface RouteResponse {
	geojson: {
		geometry: {
			coordinates: number[][];
			type: string;
		};
		properties: {
			costDistanceRatio: string;
			distanceKm: string;
			distanceMeters: string;
			routeType: string;
			safetyCost: string;
			waypoints: number;
		};
		type: string;
	};
	message: string;
}
