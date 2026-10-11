
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import type { FeatureCollection } from 'geojson';

import {
  AlertCircle,
  RefreshCcw
} from 'lucide-react';

import {
  engine,
  getOptionalPedestrianGeoJSON,
  getEngineProvenance
} from './integration/engineAdapter';

import type {
  FocusedRoute,
  GraphNode,
  LayerSettings,
  RouteComparison,
  TimeSlot,
  ViewMode
} from './integration/contracts';

import SkylineHeader from './components/SkylineHeader';
import LoadingState from './components/LoadingState';
import RouteControls from './components/RouteControls';
import ControlDock from './components/ControlDock';

import MapView, {
  type MapViewHandle
} from './components/MapView';

import MapTools from './components/MapTools';
import RouteMetrics from './components/RouteMetrics';
import MapLegend from './components/MapLegend';
import StreetNavigator from './components/StreetNavigator';
import InfoModal from './components/InfoModal';

import Toast, {
  type ToastData
} from './components/Toast';

// Empty GeoJSON
const EMPTY: FeatureCollection = {
  type: 'FeatureCollection',
  features: []
};

// Default map layers
const INITIAL_LAYERS: LayerSettings = {
  buildings: true,
  shadows: true,
  shortest: true,
  shaded: true,
  pedestrian: false,
  walkers: true
};

// Check whether intro was already shown
const hasSeenIntro = () => {
  try {
    return (
      sessionStorage.getItem('tcr-skyline-seen') === '1'
    );
  } catch {
    return false;
  }
};

// Mark intro as seen
const markIntroSeen = () => {
  try {
    sessionStorage.setItem('tcr-skyline-seen', '1');
  } catch {
    // Session storage is optional
  }
};

let toastId = 0;

export default function App() {

  // ========================================
  // APPLICATION STATES
  // ========================================

  const [status, setStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');

  const [
    syntheticGeography,
    setSyntheticGeography
  ] = useState(true);

  const [showIntro, setShowIntro] = useState(
    () => !hasSeenIntro()
  );

  // Geographic data
  const [nodes, setNodes] = useState<GraphNode[]>([]);

  const [buildings, setBuildings] =
    useState<FeatureCollection>(EMPTY);

  const [shadows, setShadows] =
    useState<FeatureCollection>(EMPTY);

  const [streets, setStreets] =
    useState<FeatureCollection | null>(null);

  // Starting point and destination
  const [start, setStart] = useState<string | null>(null);

  const [end, setEnd] = useState<string | null>(null);

  const [active, setActive] = useState<
    'start' | 'end' | null
  >(null);

  // Departure time and shade preference
  const [time, setTime] = useState<TimeSlot>('13');

  const [heat, setHeat] = useState(3);

  // Routing results
  const [routes, setRoutes] =
    useState<RouteComparison | null>(null);

  const [calculating, setCalculating] = useState(false);

  const [focused, setFocused] =
    useState<FocusedRoute>(null);

  const [view, setView] = useState<ViewMode>('both');

  // ========================================
  // WALKING PERSPECTIVE STATES
  // ========================================

  const [streetMode, setStreetMode] = useState(false);

  const [streetStep, setStreetStep] = useState(0);

  const [streetRoute, setStreetRoute] = useState<
    'shortest' | 'shaded'
  >('shaded');

  // Track last pair fitted to the map
  const lastFittedPair = useRef('');

  // Map visibility settings
  const [layers, setLayers] =
    useState<LayerSettings>(INITIAL_LAYERS);

  // Planner collapse state
  const [
    plannerCollapsed,
    setPlannerCollapsed
  ] = useState(
    () => window.matchMedia('(max-width: 900px)').matches
  );

  // Modals
  const [modal, setModal] = useState<
    'how' | 'about' | null
  >(null);

  // Toast notifications
  const [toast, setToast] =
    useState<ToastData | null>(null);

  // Map reference
  const mapHandle = useRef<MapViewHandle | null>(null);

  // Request tracking
  const seq = useRef(0);
  const loadSeq = useRef(0);

  // ========================================
  // TOAST MESSAGES
  // ========================================

  const notify = useCallback((
    message: string,
    variant: ToastData['variant'] = 'info',
    persistent = false
  ) => {

    setToast({
      id: ++toastId,
      message,
      variant,
      persistent
    });

  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  // ========================================
  // LOAD GEOGRAPHIC DATA
  // ========================================

  const load = useCallback(async () => {

    const id = ++loadSeq.current;

    setStatus('loading');

    try {

      await engine.loadDemoData();

      if (id !== loadSeq.current) return;

      const graph = engine.getGraphNodes();

      if (!graph.length) {
        throw new Error(
          'The pedestrian graph contains no nodes.'
        );
      }

      setNodes(graph);

      setSyntheticGeography(
        getEngineProvenance().isSynthetic
      );

      setBuildings(engine.getBuildingGeoJSON());

      setStreets(getOptionalPedestrianGeoJSON());

      setShadows(engine.getShadowGeoJSON('13'));

      setStatus('ready');

    } catch (error) {

      if (id !== loadSeq.current) return;

      setStatus('error');
      setRoutes(null);

      notify(
        error instanceof Error
          ? `Unable to load geographic data: ${error.message}`
          : 'Unable to load geographic data.',
        'error',
        true
      );

    }

  }, [notify]);

  // Load data when application starts
  useEffect(() => {
    void load();
  }, [load]);

  // ========================================
  // UPDATE SHADOWS WHEN TIME CHANGES
  // ========================================

  useEffect(() => {

    if (status !== 'ready') return;

    try {

      setShadows(engine.getShadowGeoJSON(time));

    } catch {

      setShadows(EMPTY);

      notify(
        'Shade information unavailable for this time.',
        'warning'
      );

    }

  }, [time, status, notify]);

  // ========================================
  // CALCULATE ROUTES
  // ========================================

  useEffect(() => {

    const id = ++seq.current;

    if (
      status !== 'ready' ||
      !start ||
      !end ||
      start === end
    ) {

      setRoutes(null);
      setCalculating(false);
      return;

    }

    setCalculating(true);

    const timeout = window.setTimeout(() => {

      if (id !== seq.current) return;

      try {

        const result = engine.getRouteComparison({
          startNodeId: start,
          endNodeId: end,
          time,
          heatAversion: heat
        });

        if (
          !result.shortest?.coordinates?.length ||
          !result.shaded?.coordinates?.length
        ) {

          throw new Error(
            'No pedestrian route found between these locations.'
          );

        }

        if (id === seq.current) {
          setRoutes(result);
        }

      } catch (error) {

        if (id !== seq.current) return;

        setRoutes(null);

        notify(
          error instanceof Error
            ? error.message
            : 'No pedestrian route found between these locations.',
          'error'
        );

      } finally {

        if (id === seq.current) {
          setCalculating(false);
        }

      }

    }, 160);

    return () => {
      window.clearTimeout(timeout);
    };

  }, [
    status,
    start,
    end,
    time,
    heat,
    notify
  ]);

  // ========================================
  // AUTOMATICALLY FIT ROUTE ON MAP
  // ========================================

  useEffect(() => {

    if (
      !routes ||
      !start ||
      !end ||
      streetMode
    ) return;

    const pair = `${start}|${end}`;

    // Do not recenter on every slider change
    if (pair === lastFittedPair.current) return;

    lastFittedPair.current = pair;

    const timer = window.setTimeout(() => {

      mapHandle.current?.fitRoute();

    }, 140);

    return () => {
      window.clearTimeout(timer);
    };

  }, [
    routes,
    start,
    end,
    streetMode
  ]);

  // ========================================
  // GRAPH NODE LOOKUP
  // ========================================

  const nodeMap = useMemo(() => {

    return new Map(
      nodes.map(node => [node.id, node])
    );

  }, [nodes]);

  // ========================================
  // SELECT START OR DESTINATION FIELD
  // ========================================

  const setField = useCallback((
    which: 'start' | 'end' | null
  ) => {

    setActive(which);

    if (which) {

      notify(
        `Click on the map to choose your ${
          which === 'start'
            ? 'starting point'
            : 'destination'
        }.`
      );

    }

  }, [notify]);

  // ========================================
  // MAP CLICK - LOCATION SELECTION
  // ========================================

  const handleMapSelect = useCallback((
    lat: number,
    lng: number
  ) => {

    if (status !== 'ready' || streetMode) return;

    const point = engine.findNearestNode(lat, lng);

    if (!point) {

      notify(
        'No walkable location found nearby.',
        'warning'
      );

      return;

    }

    const target =
      active ??
      (!start ? 'start' : !end ? 'end' : null);

    if (!target) return;

    const other =
      target === 'start' ? end : start;

    if (point === other) {

      notify(
        'Choose two different locations.',
        'warning'
      );

      return;

    }

    if (target === 'start') {

      setStart(point);

    } else {

      setEnd(point);

    }

    setActive(null);

    setFocused(null);
    setView('both');

  }, [
    active,
    start,
    end,
    status,
    streetMode,
    notify
  ]);

  // ========================================
  // TRY DEMO ROUTE
  // ========================================

  const tryDemo = useCallback(() => {

    if (status !== 'ready') return;

    try {

      const pair = engine.getDefaultEndpoints();

      if (
        pair.startNodeId === pair.endNodeId ||
        !nodeMap.has(pair.startNodeId) ||
        !nodeMap.has(pair.endNodeId)
      ) {

        throw new Error('Demo endpoints are invalid.');

      }

      setStreetMode(false);
      setStreetStep(0);

      setStart(pair.startNodeId);
      setEnd(pair.endNodeId);

      setActive(null);

      setFocused(null);
      setView('both');

      lastFittedPair.current = '';

      notify(
        'Demo route loaded. Change the time or shade preference to compare.',
        'success'
      );

    } catch {

      notify(
        'Unable to load demo route.',
        'error'
      );

    }

  }, [
    status,
    nodeMap,
    notify
  ]);

  // ========================================
  // RESET ROUTE
  // ========================================

  const resetRoute = useCallback(() => {

    setStreetMode(false);
    setStreetStep(0);

    lastFittedPair.current = '';

    setStart(null);
    setEnd(null);

    setActive(null);

    setRoutes(null);

    setFocused(null);

    setView('both');

  }, []);

  // ========================================
  // SWAP LOCATIONS
  // ========================================

  const swap = useCallback(() => {

    setStreetMode(false);
    setStreetStep(0);

    setStart(end);
    setEnd(start);

    setFocused(null);
    setView('both');

    setActive(null);

    lastFittedPair.current = '';

  }, [start, end]);

  // ========================================
  // MAP LAYER VISIBILITY
  // ========================================

  const setLayer = useCallback((
    key: keyof LayerSettings,
    value: boolean
  ) => {

    setLayers(previous => ({
      ...previous,
      [key]: value
    }));

  }, []);

  // ========================================
  // RESET PREFERENCES
  // ========================================

  const resetPrefs = useCallback(() => {

    setTime('13');
    setHeat(3);

  }, []);

  // ========================================
  // FOCUS A ROUTE
  // ========================================

  const focusRoute = useCallback((
    target: FocusedRoute
  ) => {

    setFocused(target);

    if (target) {

      setView('both');

      if (streetMode) {
        setStreetRoute(target);
      }

    }

  }, [streetMode]);

  // ========================================
  // CHANGE ROUTE VIEW
  // ========================================

  const changeView = useCallback((
    next: ViewMode
  ) => {

    setView(next);
    setFocused(null);

  }, []);

  // ========================================
  // COMPLETE INTRO
  // ========================================

  const completeIntro = useCallback(() => {

    markIntroSeen();

    setShowIntro(false);

  }, []);

  // ========================================
  // WALKING PERSPECTIVE TOGGLE
  // ========================================

  const toggleStreetView = useCallback(() => {

    if (!routes) return;

    // Exit walking perspective
    if (streetMode) {

      setStreetMode(false);
      return;

    }

    // Enter walking perspective
    setView('both');

    setStreetRoute(
      focused === 'shortest'
        ? 'shortest'
        : 'shaded'
    );

    setStreetStep(0);

    setStreetMode(true);

  }, [
    routes,
    streetMode,
    focused
  ]);

  // ========================================
  // RESET MAP CAMERA
  // ========================================

  const resetMapView = useCallback(() => {

    if (streetMode) {

      setStreetMode(false);

      window.setTimeout(() => {
        mapHandle.current?.resetView();
      }, 160);

    } else {

      mapHandle.current?.resetView();

    }

  }, [streetMode]);

  // ========================================
  // MAIN APPLICATION UI
  // ========================================

  return (

    <div
      className={`app-shell ${
        streetMode ? 'street-active' : ''
      }`}
    >

      {/* =====================================
          INTERACTIVE 3D MAP
      ===================================== */}

      <MapView
        mapRef={mapHandle}
        buildingGeoJSON={buildings}
        shadowGeoJSON={shadows}
        streetGeoJSON={streets}

        startNode={
          start
            ? nodeMap.get(start) ?? null
            : null
        }

        endNode={
          end
            ? nodeMap.get(end) ?? null
            : null
        }

        routes={routes}
        layers={layers}
        time={time}
        view={view}
        focused={focused}

        onMapSelect={handleMapSelect}
        onFocus={focusRoute}

        activeSelection={active !== null}

        // Walking perspective
        streetMode={streetMode}
        streetStep={streetStep}
        streetRoute={streetRoute}
      />

      {/* =====================================
          SKYLINE HEADER
      ===================================== */}

      <SkylineHeader
        time={time}
        onHow={() => setModal('how')}
        onAbout={() => setModal('about')}
      />

      {/* =====================================
          SYNTHETIC DATA WARNING
      ===================================== */}

      {syntheticGeography && (

        <div
          className="demo-disclosure"
          role="status"
        >

          <AlertCircle size={13} />

          <span>
            SYNTHETIC TEST GEOGRAPHY ·
            Shadow exposure and routes are calculated
            on illustrative paths, NOT verified Dubai
            streets. Run real OSM extraction before
            public demo.
          </span>

        </div>

      )}

      {/* =====================================
          ROUTE PLANNER
      ===================================== */}

      <RouteControls
        start={start}
        end={end}
        nodes={nodes}
        active={active}
        collapsed={plannerCollapsed}

        onSelectField={setField}
        onCollapsed={setPlannerCollapsed}

        onSwap={swap}
        onReset={resetRoute}
        onDemo={tryDemo}
      />

      {/* =====================================
          MAP TOOLS
      ===================================== */}

      <MapTools
        layers={layers}
        onLayer={setLayer}

        onZoomIn={() => {
          mapHandle.current?.zoomIn();
        }}

        onZoomOut={() => {
          mapHandle.current?.zoomOut();
        }}

        onFit={() => {
          mapHandle.current?.fitRoute();
        }}

        onResetView={resetMapView}

        // Walking perspective button
        onStreetView={toggleStreetView}
        streetMode={streetMode}

        canFit={!!routes}
      />

      {/* =====================================
          MAP LEGEND
      ===================================== */}

      <MapLegend />

      {/* =====================================
          WALKING PERSPECTIVE NAVIGATION
      ===================================== */}

      {streetMode && routes && (

        <StreetNavigator
          step={streetStep}
          route={streetRoute}

          onStep={setStreetStep}

          onRoute={(selectedRoute) => {

            setStreetRoute(selectedRoute);

            setFocused(selectedRoute);

          }}

          onExit={() => {

            setStreetMode(false);

          }}
        />

      )}

      {/* =====================================
          TIME AND SHADE PREFERENCE
      ===================================== */}

      <ControlDock
        time={time}
        heatAversion={heat}

        onTime={setTime}
        onHeat={setHeat}

        onReset={resetPrefs}
      />

      {/* =====================================
          ROUTE COMPARISON
      ===================================== */}

      {routes && (

        <RouteMetrics
          routes={routes}

          focused={focused}
          view={view}

          calculating={calculating}

          onFocus={focusRoute}
          onView={changeView}
        />

      )}

      {/* =====================================
          DATA LOADING ERROR
      ===================================== */}

      {status === 'error' && !showIntro && (

        <div
          className="blocking-error glass"
          role="alert"
        >

          <AlertCircle size={18} />

          <span>
            Unable to load geographic data.
          </span>

          <button
            className="gold-button"
            onClick={() => {

              setToast(null);

              void load();

            }}
          >

            <RefreshCcw size={16} />

            Retry

          </button>

        </div>

      )}

      {/* =====================================
          LOADING STATE
      ===================================== */}

      {status === 'loading' && !showIntro && (

        <div
          className="blocking-error glass"
          role="status"
        >

          Loading map data…

        </div>

      )}

      {/* =====================================
          TOAST NOTIFICATIONS
      ===================================== */}

      <Toast
        toast={toast}
        dismiss={dismiss}
      />

      {/* =====================================
          INFO MODALS
      ===================================== */}

      {modal && (

        <InfoModal
          type={modal}
          onClose={() => setModal(null)}
        />

      )}

      {/* =====================================
          SKYLINE LOADING INTRO
      ===================================== */}

      {showIntro && (

        <LoadingState
          status={status}

          onFinish={completeIntro}

          onRetry={() => {

            setToast(null);

            void load();

          }}
        />

      )}

    </div>

  );

}
