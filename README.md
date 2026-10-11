# Thermal Comfort Router — Combined Frontend + Computation Engine

**Single-page React/TypeScript/MapLibre UI with a standalone directed pedestrian-routing engine.** The routing algorithms are real; the initial packaged **geographic dataset is SYNTHETIC** because the environment where these files were built could not reach OpenStreetMap. The application displays a prominent warning in this state. Do **not** claim the bundled walkways represent the real Dubai pedestrian network.

## Quick start (existing synthetic test data)

Requirements: Node.js 20.19+ or 22.12+; internet access once to install npm dependencies.

```bash
npm install
npm run dev
```

Open the Vite address printed in your terminal (often http://localhost:5173).

The supplied local files contain 72 synthetic nodes, 254 directed sample edges, 51 invented building footprints, and genuinely computed model-based shadows and street exposure fractions for 10 AM / 1 PM / 4 PM on 2026-10-11 Dubai time. The routing engine runs actual Dijkstra on these local sample edges; **neither the geographic roads nor the resulting numbers should be represented as real-world Dubai results**. The synthetic fallback generator uses a simplified astronomical solar model. The required `precompute.mjs` replaces that with **SunCalc 2.x + Turf.js** once npm packages are installed.

## Produce ACTUAL OpenStreetMap-based local datasets

Requirements: network for the initial OSM extraction, Python 3.11+, OSMnx 2.x, Shapely/GeoPandas/NetworkX.

```bash
python -m pip install "osmnx>=2,<3"
python scripts/export_osm.py
npm run precompute
python scripts/validate_data.py
npm test
npm run build
```

**Windows:** In PowerShell, replace `python` with `py` if that is how Python is installed. Run from this project's root.

1. `export_osm.py` fetches real OSM walkable graph geometry and building footprints for an initial Downtown Dubai bounding box; node IDs, directed edge geometry, and distance are preserved.
2. It derives building heights from a valid `height` value, or `building:levels × 3.2 m`, or a clearly documented 15 m fallback. It records height-source counts, default connected endpoint IDs, and provenance. It deletes **stale** shadow/exposure data to ensure no synthetic data is accidentally paired with OSM roads.
3. `precompute.mjs` calculates SunCalc 2.x solar altitude/azimuth for the explicit Dubai-local date/time, projects approximate building shadows with Turf.js and samples edge sunlight exposure at ~5 m intervals. It regenerates six time-specific local files. If you change the date, use `DEMO_DATE=YYYY-MM-DD` when running precompute, and keep the graph metadata date consistent.
4. `validate_data.py` checks each edge, each exposure snapshot, and endpoint connectivity without additional Python dependencies.
5. Run `npm test` (Vitest) and `npm run build` (production build), followed by live laptop testing. **These npm checks could not be executed in the build environment, which lacked package registry access.**

**Do not assume this script will always find a convincing real-world time-dependent route.** Inspect network connectivity, height coverage, and actual outputs. If data quality is insufficient, use `--bbox WEST SOUTH EAST NORTH` to restrict the area and retry. The default pair is selected from a strongly connected component for reachability; its shade savings are **not prevalidated** until you run local extraction/precomputation and inspect results.

## Data ownership and provenance

- `public/data/graph.json` — directed nodes, real/illustrative edge-following polylines, edge distances and metadata.
- `public/data/buildings.geojson` — footprints, normalized numeric `height`/`heightMeters`, and height sources.
- `public/data/shadows-1000.geojson`, `shadows-1300.geojson`, `shadows-1600.geojson` — estimated shadow polygons.
- `public/data/exposure-1000.json`, `exposure-1300.json`, `exposure-1600.json` — edge ID to estimated directly exposed fraction [0,1].
- `public/data/DATA_PROVENANCE.txt` — always check this file **and** `graph.json.metadata.isSynthetic` before any presentation.

The runtime never downloads OSM or recomputes shadows; it fetches only its own bundled `/data/` files on initialization. The blank map background works without map tiles. Once data has loaded, route recalculations are synchronous browser-local computations.

When using actual OSM data, include **© OpenStreetMap contributors (ODbL)** attribution and consult OSM data licensing requirements.

## Engine API (`src/engine/index.ts`)

```text
loadDemoData(): Promise<void>
getGraphNodes(): GraphNode[]
findNearestNode(lat,lng): string | null
getDefaultEndpoints(): {startNodeId,endNodeId}
getBuildingGeoJSON(): FeatureCollection
getShadowGeoJSON(time): FeatureCollection
getRouteComparison({startNodeId,endNodeId,time,heatAversion}): RouteComparison
```

Additional helpers: `getPedestrianGeoJSON()`, `getDataProvenance()`. All path coordinates returned by `getRouteComparison()` are `[latitude, longitude]`; graph/GeoJSON coordinates are `[longitude, latitude]`. Unreachable routes throw `EngineError` with `code: 'NO_ROUTE'` rather than drawing straight connectors. Calls to synchronous getters before `loadDemoData()` completes throw `NOT_READY`.

The original frontend's `src/integration/engineAdapter.ts` is already wired to the new engine. The UI consumes computed outputs only. The sample geography disclosure automatically disappears when the loaded `graph.json` contains `isSynthetic:false` after a successful OSM data extraction.

## Math used

The shortest route minimizes the sum of graph edge lengths. The shade-aware route minimizes:

```text
edgeCost = edgeLengthMeters × (1 + heatAversion × exposedFraction)
heatAversion ∈ [0,5]
exposedFraction ∈ [0,1]
```

Both routes use directed edges from the SAME pedestrian graph. Dijkstra uses a binary heap. Walking time assumes **1.25 m/s**. Exposed distance is the sum of `edgeLengthMeters × exposedFraction` for traversed edges. Exposure reduction percentages have a null value if the shortest-route exposure is zero.

For shadows: `shadowLength = buildingHeight / tan(solarAltitude)` and shadow bearing equals `(solarAzimuth + 180) % 360`. The app uses a convex hull around footprint vertices and their displaced counterparts. This **can overestimate shade around concave buildings**, ignores trees and elevated cover, and cannot represent medical heat risk, air temperature, or street-level thermal comfort. Original building heights are often missing or inferred.

## Engine source and scripts

```text
src/types.ts                  Shared types + EngineError
src/engine/index.ts           Local loading, caching, shared API
src/engine/routing.ts         Directed Dijkstra and binary heap
src/engine/metrics.ts         Walking time, sun exposure and route comparisons
src/engine/shadows.ts         SunCalc 2 and Turf convex-hull projection
src/engine/exposure.ts        Turf polyline sampling and polygon membership
scripts/export_osm.py         OSMnx 2 real-data extractor (requires internet)
scripts/precompute.mjs       SunCalc 2 + Turf precomputation
scripts/generate_synthetic_demo.py  Clearly labeled fallback dataset
scripts/validate_data.py     Dataset and graph integrity checks
tests/{routing,shadows,exposure,integration}.test.ts
```

## Validation performed when packaging

- **PASS:** local synthetic datasets integrity: all time snapshots loaded, 72 nodes, 254 directed edges, 51 footprints, exposures bounded [0,1], connected demo endpoints.
- **PASS:** real TypeScript Dijkstra/metrics implementation executed under a local TypeScript-to-JavaScript smoke harness with the packaged data; comparison values finite at all three times; synthetic diamond-graph test confirms alpha=0 shortest vs alpha>0 shade routing; unreachable reverse direction throws.
- **PASS:** strict TypeScript type checking of engine source with external library declaration shims; Python scripts compile; `precompute.mjs` parses with Node.
- **NOT RUN:** actual OSM extraction, SunCalc/Turf live precomputation, full Vitest suite, npm production build, visual browser E2E tests. Dependencies could not be installed in the offline build container.

## Judge-friendly explanation

> We compare the shortest pedestrian route with a shade-aware route. Using building footprints, estimated building heights and the sun's position for three fixed Dubai-local times, we estimate the shadow coverage of walkable street segments. Every edge receives a sunlight-exposure fraction. Our graph solver uses Dijkstra to find the shortest route and a weighted alternative that favors shade when requested. Results quantify extra walking distance and less *estimated direct-sun exposure*, not human body temperature or guaranteed cooling.

For the final judged demonstration, run the real OSM extraction and verification procedure above. **Do not present the bundled synthetic demo as a real-world Dubai routing result.**
