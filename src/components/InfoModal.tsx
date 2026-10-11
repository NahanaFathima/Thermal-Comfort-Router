import { useEffect } from 'react';
import { X } from 'lucide-react';
interface Props { type:'how'|'about'; onClose:()=>void }
export default function InfoModal({type,onClose}:Props) {
  useEffect(()=>{ const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose} role="presentation"><section className="info-modal glass" role="dialog" aria-modal="true" aria-label={type==='how'?'How it works':'About Thermal Comfort Router'} onMouseDown={e=>e.stopPropagation()}>
    <div className="panel-header"><h2>{type==='how'?'How it works':'About the project'}</h2><button aria-label="Close" className="icon-button" onClick={onClose}><X size={19}/></button></div>
    {type==='how'? <><ol className="how-steps"><li>Select a starting point and destination on the map.</li><li>Choose when you want to walk: 10 AM, 1 PM, or 4 PM.</li><li>Adjust how strongly you prefer shade.</li><li>Compare walking distance, duration and estimated sunlight exposure.</li></ol><p>Building geometry and estimated shadows are used to estimate direct-sun exposure along each route.</p></>:
      <><p>Thermal Comfort Router compares the shortest pedestrian path with a shade-aware alternative in a selected area of Downtown Dubai near Dubai Mall, Burj Khalifa, and Dubai Opera.</p><p>Only 10 AM, 1 PM, and 4 PM Dubai-time shadow snapshots are supported.</p><p><strong>Limitations:</strong> The application estimates building shade. It does not measure weather, medical heat risk, body temperature, or guarantee cooler conditions.</p></>}
  </section></div>;
}
