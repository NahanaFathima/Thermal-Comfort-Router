/** Run after python scripts/export_osm.py (or on a clearly labeled synthetic graph).
 * Requires npm install suncalc@^2 @turf/turf@^7. No network access after install.
 * Generates three solar/shadow snapshots + exposure fractions, not fake routes.
 */
import * as SunCalc from 'suncalc';
import * as turf from '@turf/turf';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const dataDir=resolve(process.cwd(),'public/data');
const DEMO_DATE=process.env.DEMO_DATE??'2026-10-11';
const CENTER=[25.195,55.278];
const TIMES={'10':'10:00','13':'13:00','16':'16:00'};
const graph=JSON.parse(await readFile(`${dataDir}/graph.json`,'utf8'));
const buildings=JSON.parse(await readFile(`${dataDir}/buildings.geojson`,'utf8'));
function getHeight(props={}){
  const x=props.heightMeters??props.height;
  let n=NaN;
  if(typeof x==='number')n=x;
  else if(typeof x==='string'){
    const m=x.trim().match(/^([\d.]+)\s*(m|metres?|meters?|ft|feet|')?$/i);
    if(m){n=Number(m[1]);if(/^(ft|feet|')$/i.test(m[2]??''))n*=0.3048;}
  }
  if(n>0&&Number.isFinite(n))return {height:n,source:['explicit','levels','fallback'].includes(props.heightSource)?props.heightSource:'explicit'};
  const levels=Number(props['building:levels']);
  if(levels>0&&Number.isFinite(levels))return {height:levels*3.2,source:'levels'};
  return {height:15,source:'fallback'};
}
function shadowsAt(position){
  const features=[];
  if(position.altitude<=1)return turf.featureCollection(features);
  for(const f of buildings.features){
    if(!['Polygon','MultiPolygon'].includes(f.geometry.type))continue;
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    const {height,source}=getHeight(f.properties);
    const shadowMeters=Math.min(1000,height/Math.tan(position.altitude*Math.PI/180));
    const bearing=(position.azimuth+180)%360;
    for(const rings of polys){
      const points=[];
      for(const coord of rings[0]){
        points.push(turf.point(coord));
        points.push(turf.destination(coord,shadowMeters/1000,bearing,{units:'kilometers'}));
      }
      const hull=turf.convex(turf.featureCollection(points));
      if(hull)features.push(turf.feature(hull.geometry,{buildingId:f.id??f.properties?.id??null,heightMeters:height,heightSource:source}));
    }
  }
  return turf.featureCollection(features);
}
function exposureOfEdge(edge,shadows){
  const line=turf.lineString(edge.geometry);
  const total=turf.length(line,{units:'kilometers'})*1000;
  if(!Number.isFinite(total)||total<=0)throw new Error(`Invalid edge geometry ${edge.id}`);
  const samples=Math.max(1,Math.ceil(total/5));
  const candidates=shadows.features.map(f=>({f,b:turf.bbox(f)}));
  let exposed=0;
  for(let i=0;i<samples;i++){
    const p=turf.along(line,((i+0.5)*total/samples)/1000,{units:'kilometers'});
    const [x,y]=p.geometry.coordinates;
    const shade=candidates.some(({f,b})=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]&&turf.booleanPointInPolygon(p,f));
    if(!shade)exposed++;
  }
  return exposed/samples;
}
for(const [slot,time] of Object.entries(TIMES)){
  const instant=new Date(`${DEMO_DATE}T${time}:00+04:00`);
  if(Number.isNaN(instant.getTime()))throw new Error('Invalid DEMO_DATE');
  const pos=SunCalc.getPosition(instant,...CENTER); // SunCalc 2: degrees, clockwise from north
  if(!Number.isFinite(pos.azimuth)||!Number.isFinite(pos.altitude))throw new Error('Bad solar position');
  const shades=shadowsAt(pos);
  const exposures=Object.fromEntries(graph.edges.map(e=>[e.id,exposureOfEdge(e,shades)]));
  await writeFile(`${dataDir}/shadows-${slot}00.geojson`,JSON.stringify(shades));
  await writeFile(`${dataDir}/exposure-${slot}00.json`,JSON.stringify(exposures));
  console.log(`${slot}:00  altitude=${pos.altitude.toFixed(2)}° azimuth=${pos.azimuth.toFixed(2)}° shadows=${shades.features.length} edges=${Object.keys(exposures).length}`);
}

await writeFile(`${dataDir}/DATA_PROVENANCE.txt`,graph.metadata.isSynthetic
  ? 'SYNTHETIC ILLUSTRATIVE GEOMETRY ONLY – NOT VERIFIED DUBAI STREETS. Shadow polygons and exposure fractions were calculated using SunCalc 2.x and Turf.js on example features.\n'
  : 'OPENSTREETMAP WALKING NETWORK AND BUILDINGS. Heights include documented fallbacks. Shadow polygons and edge exposures are estimates calculated using SunCalc 2.x and Turf.js; not measured thermal comfort. © OpenStreetMap contributors (ODbL).\n');
