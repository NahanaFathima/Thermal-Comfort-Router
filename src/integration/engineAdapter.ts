import type { FeatureCollection } from 'geojson';
import type { EngineAPI } from './contracts';
import * as actualEngine from '../engine/index';
/**
 * REAL ROUTING ALGORITHMS, with SYNTHETIC fallback geographic files packaged for offline testing.
 * This is NOT the former mockEngine. Once scripts/export_osm.py and scripts/precompute.mjs
 * are run successfully, this same adapter uses the real OSM-derived local data without changes.
 */
export const engine:EngineAPI=actualEngine;
export const getOptionalPedestrianGeoJSON=():FeatureCollection|null=> {
  try{return actualEngine.getPedestrianGeoJSON();}catch{return null;}
};
export const getEngineProvenance=()=>actualEngine.getDataProvenance();
