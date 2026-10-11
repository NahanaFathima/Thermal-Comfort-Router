import { CircleDot, MapPin } from 'lucide-react';
export default function MapLegend() {
  return <div className="map-legend glass" aria-label="Map legend">
    <div><i className="legend-line shortest"/> Shortest route</div>
    <div><i className="legend-line shaded"/> Shade-aware route</div>
    <div><i className="legend-box shadow"/> Building shadow</div>
    <div><CircleDot size={12} color="#38BDF8"/> Origin <MapPin size={12} color="#F5B841" className="legend-destination"/> Destination</div>
  </div>;
}
