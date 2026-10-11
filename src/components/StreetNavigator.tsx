
import {
  ArrowLeft,
  ArrowRight,
  Footprints,
  Map as MapIcon,
  X
} from 'lucide-react';

import type { FocusedRoute } from '../integration/contracts';

interface Props {
  step: number;
  route: Exclude<FocusedRoute, null>;
  onStep: (step: number) => void;
  onRoute: (route: Exclude<FocusedRoute, null>) => void;
  onExit: () => void;
}

export default function StreetNavigator({
  step,
  route,
  onStep,
  onRoute,
  onExit
}: Props) {
  return (
    <section
      className="street-navigator glass"
      aria-label="Street perspective route navigation"
    >
      <div className="street-nav-heading">
        <span>
          <Footprints size={16} />
          Walking perspective
          <small>3D streets, not photographs</small>
        </span>

        <button
          className="street-exit"
          onClick={onExit}
        >
          <X size={17} />
          Exit
        </button>
      </div>

      <div
        className="street-nav-options"
        role="group"
        aria-label="Route to follow"
      >
        <button
          className={
            route === 'shortest'
              ? 'selected shortest'
              : ''
          }
          onClick={() => {
            onRoute('shortest');
            onStep(0);
          }}
        >
          Shortest route
        </button>

        <button
          className={
            route === 'shaded'
              ? 'selected shaded'
              : ''
          }
          onClick={() => {
            onRoute('shaded');
            onStep(0);
          }}
        >
          Shade-aware route
        </button>
      </div>

      <div className="street-steps">
        <button
          onClick={() => onStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft size={16} />
          Previous
        </button>

        <div className="street-step-readout">
          <MapIcon size={13} />
          {Math.round((step / 20) * 100)}%
          of route
        </div>

        <button
          onClick={() => onStep(Math.min(19, step + 1))}
          disabled={step >= 19}
        >
          Next
          <ArrowRight size={16} />
        </button>
      </div>

      <input
        type="range"
        aria-label="Position along walking route"
        min="0"
        max="19"
        step="1"
        value={step}
        onChange={(e) =>
          onStep(Number(e.target.value))
        }
      />
    </section>
  );
}
