/** Browser API. All geographic datasets are precomputed files; no live HTTP APIs. */
import type { FeatureCollection } from 'geojson';
import { EngineError } from '../types';
import type { ExposureSnapshot, GraphData, GraphNode, RouteComparison, RouteOptions, TimeSlot } from '../types';
import { PedestrianGraph } from './routing';
import { compareRoutes,toResult } from './metrics';

const SLOTS:TimeSlot[]=['10','13','16'];
let graphData:GraphData|undefined;
let graph:PedestrianGraph|undefined;
let buildings:FeatureCollection|undefined;
let shadows:Partial<Record<TimeSlot,FeatureCollection>>={};
let exposure:Partial<Record<TimeSlot,ExposureSnapshot>>={};
let loading:Promise<void>|undefined;
const routeCache=new Map<string,RouteComparison>();
const base=()=>((import.meta as ImportMeta & {env?:{BASE_URL?:string}}).env?.BASE_URL??'/').replace(/\/?$/,'/');
async function fetchJSON<T>(filename:string):Promise<T> {
  const res=await fetch(`${base()}data/${filename}`);
  if(!res.ok)throw new EngineError('DATA_ERROR',`Unable to load data/${filename}: HTTP ${res.status}.`);
  try{return await res.json() as T;}catch{throw new EngineError('DATA_ERROR',`Invalid JSON in data/${filename}.`);}
}
function checkExposure(edges:GraphData['edges'],data:ExposureSnapshot,slot:string):void {
  for(const e of edges){const x=data[e.id];if(!Number.isFinite(x)||x<0||x>1)throw new EngineError('MISSING_EXPOSURE',`Missing/invalid exposure for ${e.id}, ${slot}.`);}
}
export async function loadDemoData():Promise<void> {
  if(graphData&&graph)return;
  if(loading)return loading;
  loading=(async()=>{
    const [newGraph,newBuildings]=await Promise.all([
      fetchJSON<GraphData>('graph.json'),fetchJSON<FeatureCollection>('buildings.geojson')
    ]);
    const snapshots=await Promise.all(SLOTS.map(async slot=>({
      slot, shadow:await fetchJSON<FeatureCollection>(`shadows-${slot}00.geojson`),
      edgeExposure:await fetchJSON<ExposureSnapshot>(`exposure-${slot}00.json`)
    })));
    // Commit state only after every required file has loaded and passed validation.
    const newRuntime=new PedestrianGraph(newGraph);
    if(newBuildings.type!=='FeatureCollection')throw new EngineError('DATA_ERROR','Building data is not a FeatureCollection.');
    const nextShadows:Partial<Record<TimeSlot,FeatureCollection>>={},nextExposure:Partial<Record<TimeSlot,ExposureSnapshot>>={};
    for(const {slot,shadow,edgeExposure} of snapshots){
      if(shadow.type!=='FeatureCollection')throw new EngineError('DATA_ERROR',`Invalid shadows for ${slot}.`);
      checkExposure(newGraph.edges,edgeExposure,slot);
      nextShadows[slot]=shadow;nextExposure[slot]=edgeExposure;
    }
    graphData=newGraph;graph=newRuntime;buildings=newBuildings;shadows=nextShadows;exposure=nextExposure;routeCache.clear();
  })().catch(err=>{loading=undefined;throw err;});
  return loading;
}
function ready():{data:GraphData;graph:PedestrianGraph} {
  if(!graphData||!graph)throw new EngineError('NOT_READY','Call loadDemoData() before accessing route data.');
  return {data:graphData,graph};
}
export function getGraphNodes():GraphNode[]{return ready().data.nodes;}
export function getDefaultEndpoints():{startNodeId:string;endNodeId:string}{return ready().data.defaultEndpoints;}
export function getBuildingGeoJSON():FeatureCollection{ready();return buildings!;}
export function getShadowGeoJSON(time:TimeSlot):FeatureCollection {
  ready();if(!shadows[time])throw new EngineError('DATA_ERROR',`Shade information unavailable for ${time}:00.`);
  return shadows[time]!;
}
export function getDataProvenance(){return ready().data.metadata;}
export function findNearestNode(lat:number,lng:number):string|null {
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  const {data}=ready();let nearest:string|null=null,min=Infinity;
  const earth=6371009,phi=lat*Math.PI/180;
  for(const n of data.nodes){
    const dx=(n.lng-lng)*Math.PI/180*earth*Math.cos(phi);
    const dy=(n.lat-lat)*Math.PI/180*earth;
    const d=dx*dx+dy*dy;
    if(d<min){min=d;nearest=n.id;}
  }
  return min<=100*100?nearest:null;
}
export function getRouteComparison(options:RouteOptions):RouteComparison {
  const {graph}=ready();
  if(!SLOTS.includes(options.time))throw new EngineError('INVALID_INPUT','Unsupported departure time.');
  const ex=exposure[options.time];if(!ex)throw new EngineError('MISSING_EXPOSURE','Shade information unavailable for this time.');
  const {startNodeId,endNodeId,heatAversion}=options;
  if(startNodeId===endNodeId)throw new EngineError('INVALID_INPUT','Choose two different locations.');
  const key=`${startNodeId}|${endNodeId}|${options.time}|${heatAversion}`;
  const hit=routeCache.get(key);if(hit)return hit;
  const start=graph.nodes.get(startNodeId);
  const shortest=toResult(graph.dijkstra(startNodeId,endNodeId,ex,0),ex,start);
  const shaded=toResult(graph.dijkstra(startNodeId,endNodeId,ex,heatAversion),ex,start);
  const result=compareRoutes(shortest,shaded);
  if(routeCache.size>256)routeCache.clear();routeCache.set(key,result);
  return result;
}
/** Optional visualization helper, derived solely from real graph geometries. */
export function getPedestrianGeoJSON():FeatureCollection {
  const {data}=ready();
  return {type:'FeatureCollection',features:data.edges.map(e=>({
    type:'Feature',properties:{id:e.id},geometry:{type:'LineString',coordinates:e.geometry}
  }))} as FeatureCollection;
}
