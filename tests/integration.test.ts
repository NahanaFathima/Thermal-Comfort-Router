import { beforeAll,describe,expect,it,vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as api from '../src/engine/index';
const dataDir=resolve(process.cwd(),'public/data');
beforeAll(async()=>{
  vi.stubGlobal('fetch',async(url:string)=>{
    const name=String(url).split('/data/')[1];
    try{const contents=await readFile(resolve(dataDir,name),'utf8');return {ok:true,status:200,json:async()=>JSON.parse(contents)};}
    catch{return {ok:false,status:404,json:async()=>({})};}
  });
  await api.loadDemoData();
});
describe('bundled data and frontend engine API',()=>{
  it('loads building and graph data',()=>{
    expect(api.getGraphNodes().length).toBeGreaterThan(2);
    expect(api.getBuildingGeoJSON().features.length).toBeGreaterThan(0);
  });
  it('uses a valid connected default route for all 3 time slots',()=>{
    const pair=api.getDefaultEndpoints();
    for(const time of ['10','13','16'] as const){
      expect(api.getShadowGeoJSON(time).features.length).toBeGreaterThan(0);
      const comparison=api.getRouteComparison({...pair,time,heatAversion:3});
      for(const r of [comparison.shortest,comparison.shaded]){
        expect(r.distanceMeters).toBeGreaterThan(0);
        expect(Number.isFinite(r.sunExposedMeters)).toBe(true);
        expect(r.coordinates.length).toBeGreaterThan(1);
        expect(r.coordinates.every(c=>c.every(Number.isFinite))).toBe(true);
      }
    }
  });
  it('tracks the bundled data origin honestly',()=>{
    const source=api.getDataProvenance();
    expect(typeof source.source).toBe('string');
    if(source.isSynthetic)expect(source.source).toMatch(/synthetic/i);
  });
  it('returns null outside the local network',()=>expect(api.findNearestNode(0,0)).toBeNull());
});
