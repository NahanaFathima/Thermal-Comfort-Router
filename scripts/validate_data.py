#!/usr/bin/env python3
"""Validate the bundled local datasets without any third-party Python dependencies."""
import json,math,sys,heapq
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public/data'
def load(s):return json.loads((p/s).read_text())
g=load('graph.json');nodes={n['id']:n for n in g['nodes']};edges=g['edges'];edgeids=set()
assert nodes,'No graph nodes'
for n in nodes.values():assert math.isfinite(n['lat']) and math.isfinite(n['lng'])
for e in edges:
    assert e['id'] not in edgeids;edgeids.add(e['id'])
    assert e['u'] in nodes and e['v'] in nodes
    assert len(e['geometry'])>=2 and e['lengthMeters']>0 and math.isfinite(e['lengthMeters'])
    assert all(len(c)==2 and all(map(math.isfinite,c)) for c in e['geometry'])
b=load('buildings.geojson');assert b['type']=='FeatureCollection' and b['features']
for f in b['features']:
    assert f['geometry']['type'] in ('Polygon','MultiPolygon')
    assert f['properties'].get('heightMeters',f['properties'].get('height',0))>0
adj={n:[] for n in nodes}
for e in edges:adj[e['u']].append(e)
def shortest(start,end,ex,alpha):
    dist={start:0};prior={};q=[(0,start)]
    while q:
        c,u=heapq.heappop(q)
        if c!=dist[u]:continue
        if u==end:break
        for e in adj[u]:
            d=c+e['lengthMeters']*(1+alpha*ex[e['id']]);v=e['v']
            if d<dist.get(v,float('inf'))-1e-9:
                dist[v]=d;prior[v]=e;heapq.heappush(q,(d,v))
    if end not in dist:return None
    route=[];v=end
    while v!=start:
        e=prior[v];route.append(e);v=e['u']
    return route[::-1]
a=g['defaultEndpoints']['startNodeId'];z=g['defaultEndpoints']['endNodeId']
assert a!=z and a in nodes and z in nodes
for slot in ('10','13','16'):
    x=load(f'exposure-{slot}00.json');s=load(f'shadows-{slot}00.geojson')
    assert s['type']=='FeatureCollection' and isinstance(s['features'],list)
    assert set(x)==edgeids, 'Missing or extra exposure edges'
    assert all(isinstance(f,(float,int)) and math.isfinite(f) and 0<=f<=1 for f in x.values())
    p0=shortest(a,z,x,0);p5=shortest(a,z,x,5)
    assert p0 and p5, 'Demo nodes are not connected for '+slot
    for r in (p0,p5):
        for i in range(1,len(r)):assert r[i-1]['v']==r[i]['u']
    calc=lambda route:(sum(e['lengthMeters'] for e in route),sum(e['lengthMeters']*x[e['id']] for e in route))
    d0,s0=calc(p0);d5,s5=calc(p5)
    assert d5+1e-5>=d0
    print(f'{slot}:00 | shortest {d0:.1f} m ({s0:.1f} sun-m) | shade-priority {d5:.1f} m ({s5:.1f} sun-m)')
print('PASS:',len(nodes),'nodes,',len(edges),'directed edges,',len(b['features']),'buildings; source:',g['metadata']['source'])
if g['metadata']['isSynthetic']:
    print('WARNING: This is SYNTHETIC TEST GEOGRAPHY; it is not verified Downtown Dubai walking data.')
