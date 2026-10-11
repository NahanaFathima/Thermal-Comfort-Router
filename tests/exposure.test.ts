import { describe,expect,it } from 'vitest';
import { sampleEdgeExposure } from '../src/engine/exposure';
import type { FeatureCollection,Polygon } from 'geojson';
const shadow:FeatureCollection<Polygon>={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[55.0,25.0],[55.005,25.0],[55.005,25.005],[55,25.005],[55,25]]]}}]};
const e={geometry:[[55.001,25.001],[55.002,25.001],[55.003,25.002]] as [number,number][]};
describe('5-meter polyline shade sampling',()=>{
  it('returns near zero if all segments are shaded',()=>expect(sampleEdgeExposure(e,shadow)).toBe(0));
  it('returns one if all segments are exposed',()=>expect(sampleEdgeExposure(e,{type:'FeatureCollection',features:[]})).toBe(1));
  it('does not double-count overlapping shadows',()=>expect(sampleEdgeExposure(e,{...shadow,features:[...shadow.features,...shadow.features]})).toBe(0));
  it('does not sample only endpoints',()=>{
    const across={geometry:[[54.999,25.002],[55.002,25.002],[55.006,25.002]] as [number,number][]};
    const x=sampleEdgeExposure(across,shadow);
    expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(1);
  });
  it('rejects bad sampling intervals',()=>expect(()=>sampleEdgeExposure(e,shadow,0)).toThrow());
});
