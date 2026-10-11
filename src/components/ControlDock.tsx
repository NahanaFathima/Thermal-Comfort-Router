import { Clock3, RotateCcw, SlidersHorizontal, Sun } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { TimeSlot } from '../integration/contracts';

const times: {label:string, value:TimeSlot}[] = [{label:'10:00 AM',value:'10'},{label:'1:00 PM',value:'13'},{label:'4:00 PM',value:'16'}];
const preferenceCopy = [
  'Shortest distance', 'Slight shade preference', 'Balanced, favoring distance',
  'Balanced, favoring shade', 'Strong shade preference', 'Highest available shade priority'
];
interface Props { time: TimeSlot; heatAversion: number; onTime: (v:TimeSlot)=>void; onHeat:(v:number)=>void; onReset:()=>void }
export default function ControlDock({time,heatAversion,onTime,onHeat,onReset}:Props) {
  return <section className="dock glass" aria-label="Route preferences">
    <div className="dock-section time-section"><div className="dock-label"><Clock3 size={15}/><span>When are you planning to walk?</span></div>
      <div className="time-options" role="group" aria-label="Departure time">{times.map(t=><button key={t.value} aria-pressed={time===t.value} className={time===t.value?'selected':''} onClick={()=>onTime(t.value)}>{t.label}</button>)}</div>
      <p className="tiny-muted">Selected departure: {times.find(t=>t.value===time)?.label} (Dubai time, UTC+4)</p>
    </div>
    <div className="dock-separator"/>
    <div className="dock-section preference-section"><div className="preference-heading"><div className="dock-label"><SlidersHorizontal size={15}/><span>Shade preference</span></div><span className="preference-number">{heatAversion}/5</span></div>
      <input aria-label="Shade preference" type="range" min="0" max="5" step="1" value={heatAversion} style={{'--progress':`${heatAversion/5*100}%`} as CSSProperties} onChange={e=>onHeat(Number(e.target.value))}/>
      <div className="slider-ends"><span>Shortest distance</span><span>Shade priority</span></div>
      <p className="preference-meaning"><Sun size={13}/>{preferenceCopy[heatAversion]}</p>
      <p className="tiny-muted">Preferences do not guarantee an amount of shade.</p>
      <button className="reset-preferences" onClick={onReset}><RotateCcw size={12}/> Reset preferences</button>
    </div>
  </section>;
}
