/** Sample street edges in geographic space, counting union-shade membership once. */
import { along, bbox, booleanPointInPolygon, length, lineString } from '@turf/turf';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { ExposureSnapshot, GraphEdge } from '../types';

export function sampleEdgeExposure(edge:Pick<GraphEdge,'geometry'>,shadows:FeatureCollection<Polygon|MultiPolygon>,spacingMeters=5):number {
  if(spacingMeters<=0||!Number.isFinite(spacingMeters))throw new Error('Invalid exposure sampling spacing.');
  if(edge.geometry.length<2)throw new Error('Edge requires at least two coordinates.');
  const line=lineString(edge.geometry);
  const total=length(line,{units:'kilometers'})*1000;
  if(!(total>0))throw new Error('Edge geometry has no length.');
  const samples=Math.max(1,Math.ceil(total/spacingMeters));
  const candidates=shadows.features.map(f=>({f,b:bbox(f)}));
  let sunny=0;
  for(let i=0;i<samples;i++){
    const p=along(line,((i+0.5)*total/samples)/1000,{units:'kilometers'});
    const [x,y]=p.geometry.coordinates;
    let shaded=false;
    for(const s of candidates){
      if(x<s.b[0]||x>s.b[2]||y<s.b[1]||y>s.b[3])continue;
      if(booleanPointInPolygon(p,s.f)){shaded=true;break;} // overlapping shadows count once
    }
    if(!shaded)sunny++;
  }
  return Math.min(1,Math.max(0,sunny/samples));
}
export function calculateExposure(edges:GraphEdge[],shadows:FeatureCollection<Polygon|MultiPolygon>):ExposureSnapshot {
  const out:ExposureSnapshot={};
  for(const e of edges)out[e.id]=sampleEdgeExposure(e,shadows);
  return out;
}
