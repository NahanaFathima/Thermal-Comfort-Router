
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import type { RefObject } from 'react';

import Map, {
  Layer,
  Marker,
  Source,
  type MapRef
} from 'react-map-gl/maplibre';

import { Flag, Footprints } from 'lucide-react';

import type {
  Feature,
  FeatureCollection,
  LineString
} from 'geojson';

import type {
  GraphNode,
  RouteComparison,
  LayerSettings,
  FocusedRoute,
  TimeSlot,
  ViewMode
} from '../integration/contracts';

// =============================================
// DEFAULT CAMERA SETTINGS
// =============================================

const DEFAULT_CAMERA = {
  latitude: 25.195,
  longitude: 55.278,
  zoom: 15.5,
  pitch: 38,
  bearing: 0
};

const EMPTY: FeatureCollection = {
  type: 'FeatureCollection',
  features: []
};

// Offline map background
const blankStyle = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: 'ground',
      type: 'background' as const,
      paint: {
        'background-color': '#EFE7D6'
      }
    }
  ]
};

// Building appearances for supported times
const timeBuilding: Record<TimeSlot, string> = {
  '10': '#F1E9D8',
  '13': '#F7F1E3',
  '16': '#EBD3AE'
};

// =============================================
// CONVERT ROUTE COORDINATES TO GEOJSON
// =============================================

const routeGeo = (
  coordinates?: [number, number][]
): FeatureCollection => {
  if (!coordinates || coordinates.length < 2) {
    return EMPTY;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates.map(
            ([lat, lng]) => [lng, lat]
          )
        }
      } as Feature<LineString>
    ]
  };
};

// =============================================
// WALKER POSITION
// =============================================

function getWalkerPoint(
  coords: [number, number][],
  progress: number
): [number, number] | null {
  if (coords.length < 2) return null;

  const position = progress * (coords.length - 1);

  const i = Math.min(
    coords.length - 2,
    Math.floor(position)
  );

  const t = position - i;

  return [
    coords[i][0] +
      (coords[i + 1][0] - coords[i][0]) * t,

    coords[i][1] +
      (coords[i + 1][1] - coords[i][1]) * t
  ];
}

// =============================================
// GEOGRAPHIC DISTANCE CALCULATION
// =============================================

const metersBetween = (
  a: [number, number],
  b: [number, number]
): number => {
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;

  const dp = ((b[0] - a[0]) * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;

  const q =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dl / 2) ** 2;

  return (
    6371000 *
    2 *
    Math.atan2(
      Math.sqrt(q),
      Math.sqrt(Math.max(0, 1 - q))
    )
  );
};

// =============================================
// FIND POSITION ALONG ACTUAL WALKING ROUTE
// =============================================

const atRouteDistance = (
  coords: [number, number][],
  fraction: number
): [number, number] => {
  if (coords.length < 2) {
    return coords[0] ?? [25.195, 55.278];
  }

  const lengths = coords
    .slice(1)
    .map((point, i) =>
      metersBetween(coords[i], point)
    );

  const total = lengths.reduce(
    (a, b) => a + b,
    0
  );

  let distance =
    total * Math.max(0, Math.min(1, fraction));

  for (let i = 0; i < lengths.length; i++) {
    if (
      distance <= lengths[i] ||
      i === lengths.length - 1
    ) {
      const ratio = lengths[i]
        ? Math.max(
            0,
            Math.min(1, distance / lengths[i])
          )
        : 0;

      return [
        coords[i][0] +
          (coords[i + 1][0] - coords[i][0]) * ratio,

        coords[i][1] +
          (coords[i + 1][1] - coords[i][1]) * ratio
      ];
    }

    distance -= lengths[i];
  }

  return coords[coords.length - 1];
};

// =============================================
// CALCULATE CAMERA DIRECTION
// =============================================

const routeBearing = (
  a: [number, number],
  b: [number, number]
): number => {
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;

  const y =
    Math.sin(dl) * Math.cos(lat2);

  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dl);

  return (Math.atan2(y, x) * 180) / Math.PI;
};

// =============================================
// MAP METHODS EXPOSED TO APP.TSX
// =============================================

export interface MapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitRoute: () => void;
  resetView: () => void;
}

// =============================================
// COMPONENT PROPERTIES
// =============================================

interface Props {
  mapRef: RefObject<MapViewHandle | null>;

  buildingGeoJSON: FeatureCollection;
  shadowGeoJSON: FeatureCollection;
  streetGeoJSON: FeatureCollection | null;

  startNode: GraphNode | null;
  endNode: GraphNode | null;

  routes: RouteComparison | null;

  layers: LayerSettings;
  time: TimeSlot;
  view: ViewMode;
  focused: FocusedRoute;

  onMapSelect: (
    lat: number,
    lng: number
  ) => void;

  onFocus: (
    route: FocusedRoute
  ) => void;

  activeSelection: boolean;

  // Walking perspective
  streetMode: boolean;
  streetStep: number;
  streetRoute: 'shortest' | 'shaded';
}

// =============================================
// MAIN MAP COMPONENT
// =============================================

export default function MapView({
  mapRef: handle,
  buildingGeoJSON,
  shadowGeoJSON,
  streetGeoJSON,
  startNode,
  endNode,
  routes,
  layers,
  time,
  view,
  focused,
  onMapSelect,
  onFocus,
  activeSelection,
  streetMode,
  streetStep,
  streetRoute
}: Props) {
  const ref = useRef<MapRef | null>(null);

  const [ready, setReady] = useState(false);

  const [rise, setRise] = useState(0);

  const [shadowAlpha, setShadowAlpha] =
    useState(0.33);

  const [walker, setWalker] = useState(0);

  const prevTime = useRef(time);

  const previousStreetMode = useRef(false);

  // =========================================
  // ROUTE GEOJSON
  // =========================================

  const shortest = useMemo(
    () => routeGeo(routes?.shortest.coordinates),
    [routes]
  );

  const shaded = useMemo(
    () => routeGeo(routes?.shaded.coordinates),
    [routes]
  );

  // =========================================
  // ROUTE VISIBILITY
  // =========================================

  const visibleShortest = streetMode
    ? streetRoute === 'shortest'
    : layers.shortest &&
      (view === 'both' || view === 'shortest');

  const visibleShaded = streetMode
    ? streetRoute === 'shaded'
    : layers.shaded &&
      (view === 'both' || view === 'shaded');

  const shortOpacity = !visibleShortest
    ? 0
    : streetMode
      ? 1
      : focused === 'shaded'
        ? 0.42
        : 1;

  const shadeOpacity = !visibleShaded
    ? 0
    : streetMode
      ? 1
      : focused === 'shortest'
        ? 0.42
        : 1;

  // =========================================
  // INITIAL 3D BUILDING RISE
  // =========================================

  useEffect(() => {
    if (!ready) return;

    if (
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    ) {
      setRise(1);
      return;
    }

    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const p = Math.min(
        1,
        (now - start) / 1700
      );

      setRise(1 - Math.pow(1 - p, 3));

      if (p < 1) {
        raf = requestAnimationFrame(draw);
      }
    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // =========================================
  // SHADOW TRANSITION WHEN TIME CHANGES
  // =========================================

  useEffect(() => {
    if (prevTime.current === time) return;

    prevTime.current = time;

    setShadowAlpha(0);

    const timer = window.setTimeout(() => {
      setShadowAlpha(0.33);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [time]);

  // =========================================
  // WALKER DOT MOVEMENT
  // =========================================

  useEffect(() => {
    if (
      !layers.walkers ||
      !routes ||
      streetMode ||
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    ) {
      return;
    }

    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      if (
        !document.hidden &&
        now - last > 60
      ) {
        setWalker((now % 7000) / 7000);
        last = now;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, [layers.walkers, routes, streetMode]);

  // =========================================
  // FIT COMPLETE ROUTE INTO MAP
  // =========================================

  const fitRoute = useCallback(() => {
    if (!ref.current || !routes) return;

    const pairs = [
      ...routes.shortest.coordinates,
      ...routes.shaded.coordinates
    ];

    if (!pairs.length) return;

    const lats = pairs.map(p => p[0]);
    const lngs = pairs.map(p => p[1]);

    const canvas =
      ref.current.getMap().getCanvas();

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const mobile = width < 750;
    const compact = width < 1300;

    ref.current.fitBounds(
      [
        [
          Math.min(...lngs),
          Math.min(...lats)
        ],
        [
          Math.max(...lngs),
          Math.max(...lats)
        ]
      ],
      {
        padding: mobile
          ? {
              top: 36,
              bottom: 42,
              left: 30,
              right: 30
            }
          : {
              top: Math.min(
                76,
                height * 0.12
              ),

              bottom: Math.min(
                220,
                height * 0.31
              ),

              left: compact
                ? Math.min(
                    285,
                    width * 0.27
                  )
                : Math.min(
                    355,
                    width * 0.28
                  ),

              right: compact
                ? Math.min(
                    355,
                    width * 0.34
                  )
                : Math.min(
                    430,
                    width * 0.30
                  )
            },

        duration: 1000,
        maxZoom: 17.6,
        pitch: 32,
        bearing: 0
      }
    );
  }, [routes]);

  // =========================================
  // WALKING PERSPECTIVE CAMERA
  // =========================================

  useEffect(() => {
    if (
      !ready ||
      !routes ||
      !streetMode
    ) {
      return;
    }

    const coordinates =
      streetRoute === 'shaded'
        ? routes.shaded.coordinates
        : routes.shortest.coordinates;

    if (coordinates.length < 2) return;

    const current = atRouteDistance(
      coordinates,
      streetStep / 20
    );

    // Look ahead along the walking path
    const ahead = atRouteDistance(
      coordinates,
      Math.min(
        1,
        streetStep / 20 + 0.012
      )
    );

    // At the end of the path, look backward
    // to determine the forward bearing.
    const directionFrom =
      metersBetween(current, ahead) > 0.01
        ? current
        : atRouteDistance(coordinates, 0.98);

    const bearing = routeBearing(
      directionFrom,
      ahead
    );

    ref.current?.flyTo({
      center: [
        current[1],
        current[0]
      ],

      zoom: 18.1,
      pitch: 75,
      bearing,

      duration: window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
        ? 0
        : 850,

      essential: true
    });
  }, [
    ready,
    routes,
    streetMode,
    streetStep,
    streetRoute
  ]);

  // =========================================
  // RESTORE NORMAL VIEW WHEN EXITING
  // =========================================

  useEffect(() => {
    if (
      previousStreetMode.current &&
      !streetMode &&
      ready
    ) {
      const timer = window.setTimeout(
        fitRoute,
        70
      );

      previousStreetMode.current = streetMode;

      return () => window.clearTimeout(timer);
    }

    previousStreetMode.current = streetMode;
  }, [
    streetMode,
    ready,
    fitRoute
  ]);

  // =========================================
  // EXPOSE MAP METHODS TO APP.TSX
  // =========================================

  useEffect(() => {
    handle.current = {
      zoomIn: () => {
        ref.current?.zoomIn();
      },

      zoomOut: () => {
        ref.current?.zoomOut();
      },

      fitRoute,

      resetView: () => {
        ref.current?.flyTo({
          ...DEFAULT_CAMERA,
          duration: 900
        });
      }
    };

    return () => {
      handle.current = null;
    };
  }, [
    handle,
    fitRoute
  ]);

  // =========================================
  // MAP CLICK INTERACTION
  // =========================================

  const onClick = useCallback(
    (
      e: {
        point: {
          x: number;
          y: number;
        };
        lngLat: {
          lat: number;
          lng: number;
        };
      }
    ) => {
      // Disable point selection in street mode
      if (streetMode) return;

      const map = ref.current?.getMap();

      if (map && !activeSelection) {
        const routeLayers = [
          'shade-line',
          'short-line'
        ].filter(
          id => !!map.getLayer(id)
        );

        if (routeLayers.length) {
          const features =
            map.queryRenderedFeatures(
              [e.point.x, e.point.y],
              {
                layers: routeLayers
              }
            );

          if (
            features.some(
              f => f.layer.id === 'shade-line'
            )
          ) {
            onFocus('shaded');
            return;
          }

          if (
            features.some(
              f => f.layer.id === 'short-line'
            )
          ) {
            onFocus('shortest');
            return;
          }
        }
      }

      onMapSelect(
        e.lngLat.lat,
        e.lngLat.lng
      );
    },
    [
      onMapSelect,
      onFocus,
      activeSelection,
      streetMode
    ]
  );

  // =========================================
  // MAP RENDERING
  // =========================================

  return (
    <div
      className="map-root"
      aria-label="Interactive Downtown Dubai navigation map"
    >
      <Map
        ref={ref}
        initialViewState={DEFAULT_CAMERA}
        mapStyle={blankStyle}
        onLoad={() => setReady(true)}
        onClick={onClick}
        minZoom={14}
        maxZoom={19}
        maxPitch={85}
        attributionControl={false}
        reuseMaps={true}
        dragRotate={true}
        touchZoomRotate={true}
        cursor={
          streetMode
            ? 'grab'
            : 'crosshair'
        }
      >

        {/* =================================
            LOCAL WALKING STREETS
        ================================= */}

        {streetGeoJSON && (
          <Source
            id="local-walkways"
            type="geojson"
            data={streetGeoJSON}
          >
            <Layer
              id="street-outline"
              type="line"
              paint={{
                'line-color': '#CBBFA9',
                'line-width': 26,
                'line-opacity': 0.82
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round'
              }}
            />

            <Layer
              id="street-base"
              type="line"
              paint={{
                'line-color': '#FBF6EA',
                'line-width': 22,
                'line-opacity': 1
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round'
              }}
            />

            <Layer
              id="street-centre"
              type="line"
              paint={{
                'line-color': '#DCCFB2',
                'line-width': 1,
                'line-dasharray': [2, 5],
                'line-opacity': 0.55
              }}
            />

            <Layer
              id="pedestrian-network"
              type="line"
              paint={{
                'line-color': '#B8A98A',
                'line-width': 2,
                'line-opacity': layers.pedestrian
                  ? 0.6
                  : 0
              }}
            />
          </Source>
        )}

        {/* =================================
            BUILDING SHADOWS
        ================================= */}

        <Source
          id="building-shadows"
          type="geojson"
          data={shadowGeoJSON}
        >
          <Layer
            id="shadows"
            type="fill"
            paint={{
              'fill-color': '#1C3463',

              'fill-opacity': layers.shadows
                ? shadowAlpha
                : 0,

              'fill-opacity-transition': {
                duration: 350
              }
            }}
          />
        </Source>

        {/* =================================
            3D BUILDINGS
        ================================= */}

        <Source
          id="city-buildings"
          type="geojson"
          data={buildingGeoJSON}
        >

          {/* Ordinary buildings */}
          <Layer
            id="ordinary-buildings"
            type="fill-extrusion"
            filter={[
              '!=',
              ['get', 'isBurjKhalifa'],
              true
            ]}
            paint={{
              'fill-extrusion-color':
                timeBuilding[time],

              'fill-extrusion-opacity':
                layers.buildings
                  ? streetMode
                    ? 0.76
                    : 0.95
                  : 0,

              'fill-extrusion-height': [
                '*',
                [
                  'coalesce',
                  [
                    'to-number',
                    ['get', 'height']
                  ],
                  12
                ],
                rise
              ],

              'fill-extrusion-base': 0
            }}
          />

          {/* Burj Khalifa */}
          <Layer
            id="gold-building"
            type="fill-extrusion"
            filter={[
              '==',
              ['get', 'isBurjKhalifa'],
              true
            ]}
            paint={{
              'fill-extrusion-color':
                '#F5B841',

              'fill-extrusion-opacity':
                layers.buildings
                  ? streetMode
                    ? 0.8
                    : 0.98
                  : 0,

              'fill-extrusion-height': [
                '*',
                [
                  'coalesce',
                  [
                    'to-number',
                    ['get', 'height']
                  ],
                  12
                ],
                rise
              ],

              'fill-extrusion-base': 0
            }}
          />
        </Source>

        {/* =================================
            SHORTEST ROUTE
        ================================= */}

        <Source
          id="route-short"
          type="geojson"
          data={shortest}
        >
          <Layer
            id="short-casing"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': '#FFFFFF',
              'line-width': 22,
              'line-opacity':
                shortOpacity * 0.92
            }}
          />

          <Layer
            id="short-line"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': '#F97316',

              'line-width':
                focused === 'shortest'
                  ? 13
                  : 11,

              'line-dasharray': [1.7, 1.3],

              'line-opacity': shortOpacity
            }}
          />
        </Source>

        {/* =================================
            SHADE-AWARE ROUTE
        ================================= */}

        <Source
          id="route-shade"
          type="geojson"
          data={shaded}
        >
          <Layer
            id="shade-casing"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': '#FFFFFF',
              'line-width': 23,
              'line-opacity':
                shadeOpacity * 0.94
            }}
          />

          <Layer
            id="shade-line"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': '#10B981',

              'line-width':
                focused === 'shaded'
                  ? 15
                  : 13,

              'line-opacity': shadeOpacity
            }}
          />
        </Source>

        {/* =================================
            STARTING POINT MARKER
        ================================= */}

        {startNode && (
          <Marker
            longitude={startNode.lng}
            latitude={startNode.lat}
            anchor="bottom"
          >
            <span
              title="Starting point"
              className="origin-pin"
            >
              <span />
            </span>
          </Marker>
        )}

        {/* =================================
            DESTINATION MARKER
        ================================= */}

        {endNode && (
          <Marker
            longitude={endNode.lng}
            latitude={endNode.lat}
            anchor="bottom"
          >
            <span
              title="Destination"
              className="destination-pin"
            >
              <Flag size={15} />
            </span>
          </Marker>
        )}

        {/* =================================
            SHORTEST ROUTE WALKER
        ================================= */}

        {layers.walkers &&
          !streetMode &&
          visibleShortest &&
          routes &&
          (() => {
            const point = getWalkerPoint(
              routes.shortest.coordinates,
              walker
            );

            return point ? (
              <Marker
                longitude={point[1]}
                latitude={point[0]}
              >
                <span className="walker-dot short-walker">
                  <Footprints size={10} />
                </span>
              </Marker>
            ) : null;
          })()}

        {/* =================================
            SHADE-AWARE ROUTE WALKER
        ================================= */}

        {layers.walkers &&
          !streetMode &&
          visibleShaded &&
          routes &&
          (() => {
            const point = getWalkerPoint(
              routes.shaded.coordinates,
              walker
            );

            return point ? (
              <Marker
                longitude={point[1]}
                latitude={point[0]}
              >
                <span className="walker-dot shade-walker">
                  <Footprints size={10} />
                </span>
              </Marker>
            ) : null;
          })()}

      </Map>

      {/* =================================
          MAP ATTRIBUTION
      ================================= */}

      <div className="map-attribution">
        3D geometry (not photo Street View) · MapLibre ·
        © OpenStreetMap contributors where applicable
      </div>

    </div>
  );
}
