/** TEMPORARY, frontend-only contract declarations.
 * Member 2 owns src/types.ts. Do not edit their file; replace these type
 * imports with the shared types once that file is available.
 */
import type { FeatureCollection } from 'geojson';

export type TimeSlot = '10' | '13' | '16';
export interface RouteOptions { startNodeId: string; endNodeId: string; time: TimeSlot; heatAversion: number }
export interface RouteResult {
  coordinates: [number, number][]; // [latitude, longitude] from Member 2
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
export interface GraphNode { id: string; lat: number; lng: number }
export interface EngineAPI {
  loadDemoData: () => Promise<void>;
  getGraphNodes: () => GraphNode[];
  findNearestNode: (lat: number, lng: number) => string | null;
  getDefaultEndpoints: () => { startNodeId: string; endNodeId: string };
  getBuildingGeoJSON: () => FeatureCollection;
  getShadowGeoJSON: (time: TimeSlot) => FeatureCollection;
  getRouteComparison: (options: RouteOptions) => RouteComparison;
}
export interface LayerSettings {
  buildings: boolean;
  shadows: boolean;
  shortest: boolean;
  shaded: boolean;
  pedestrian: boolean;
  walkers: boolean;
}
export type ViewMode = 'both' | 'shortest' | 'shaded';
export type FocusedRoute = 'shortest' | 'shaded' | null;
