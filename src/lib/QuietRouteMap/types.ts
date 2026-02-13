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
    metadata: RouteMetadata;
    message: string;
}

export interface RouteMetadata {
    totalDistanceMeters: number;
    averageSafetyScore: number;
    safetyPercentage: number;
    litSegmentsCount: number;
    totalSegments: number;
    litPercentage: number;
    nearestPoliceStartMeters: number;
    nearestPoliceEndMeters: number;
    nearestLightStartMeters: number;
    nearestLightEndMeters: number;
    safetyRating: string;
}

export interface NearestRoadCoord {
    lat: number;
    lon: number;
    distanceMeters: number;
}

export interface NearestRoadResponse {
    coord: NearestRoadCoord | null;
    message: string;
}
