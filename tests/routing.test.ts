import { describe,expect,it } from 'vitest';
import { PedestrianGraph } from '../src/engine/routing';
import { compareRoutes,toResult } from '../src/engine/metrics';
import type { GraphData,GraphEdge } from '../src/types';
const e=(id:string,u:string,v:string,n:number):GraphEdge=>({id,u,v,lengthMeters:n,geometry:[[55+(u.charCodeAt(0)-65)*.001,25],[55+(v.charCodeAt(0)-65)*.001,25]]});
const graph:GraphData={metadata:{source:'test',isSynthetic:true,generatedAt:'2026-10-11',bbox:[55,25,56,26],demoDate:'2026-10-11'},
  nodes:['A','B','C','D'].map((id,i)=>({id,lat:25,lng:55+i*.001})),
  edges:[e('AB','A','B',100),e('BD','B','D',100),e('AC','A','C',120),e('CD','C','D',120)],
  defaultEndpoints:{startNodeId:'A',endNodeId:'D'}};
const ex={AB:1,BD:1,AC:0,CD:0};
describe('directed graph + Dijkstra',()=>{
  it('finds the true distance-shortest route',()=>expect(new PedestrianGraph(graph).dijkstra('A','D',ex,0).edgeIds).toEqual(['AB','BD']));
  it('alpha=0 yields the distance baseline',()=>expect(new PedestrianGraph(graph).dijkstra('A','D',ex,0).cost).toBe(200));
  it('changes preference using actual weighted costs',()=>expect(new PedestrianGraph(graph).dijkstra('A','D',ex,3).edgeIds).toEqual(['AC','CD']));
  it('does not fabricate reverse edges',()=>expect(()=>new PedestrianGraph(graph).dijkstra('D','A',ex,0)).toThrow('No pedestrian route'));
  it('rejects missing/invalid exposure',()=>expect(()=>new PedestrianGraph(graph).dijkstra('A','D',{AB:NaN,BD:1,AC:0,CD:0},2)).toThrow());
  it('calculates distances from traversed edges',()=>{
    const g=new PedestrianGraph(graph),base=toResult(g.dijkstra('A','D',ex,0),ex),shade=toResult(g.dijkstra('A','D',ex,4),ex);
    expect(base.distanceMeters).toBe(200);expect(base.sunExposedMeters).toBe(200);
    expect(shade.distanceMeters).toBe(240);expect(shade.sunExposedMeters).toBe(0);
    expect(compareRoutes(base,shade).exposureReductionPercent).toBe(100);
  });
  it('handles zero baseline exposure correctly',()=>{
    expect(compareRoutes(toResult({edges:[],edgeIds:[],cost:0},{},graph.nodes[0]),toResult({edges:[],edgeIds:[],cost:0},{},graph.nodes[0])).exposureReductionPercent).toBeNull();
  });
});
