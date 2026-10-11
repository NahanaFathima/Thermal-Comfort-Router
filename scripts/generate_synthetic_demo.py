#!/usr/bin/env python3
"""STRICTLY SYNTHETIC FALLBACK when OSM downloads are unavailable.
Generate a mathematical test network (NOT an actual walkable Dubai street map).
Shadow polygons and exposure ratios ARE computed, not invented. Uses Shapely.
When real OSM data is available use export_osm.py + precompute.mjs instead.
"""
from __future__ import annotations
import json,math,random,heapq
from pathlib import Path
from datetime import datetime,timezone
from shapely.geometry import MultiPoint,Point,Polygon,mapping
from shapely.prepared import prep
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'public/data'
DATA.mkdir(parents=True,exist_ok=True)
R=6371009
LAT0=25.19255;LON0=55.27445
ROWS=8;COLS=9
DY=.00067;DX=.00080
seed=random.Random(1102026)
def metres(a,b):
    lat1,lon1=a;lat2,lon2=b
    x=(lon2-lon1)*math.cos(math.radians((lat1+lat2)/2))*math.pi/180*R
    y=(lat2-lat1)*math.pi/180*R
    return math.hypot(x,y)

def geojson_write(name,obj):
    (DATA/name).write_text(json.dumps(obj,separators=(',',':')),encoding='utf8')
nodes=[];edges=[]
for row in range(ROWS):
    for col in range(COLS):
        nodes.append({'id':f'n{row}_{col}','lat':LAT0+row*DY,'lng':LON0+col*DX})
node_map={n['id']:n for n in nodes}
def add_edge(a,b):
    u=node_map[a];v=node_map[b]
    # Carefully curved but strictly synthetic network geometry.
    midlat=(u['lat']+v['lat'])/2
    midlon=(u['lng']+v['lng'])/2
    if abs(u['lat']-v['lat'])<1e-10:midlat+=0.00002*math.sin(int(u['id'][1])*3+int(v['id'][-1]))
    else:midlon+=0.00002*math.sin(int(u['id'][1])+int(u['id'][-1])*3)
    geometry=[[u['lng'],u['lat']],[midlon,midlat],[v['lng'],v['lat']]]
    length=metres((u['lat'],u['lng']),(midlat,midlon))+metres((midlat,midlon),(v['lat'],v['lng']))
    edges.append({'id':f'{a}>{b}','u':a,'v':b,'lengthMeters':round(length,4),'geometry':geometry,'highway':'synthetic_path'})
for row in range(ROWS):
    for col in range(COLS):
        if col+1<COLS:
            add_edge(f'n{row}_{col}',f'n{row}_{col+1}')
            add_edge(f'n{row}_{col+1}',f'n{row}_{col}')
        if row+1<ROWS:
            add_edge(f'n{row}_{col}',f'n{row+1}_{col}')
            add_edge(f'n{row+1}_{col}',f'n{row}_{col}')

features=[];counts={'explicit':0,'levels':0,'fallback':0}
for row in range(ROWS-1):
    for col in range(COLS-1):
        if seed.random()<.10:continue
        # Buildings stay inside synthetic grid blocks; heights deliberately vary.
        lat=LAT0+(row+.5)*DY+(seed.random()-.5)*.00014
        lon=LON0+(col+.5)*DX+(seed.random()-.5)*.00016
        halfy=(.14+seed.random()*.14)*DY
        halfx=(.14+seed.random()*.14)*DX
        coords=[[lon-halfx,lat-halfy],[lon+halfx,lat-halfy],[lon+halfx,lat+halfy],[lon-halfx,lat+halfy],[lon-halfx,lat-halfy]]
        if seed.random()<.3:height=65+seed.random()*110
        else:height=22+seed.random()*65
        variant=(row+col*3)%5
        if variant<=1:props={'height':round(height,2),'heightMeters':round(height,2),'heightSource':'explicit'};counts['explicit']+=1
        elif variant<=3:
            levels=max(1,round(height/3.2));props={'building:levels':levels,'height':round(levels*3.2,2),'heightMeters':round(levels*3.2,2),'heightSource':'levels'};counts['levels']+=1
        else:props={'height':15,'heightMeters':15,'heightSource':'fallback'};counts['fallback']+=1
        props.update({'id':f'synthetic-building-{row}-{col}','synthetic':True})
        features.append({'type':'Feature','id':props['id'],'properties':props,'geometry':{'type':'Polygon','coordinates':[coords]}})

def sun_position(utc):
    """Simple analytical solar geometry for OFFLINE fallback (not SunCalc 2)."""
    jd=utc.timestamp()/86400+2440587.5
    d=jd-2451545.0
    L=math.radians((280.46+.9856474*d)%360)
    g=math.radians((357.528+.9856003*d)%360)
    lam=L+math.radians(1.915)*math.sin(g)+math.radians(.020)*math.sin(2*g)
    eps=math.radians(23.439-.0000004*d)
    ra=math.atan2(math.cos(eps)*math.sin(lam),math.cos(lam))
    dec=math.asin(math.sin(eps)*math.sin(lam))
    gst=math.radians((280.16+360.9856235*d)%360)
    H=(gst+math.radians(55.278)-ra+math.pi)%(2*math.pi)-math.pi
    phi=math.radians(25.195)
    alt=math.asin(math.sin(phi)*math.sin(dec)+math.cos(phi)*math.cos(dec)*math.cos(H))
    az=(math.degrees(math.atan2(math.sin(H),math.cos(H)*math.sin(phi)-math.tan(dec)*math.cos(phi)))+180)%360
    return math.degrees(alt),az

def build_shadows(alt,az):
    if alt<=1:return {'type':'FeatureCollection','features':[]}
    out=[]
    bearing=math.radians((az+180)%360)
    for b in features:
        h=b['properties']['heightMeters']
        offset=min(1000,h/math.tan(math.radians(alt)))
        coords=b['geometry']['coordinates'][0]
        p=[]
        for lng,lat in coords:
            p.append((lng,lat))
            p.append((lng+offset*math.sin(bearing)/(111320*math.cos(math.radians(lat))),lat+offset*math.cos(bearing)/111132))
        poly=MultiPoint(p).convex_hull
        out.append({'type':'Feature','geometry':mapping(poly),'properties':{'buildingId':b['properties']['id'],'heightMeters':h,'heightSource':b['properties']['heightSource'],'model':'convex-hull projection','synthetic':True}})
    return {'type':'FeatureCollection','features':out}

def sample_exposure(edge,polys):
    geometry=edge['geometry']
    seg_lengths=[metres((geometry[i][1],geometry[i][0]),(geometry[i+1][1],geometry[i+1][0])) for i in range(len(geometry)-1)]
    length=sum(seg_lengths)
    n=max(1,math.ceil(length/5))
    exposed=0
    for j in range(n):
        dist=(j+.5)*length/n
        for i,seglen in enumerate(seg_lengths):
            if dist<=seglen or i==len(seg_lengths)-1:
                t=max(0,min(1,dist/seglen));lon=geometry[i][0]+t*(geometry[i+1][0]-geometry[i][0]);lat=geometry[i][1]+t*(geometry[i+1][1]-geometry[i][1]);break
            dist-=seglen
        p=Point(lon,lat)
        if not any(box[0]<=lon<=box[2] and box[1]<=lat<=box[3] and pg.covers(p) for pg,box in polys):exposed+=1
    return exposed/n

meta={'source':'SYNTHETIC ILLUSTRATIVE TEST NETWORK – NOT OPENSTREETMAP','isSynthetic':True,
      'generatedAt':datetime.now(timezone.utc).isoformat(),'bbox':[LON0,LAT0,LON0+(COLS-1)*DX,LAT0+(ROWS-1)*DY],
      'demoDate':'2026-10-11','heightCounts':counts,
      'warning':'UNVERIFIED synthetic paths and invented buildings located in approximate Dubai coordinates. DO NOT present as real walkable roads. Shadow/exposure values are calculated on synthetic geometry.'}
exposures={}
for slot,h in [('10',10),('13',13),('16',16)]:
    utc=datetime(2026,10,11,h-4,tzinfo=timezone.utc)
    altitude,azimuth=sun_position(utc)
    shadow_fc=build_shadows(altitude,azimuth)
    polygons=[Polygon(f['geometry']['coordinates'][0]) for f in shadow_fc['features']]
    indexed=[(prep(pg),pg.bounds) for pg in polygons]
    exposure={e['id']:round(sample_exposure(e,indexed),6) for e in edges}
    geojson_write(f'shadows-{slot}00.geojson',shadow_fc)
    geojson_write(f'exposure-{slot}00.json',exposure)
    exposures[slot]=exposure
    print(slot,round(altitude,2),round(azimuth,2),'shadows',len(shadow_fc['features']),'edges',len(exposure))

adj={n['id']:[] for n in nodes}
for e in edges:adj[e['u']].append(e)
def path(start,end,x,alpha):
    pq=[(0,start)];dist={start:0};prev={}
    while pq:
        cost,u=heapq.heappop(pq)
        if cost!=dist[u]:continue
        if u==end:break
        for e in adj[u]:
            v=e['v'];z=cost+e['lengthMeters']*(1+alpha*x[e['id']]);
            if z<dist.get(v,float('inf'))-1e-9:dist[v]=z;prev[v]=e;heapq.heappush(pq,(z,v))
    if end not in dist:return None
    route=[];u=end
    while u!=start:
        e=prev[u];route.append(e);u=e['u']
    return route[::-1]

def totals(route,x):
    return sum(e['lengthMeters'] for e in route),sum(e['lengthMeters']*x[e['id']] for e in route)

# Choose demonstrated endpoints from COMPUTED path comparisons, no invented benefits.
best=None
candidate_pairs=[(f'n{a}_{b}',f'n{c}_{d}') for a in range(0,ROWS,2) for b in range(0,COLS,2) for c in range(1,ROWS,2) for d in range(1,COLS,2)]
for start,end in candidate_pairs:
    for slot in ['10','13','16']:
        x=exposures[slot]
        shortest=path(start,end,x,0);shade=path(start,end,x,5)
        if shortest is None or shade is None:continue
        sdist,sexp=totals(shortest,x);hdist,hexp=totals(shade,x)
        if sdist<350 or sdist>1300:continue
        gain=sexp-hexp
        detour=hdist-sdist
        score=gain-.08*max(0,detour)
        if best is None or score>best[0]:best=(score,start,end,slot,sdist,hdist,sexp,hexp)
if best is None:raise RuntimeError('Unable to select a synthetic demo pair')
_,start,end,slot,sdist,hdist,sexp,hexp=best
print('Selected illustrative test scenario:',start,end,slot, 'shortest m',round(sdist), 'shade m',round(hdist),'exposure m',round(sexp),round(hexp))
geojson_write('buildings.geojson',{'type':'FeatureCollection','features':features})
geojson_write('graph.json',{'metadata':meta,'nodes':nodes,'edges':edges,'defaultEndpoints':{'startNodeId':start,'endNodeId':end}})
(DATA/'DATA_PROVENANCE.txt').write_text('SYNTHETIC GEOMETRY ONLY – NOT REAL DUBAI PEDESTRIAN DATA.\nRun python scripts/export_osm.py (with network) and npm run precompute to replace all generated files with real OSM data and estimated building-shadow snapshots.\nThe shadow and exposure values are mathematically calculated, but only for synthetic example buildings and paths.\n',encoding='utf8')
