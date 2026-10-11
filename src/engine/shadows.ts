/** Geographically projected building-shadow estimates (not measured thermal comfort). */
import * as SunCalc from 'suncalc';
import { convex, destination, featureCollection, point } from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { TimeSlot } from '../types';

export interface SolarPosition { altitudeDegrees:number; azimuthDegrees:number }
export type HeightSource='explicit'|'levels'|'fallback';
export function resolveHeight(properties:Record<string,unknown>):{heightMeters:number;source:HeightSource} {
  const explicit=properties.heightMeters??properties.height;
  let height:number=NaN;
  if(typeof explicit==='number')height=explicit;
  if(typeof explicit==='string'){
    const match=explicit.trim().match(/^([\d.]+)\s*(m|metres?|meters?|ft|feet|')?$/i);
    if(match){height=Number(match[1]);if(/^(ft|feet|')$/i.test(match[2]??''))height*=0.3048;}
  }
  if(height>0&&Number.isFinite(height))return {heightMeters:height,source:properties.heightSource==='levels'?'levels':properties.heightSource==='fallback'?'fallback':'explicit'};
  const levelValue=properties['building:levels'];
  const levels=Number(typeof levelValue==='string'?levelValue.trim():levelValue);
  if(Number.isFinite(levels)&&levels>0)return {heightMeters:3.2*levels,source:'levels'};
  return {heightMeters:15,source:'fallback'};
}
export function getSolarPosition(date:Date,lat:number,lng:number):SolarPosition {
  const pos=SunCalc.getPosition(date,lat,lng); // SunCalc 2.x: degrees, north-clockwise azimuth.
  return {altitudeDegrees:pos.altitude,azimuthDegrees:pos.azimuth};
}
export function shadowLength(heightMeters:number,altitudeDegrees:number):number {
  if(!Number.isFinite(heightMeters)||heightMeters<=0||!Number.isFinite(altitudeDegrees)||altitudeDegrees<=1)return 0;
  // Guard against enormous distances near the horizon.
  return Math.min(1000,heightMeters/Math.tan(altitudeDegrees*Math.PI/180));
}
export const shadowBearing=(sunAzimuthDegrees:number)=>(sunAzimuthDegrees+180)%360;
export const TIME_TO_ISO:Record<TimeSlot,string>={
  '10':'2026-10-11T10:00:00+04:00',
  '13':'2026-10-11T13:00:00+04:00',
  '16':'2026-10-11T16:00:00+04:00'
};
/** Convex hull is deliberately an approximation and can over-shade concave footprints. */
export function buildShadows(buildings:FeatureCollection<Polygon|MultiPolygon>,solar:SolarPosition):FeatureCollection<Polygon> {
  const out:Feature<Polygon>[]=[];
  if(solar.altitudeDegrees<=1)return featureCollection(out);
  for(const building of buildings.features){
    const props=building.properties??{};
    const {heightMeters,source}=resolveHeight(props);
    const metres=shadowLength(heightMeters,solar.altitudeDegrees);
    if(metres<=0)continue;
    const polygonLists=building.geometry.type==='Polygon'?[building.geometry.coordinates]:building.geometry.coordinates;
    for(const rings of polygonLists){
      const original=rings[0];if(!original||original.length<4)continue;
      const pts=[];
      for(const [lng,lat] of original){
        if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
        pts.push(point([lng,lat]));
        pts.push(destination(point([lng,lat]),metres/1000,shadowBearing(solar.azimuthDegrees),{units:'kilometers'}));
      }
      if(pts.length<6)continue;
      const hull=convex(featureCollection(pts));
      if(hull?.geometry?.type==='Polygon')out.push({
        type:'Feature',geometry:hull.geometry,
        properties:{buildingId:props.id??building.id??null,heightMeters,heightSource:source,model:'convex-hull projection'}
      });
    }
  }
  return featureCollection(out);
}
