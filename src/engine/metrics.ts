import { EngineError } from '../types';
import type { ExposureSnapshot, GraphNode, RouteResult, RouteComparison } from '../types';
import type { Path } from './routing';

const SPEED_METERS_PER_SECOND=1.25;
const close=(a:[number,number],b:[number,number])=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
export function toResult(path:Path, exposure:ExposureSnapshot, startNode?:GraphNode):RouteResult {
  let distance=0,sun=0;
  const coordinates:[number,number][]=[];
  if(path.edges.length===0&&startNode)coordinates.push([startNode.lat,startNode.lng]);
  for(const edge of path.edges){
    const fraction=exposure[edge.id];
    if(!Number.isFinite(fraction)||fraction<0||fraction>1)throw new EngineError('MISSING_EXPOSURE',`Invalid exposure for ${edge.id}.`);
    distance+=edge.lengthMeters;
    sun+=edge.lengthMeters*fraction;
    for(const [lng,lat] of edge.geometry){
      const p:[number,number]=[lat,lng];
      if(!coordinates.length||!close(coordinates[coordinates.length-1],p))coordinates.push(p);
    }
  }
  return {coordinates,distanceMeters:distance,walkingMinutes:distance/SPEED_METERS_PER_SECOND/60,sunExposedMeters:sun};
}
export function compareRoutes(shortest:RouteResult,shaded:RouteResult):RouteComparison {
  const distance=shortest.distanceMeters,exposure=shortest.sunExposedMeters;
  return {
    shortest,shaded,
    detourPercent:distance>0?100*(shaded.distanceMeters-distance)/distance:0,
    exposureReductionPercent:exposure>0?100*(exposure-shaded.sunExposedMeters)/exposure:null,
  };
}
