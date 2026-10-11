import { ArrowRight, Footprints, Route, Sun, Timer, TrendingDown } from 'lucide-react';
import type { FocusedRoute, RouteComparison, RouteResult, ViewMode } from '../integration/contracts';

const number=(n:number|null|undefined,decimals=0)=> typeof n==='number' && Number.isFinite(n)? n.toLocaleString('en-US',{maximumFractionDigits:decimals,minimumFractionDigits:decimals}) : '—';
const meters=(n:number|undefined)=>n===undefined||!Number.isFinite(n)?'—':n>=1000?`${number(n/1000,2)} km`:`${number(n)} m`;
const minutes=(n:number|undefined)=>n===undefined||!Number.isFinite(n)?'—':`${number(n,1)} min`;
function ExposureStrip({data}:{data:RouteResult}){
  const ratio=data.distanceMeters>0?Math.max(0,Math.min(1,data.sunExposedMeters/data.distanceMeters)):0;
  return <div className="exposure-strip" role="img" aria-label={`${number(ratio*100)}% estimated direct-sun exposure`}>
    {Array.from({length:22},(_,i)=><span key={i} className={i<Math.round(22*ratio)?'sunny':'in-shade'}/>) }
  </div>;
}
interface Props { routes:RouteComparison|null; focused:FocusedRoute; view:ViewMode; calculating:boolean; onFocus:(v:FocusedRoute)=>void; onView:(v:ViewMode)=>void }
function RouteCard({route,kind,focused,calculating,onFocus}:{route:RouteResult;kind:'shortest'|'shaded';focused:FocusedRoute;calculating:boolean;onFocus:(v:FocusedRoute)=>void}) {
  const sunnyPercent=route.distanceMeters>0?route.sunExposedMeters/route.distanceMeters*100:NaN;
  return <button type="button" className={`route-card glass ${kind} ${focused===kind?'focused':''} ${calculating?'calculating':''}`} onClick={()=>onFocus(kind)} aria-pressed={focused===kind}>
    <div className="route-card-heading"><span className={`route-swatch ${kind}`}/><span>{kind==='shortest'?'Shortest route':'Shade-aware route'}</span><ArrowRight size={15}/></div>
    <div className="card-metrics"><div><span>Distance</span><strong>{meters(route.distanceMeters)}</strong></div><div><span>Walk time</span><strong>{minutes(route.walkingMinutes)}</strong></div></div>
    <div className="sun-data"><div><span>In direct sun</span><strong>{Number.isFinite(sunnyPercent)?`${number(sunnyPercent)}%`:'—'}</strong></div><span>{meters(route.sunExposedMeters)} estimated</span></div>
    <ExposureStrip data={route}/>
    <p className="card-footnote">Estimated direct-sun exposure</p>
  </button>;
}
export default function RouteMetrics({routes,focused,view,calculating,onFocus,onView}:Props){
  if(!routes)return null;
  const extraDistance=routes.shaded.distanceMeters-routes.shortest.distanceMeters;
  const extraMinutes=routes.shaded.walkingMinutes-routes.shortest.walkingMinutes;
  const exposureAvoided=routes.shortest.sunExposedMeters-routes.shaded.sunExposedMeters;
  const identical=routes.shortest.coordinates.length===routes.shaded.coordinates.length && routes.shortest.coordinates.every((p,i)=>p.every((v,j)=>v===routes.shaded.coordinates[i]?.[j]));
  return <div className="results" aria-label="Route comparison">
    <div className="route-difference glass">
      <div className="difference-label"><TrendingDown size={15}/><span>Route trade-off</span></div>
      <div className="difference-items">
        <span><Footprints size={13}/> Extra walk <b>{meters(extraDistance)}</b></span>
        <span><Timer size={13}/> Extra time <b>{minutes(extraMinutes)}</b></span>
        <span><Sun size={13}/> Less direct sun <b>{meters(exposureAvoided)}</b></span>
        <span>Reduction <b>{Number.isFinite(routes.exposureReductionPercent)?`${number(routes.exposureReductionPercent,1)}%`:'—'}</b></span>
      </div>
      <p>{identical?'Both routing preferences produce the same path for these conditions.':routes.shortest.sunExposedMeters===0?'No estimated direct-sun exposure on the shortest route, so a percentage reduction cannot be calculated.':`Choosing the shade-aware route adds ${meters(extraDistance)} to your walk and changes estimated direct-sun exposure by ${meters(exposureAvoided)}.`}</p>
    </div>
    <div className="route-view-options glass" role="group" aria-label="Show routes">
      {([['shortest','Shortest'],['both','Both routes'],['shaded','Shade-aware']] as const).map(([v,label])=><button key={v} onClick={()=>onView(v)} aria-pressed={view===v} className={view===v?'active':''}>{label}</button>)}
    </div>
    <div className="route-results-left"><RouteCard kind="shortest" route={routes.shortest} focused={focused} onFocus={onFocus} calculating={calculating}/></div>
    <div className="route-results-right"><RouteCard kind="shaded" route={routes.shaded} focused={focused} onFocus={onFocus} calculating={calculating}/></div>
    {calculating&&<span className="result-status glass"><Route size={14}/> Calculating routes…</span>}
  </div>;
}
