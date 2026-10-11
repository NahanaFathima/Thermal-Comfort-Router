import { describe,expect,it } from 'vitest';
import { buildShadows,getSolarPosition,resolveHeight,shadowBearing,shadowLength,TIME_TO_ISO } from '../src/engine/shadows';
import type { FeatureCollection, Polygon } from 'geojson';
const one:FeatureCollection<Polygon>={type:'FeatureCollection',features:[{type:'Feature',properties:{heightMeters:35},geometry:{type:'Polygon',coordinates:[[[55.277,25.195],[55.278,25.195],[55.278,25.196],[55.277,25.196],[55.277,25.195]]]}}]};
describe('solar geometry and projected shadow footprints',()=>{
  it('gets finite angles at all three Dubai snapshots',()=>{
    for(const iso of Object.values(TIME_TO_ISO)){
      const p=getSolarPosition(new Date(iso),25.195,55.278);
      expect(Number.isFinite(p.altitudeDegrees)).toBe(true);
      expect(Number.isFinite(p.azimuthDegrees)).toBe(true);
      expect(p.altitudeDegrees).toBeGreaterThan(0);
    }
  });
  it('points shadows opposite the sun',()=>expect(shadowBearing(75)).toBe(255));
  it('extends shadows as height grows',()=>expect(shadowLength(20,35)).toBeGreaterThan(shadowLength(10,35)));
  it('uses height fallback hierarchy',()=>{
    expect(resolveHeight({height:'100 ft'}).heightMeters).toBeCloseTo(30.48);
    expect(resolveHeight({'building:levels':'12'}).heightMeters).toBeCloseTo(38.4);
    expect(resolveHeight({}).heightMeters).toBe(15);
  });
  it('creates a valid polygon from a rectangular footprint',()=>{
    const fc=buildShadows(one,{altitudeDegrees:45,azimuthDegrees:135});
    expect(fc.features).toHaveLength(1);expect(fc.features[0].geometry.coordinates[0].length).toBeGreaterThan(4);
  });
  it('produces different shadows at 10AM and 4PM',()=>{
    const p1=getSolarPosition(new Date(TIME_TO_ISO['10']),25.195,55.278);
    const p2=getSolarPosition(new Date(TIME_TO_ISO['16']),25.195,55.278);
    expect(JSON.stringify(buildShadows(one,p1))).not.toBe(JSON.stringify(buildShadows(one,p2)));
  });
});
