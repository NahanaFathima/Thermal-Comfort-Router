import { ArrowDownUp, ChevronDown, CircleDot, MapPin, RotateCcw, Sparkles } from 'lucide-react';
import type { GraphNode } from '../integration/contracts';

type Field = 'start' | 'end' | null;
interface Props {
  start: string | null; end: string | null;
  nodes: GraphNode[]; active: Field; collapsed: boolean;
  onSelectField: (field: Field) => void; onCollapsed: (value: boolean) => void;
  onSwap: () => void; onReset: () => void; onDemo: () => void;
}
export default function RouteControls({ start,end,nodes,active,collapsed,onSelectField,onCollapsed,onSwap,onReset,onDemo }: Props) {
  const nodeName = (id: string | null, fallback: string) => {
    if (!id) return fallback;
    const node = nodes.find(n=>n.id===id);
    return node ? `Dropped pin · ${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}` : 'Dropped pin';
  };
  if (collapsed) return <div className="planner-mini glass"><button className="planner-mini-btn" onClick={()=>onCollapsed(false)}><MapPin size={17}/> Plan route <ChevronDown size={16}/></button></div>;
  return <section className="planner glass" aria-label="Route planner">
    <div className="panel-header"><div><div className="eyebrow">YOUR JOURNEY</div><h2>Plan a walk</h2></div><button className="icon-button" aria-label="Collapse route planner" onClick={()=>onCollapsed(true)}><ChevronDown className="rotate-up" size={17}/></button></div>
    <div className="location-fields">
      <button className={`location-field ${active==='start'?'selected':''}`} onClick={()=>onSelectField('start')}>
        <CircleDot size={19} className="origin-field-icon"/><span><small>Starting point</small><strong>{nodeName(start,'Select on map')}</strong></span>
      </button>
      <div className="swap-line"><button className="swap-button" title="Swap locations" aria-label="Swap locations" onClick={onSwap} disabled={!start&&!end}><ArrowDownUp size={15}/></button></div>
      <button className={`location-field ${active==='end'?'selected':''}`} onClick={()=>onSelectField('end')}>
        <MapPin size={19} className="destination-field-icon"/><span><small>Destination</small><strong>{nodeName(end,'Select on map')}</strong></span>
      </button>
    </div>
    <div className="planner-hint">{active === 'start' ? 'Click on the map to choose your starting point.' : active === 'end' ? 'Click on the map to choose your destination.' : !start ? 'Select your starting point on the map.' : !end ? 'Select your destination.' : 'Change either point or compare your routes below.'}</div>
    <div className="planner-buttons"><button className="gold-button" onClick={onDemo}><Sparkles size={15}/> Try demo route</button><button className="secondary-button" onClick={onReset}><RotateCcw size={15}/> Reset route</button></div>
  </section>;
}
