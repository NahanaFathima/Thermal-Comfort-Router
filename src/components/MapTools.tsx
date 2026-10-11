
import { useState } from 'react';

import {
  Layers3,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  Footprints,
  X
} from 'lucide-react';

import type {
  LayerSettings
} from '../integration/contracts';

// Component Props
interface Props {
  layers: LayerSettings;

  onLayer: (
    key: keyof LayerSettings,
    value: boolean
  ) => void;

  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onResetView: () => void;

  onStreetView: () => void;
  streetMode: boolean;

  canFit: boolean;
}

// Map layer options
const layerLabels: [
  keyof LayerSettings,
  string
][] = [
  ['buildings', 'Show buildings'],
  ['shadows', 'Show building shadows'],
  ['shortest', 'Show shortest route'],
  ['shaded', 'Show shade-aware route'],
  ['pedestrian', 'Show pedestrian network'],
  ['walkers', 'Show walker dots']
];

export default function MapTools({
  layers,
  onLayer,
  onZoomIn,
  onZoomOut,
  onFit,
  onResetView,
  onStreetView,
  streetMode,
  canFit
}: Props) {

  const [open, setOpen] = useState(false);

  return (
    <div className="tools-area">

      {/* Main Map Toolbar */}
      <div
        className="map-tools glass"
        role="group"
        aria-label="Map tools"
      >

        {/* Zoom In */}
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={onZoomIn}
        >
          <Plus size={18} />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={onZoomOut}
        >
          <Minus size={18} />
        </button>

        <span
          className="tool-divider"
          aria-hidden="true"
        />

        {/* Fit Complete Route */}
        <button
          type="button"
          title="Fit route"
          aria-label="Fit route"
          onClick={onFit}
          disabled={!canFit}
        >
          <Maximize size={18} />
        </button>

        {/* Walking Perspective */}
        <button
          type="button"
          title={
            streetMode
              ? 'Exit walking perspective'
              : 'Explore route in 3D walking perspective'
          }
          aria-label={
            streetMode
              ? 'Exit walking perspective'
              : 'Street perspective'
          }
          aria-pressed={streetMode}
          onClick={onStreetView}
          disabled={!canFit && !streetMode}
          className={streetMode ? 'active' : ''}
        >
          <Footprints size={18} />
        </button>

        {/* Map Layers */}
        <button
          type="button"
          title="Layers"
          aria-label="Layers"
          aria-expanded={open}
          onClick={() => setOpen(prev => !prev)}
          className={open ? 'active' : ''}
        >
          <Layers3 size={18} />
        </button>

        {/* Reset Map View */}
        <button
          type="button"
          title="Reset map view"
          aria-label="Reset map view"
          onClick={onResetView}
        >
          <RotateCcw size={18} />
        </button>

      </div>

      {/* Layers Popup */}
      {open && (
        <div className="layers-popover glass">

          <div className="panel-header">

            <h2>Map layers</h2>

            <button
              type="button"
              className="icon-button"
              aria-label="Close layers"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>

          </div>

          {/* Layer Visibility Checkboxes */}
          {layerLabels.map(([key, label]) => (

            <label
              className="layer-check"
              key={key}
            >

              <input
                type="checkbox"
                checked={layers[key]}
                onChange={(e) =>
                  onLayer(key, e.target.checked)
                }
              />

              <span>{label}</span>

            </label>

          ))}

        </div>
      )}

    </div>
  );
}
