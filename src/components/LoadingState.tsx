import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Status = 'loading' | 'ready' | 'error';
interface Props { status: Status; onFinish: () => void; onRetry: () => void }
const towers = [{x:10,y:118,w:24,h:67},{x:40,y:95,w:30,h:90},{x:79,y:111,w:34,h:74},
  {x:125,y:74,w:31,h:111},{x:164,y:102,w:25,h:83},{x:335,y:103,w:30,h:82},
  {x:373,y:86,w:30,h:99},{x:413,y:115,w:32,h:70},{x:455,y:91,w:27,h:94}];
export default function LoadingState({ status, onFinish, onRetry }: Props) {
  const [skipped, setSkipped] = useState(false);
  const [phase, setPhase] = useState<'build'|'finale'|'fade'>('build');
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setMinElapsed(true), 1500); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (status !== 'ready') return;
    if (skipped) { onFinish(); return; }
    if (!minElapsed) return;
    setPhase('finale');
    const fade = window.setTimeout(() => setPhase('fade'), 1200);
    const end = window.setTimeout(onFinish, 2100);
    return () => { clearTimeout(fade); clearTimeout(end); };
  }, [status, skipped, minElapsed, onFinish]);
  if (skipped && status === 'loading') return <div className="intro intro-plain" role="status"><div className="small-spinner"/><p>Loading map data…</p></div>;
  return <div className={`intro intro-${phase} ${status === 'error' ? 'intro-error' : ''}`} role={status==='error' ? 'alert' : 'status'}>
    <div className="intro-content">
      <svg viewBox="0 0 500 214" className="intro-city" aria-hidden="true">
        <line x1="0" y1="185" x2="500" y2="185" stroke="#52617A" strokeWidth="2"/>
        <circle className="intro-sun" cx="250" cy="137" r="36" fill="#F5B841" />
        {towers.map((b,i) => <g key={i} className="intro-tower" style={{animationDelay:`${i*.1}s`}}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#26334A"/>
          {Array.from({length: Math.floor(b.h/18)}, (_,j)=><rect key={j} x={b.x+6} y={b.y+10+j*17} width="3" height="4" fill="#F5B841" opacity=".3"/>)}
        </g>)}
        <path className="intro-burj" d="M227 185 L227 100 L234 100 L234 77 L241 77 L245 53 L250 0 L255 53 L259 77 L266 77 L266 100 L273 100 L273 185 Z" fill="#3A4C6B" stroke="#F5B841" strokeWidth="1"/>
      </svg>
      <div className="intro-heading">THERMAL<br/><span>COMFORT ROUTER</span></div>
      <p className="intro-message">{status === 'error' ? "We couldn't map the city." : 'Mapping shade across Downtown Dubai…'}</p>
      {status === 'error' && <><p className="intro-subtitle">Unable to load geographic data.</p><button className="gold-button" onClick={onRetry}><RefreshCw size={16}/> Retry</button></>}
      {status === 'loading' && <span className="intro-subtitle">Loading map data…</span>}
    </div>
    {status !== 'error' && <button className="skip-intro" onClick={() => setSkipped(true)}>Skip intro</button>}
  </div>;
}
