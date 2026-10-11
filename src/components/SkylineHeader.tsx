import { CircleHelp, Info } from 'lucide-react';
import type { TimeSlot } from '../integration/contracts';

const sky: Record<TimeSlot, [string, string, number, number]> = {
  '10': ['#FDE9B8', '#BFD8F2', 22, 35],
  '13': ['#FFF6D6', '#CFE6FA', 50, 16],
  '16': ['#F8C27A', '#E9967A', 80, 34]
};
function pseudo(seed: number) {
  let n = (seed * 1664525 + 1013904223) >>> 0;
  return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 2 ** 32; };
}
const random = pseudo(12741);
const skyline = Array.from({ length: 35 }, (_, i) => {
  const w = 21 + Math.round(random() * 16);
  const h = 32 + Math.round(random() * 68);
  return { x: i * 36 - 10, width: w, height: h, windows: Math.ceil(h / 16) };
});

interface Props { time: TimeSlot; onHow: () => void; onAbout: () => void }
export default function SkylineHeader({ time, onHow, onAbout }: Props) {
  const [top, bottom, left, y] = sky[time];
  return <header className="skyline-header" style={{ background: `linear-gradient(180deg,${top},${bottom})` }}>
    <div className="skyline-sun" aria-hidden="true" style={{ left: `${left}%`, top: y }}/>
    <svg className="header-city" viewBox="0 0 1200 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g fill="rgba(11,20,38,.28)">{skyline.map((b,i) => <rect key={`back-${i}`} x={b.x + 16} y={150 - b.height * .8} width={b.width} height={b.height} />)}</g>
      <g fill="#0B1426">
        {skyline.map((b,i) => <g key={i}>
          <rect x={b.x} y={150-b.height} width={b.width} height={b.height}/>
          {Array.from({ length: Math.floor(b.width / 9) * b.windows }, (_, j) => {
            const col = j % Math.floor(b.width / 9);
            const row = Math.floor(j / Math.floor(b.width / 9));
            return <rect key={j} x={b.x + 5 + col * 9} y={150-b.height+8+row*14} width="3" height="4" fill="#F5B841" opacity={((i*7 + j*13)%7+2)/12}/>;
          })}
        </g>)}
      </g>
      <path d="M579 150 L579 74 L585 74 L585 51 L592 51 L596 25 L600 0 L604 25 L608 51 L615 51 L615 74 L621 74 L621 150 Z" fill="#0B1426" stroke="#F5B841" strokeWidth="1.2" />
    </svg>
    <div className="brand-copy"><h1>Thermal Comfort Router</h1><p>Downtown Dubai <span aria-hidden="true">·</span> Estimated building shade</p></div>
    <div className="header-actions">
      <button type="button" onClick={onHow} className="header-action"><Info size={15}/> How it works</button>
      <button type="button" onClick={onAbout} className="header-action"><CircleHelp size={15}/> About</button>
    </div>
  </header>;
}
