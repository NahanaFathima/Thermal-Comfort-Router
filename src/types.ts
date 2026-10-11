/** Public engine contract. Coordinates in RouteResult are [latitude, longitude]. */
export type TimeSlot = '10' | '13' | '16';
export interface GraphNode { id: string; lat: number; lng: number }
export interface GraphEdge {
  id: string;
  u: string;
  v: string;
  lengthMeters: number;
  /** Complete directed geometry, GeoJSON order [longitude, latitude]. */
  geometry: [number, number][];
  highway?: string;
}
export interface GraphData {
  metadata: {
    source: string;
    isSynthetic: boolean;
    generatedAt: string;
    bbox: [number, number, number, number];
    demoDate: string;
    heightCounts?: Record<string, number>;
    warning?: string;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  defaultEndpoints: { startNodeId: string; endNodeId: string };
}
export interface RouteOptions { startNodeId: string; endNodeId: string; time: TimeSlot; heatAversion: number }
export interface RouteResult {
  /** Latitude, longitude (Leaflet convention), not GeoJSON's coordinate order. */
  coordinates: [number, number][];
  distanceMeters: number;
  walkingMinutes: number;
  sunExposedMeters: number;
}
export interface RouteComparison {
  shortest: RouteResult;
  shaded: RouteResult;
  detourPercent: number;
  exposureReductionPercent: number | null;
}
export type ExposureSnapshot = Record<string, number>;
export class EngineError extends Error {
  constructor(public readonly code: 'NOT_READY'|'INVALID_INPUT'|'NO_ROUTE'|'DATA_ERROR'|'MISSING_EXPOSURE', message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
