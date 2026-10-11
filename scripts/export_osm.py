#!/usr/bin/env python3
"""Export a real directed pedestrian network and buildings from OpenStreetMap.
Requires: Python 3.11+, osmnx 2.x, shapely, geopandas, networkx.
Requires internet ONCE for Overpass extraction; the browser later uses local JSON.
Run from the repository root: python scripts/export_osm.py
Unlike the synthetic fallback, exported ways are actual OSM walking-network ways.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re

import osmnx as ox
import networkx as nx
from shapely.geometry import LineString, Polygon, MultiPolygon, mapping
from shapely.validation import make_valid

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_BBOX=(55.270,25.188,55.286,25.202)  # west,south,east,north: OSMnx 2.x

def read_height(props):
    val=props.get('height')
    if isinstance(val,(int,float)):
        number=float(val)
    elif isinstance(val,str):
        m=re.fullmatch(r"\s*([0-9]+(?:\.[0-9]+)?)\s*(m|meters?|metres?|ft|feet|')?\s*",val,re.I)
        number=float(m.group(1))*(0.3048 if m.group(2) and m.group(2).lower() in ('ft','feet',"'") else 1) if m else float('nan')
    else:number=float('nan')
    if 0<number<2000:return number,'explicit'
    levels=props.get('building:levels')
    try:
        n=float(levels)
        if 0<n<300:return n*3.2,'levels'
    except (TypeError,ValueError):pass
    return 15.0,'fallback'

def make_graph(bbox):
    g=ox.graph_from_bbox(bbox,network_type='walk',simplify=True,retain_all=False)
    if not isinstance(g,nx.MultiDiGraph):raise ValueError('OSMnx did not return a directed multigraph')
    if g.number_of_nodes()<2 or g.number_of_edges()<1:raise ValueError('No usable pedestrian network')
    nodes=[{'id':str(id),'lat':float(data['y']),'lng':float(data['x'])} for id,data in g.nodes(data=True)]
    edges=[]
    for u,v,key,data in g.edges(keys=True,data=True):
        if data.get('geometry') is not None:
            coords=[[float(x),float(y)] for x,y in data['geometry'].coords]
        else:
            coords=[[float(g.nodes[u]['x']),float(g.nodes[u]['y'])],[float(g.nodes[v]['x']),float(g.nodes[v]['y'])]]
        # OSMnx edge shapes need not be ordered u -> v; orient them explicitly.
        au=(float(g.nodes[u]['x']),float(g.nodes[u]['y']))
        squared=lambda a,b:(a[0]-b[0])**2+(a[1]-b[1])**2
        if squared(coords[-1],au)<squared(coords[0],au):coords.reverse()
        length=float(data.get('length',0))
        if not math.isfinite(length) or length<=0 or len(coords)<2:continue
        edges.append({'id':f'{u}/{v}/{key}','u':str(u),'v':str(v),'lengthMeters':length,
                      'geometry':coords,'highway':str(data.get('highway','walk'))})
    # Choose a strongly connected subgraph for a reliable reverse-capable demo.
    scc=max(nx.strongly_connected_components(g),key=len)
    candidates=[n for n in nodes if int(n['id']) in scc]
    if len(candidates)<2:raise ValueError('No connected demo node pair')
    # Anchor endpoints in separate geographic parts of the chosen connected region.
    def nearest(target):
        return min(candidates,key=lambda n:(n['lat']-target[0])**2+(n['lng']-target[1])**2 / 0.8)
    start=nearest((25.197,55.279));end=nearest((25.194,55.275))
    if start['id']==end['id']:
        end=max(candidates,key=lambda n:(n['lat']-start['lat'])**2+(n['lng']-start['lng'])**2)
    return {'nodes':nodes,'edges':edges,'defaultEndpoints':{'startNodeId':start['id'],'endNodeId':end['id']}}

def make_buildings(bbox):
    result=ox.features_from_bbox(bbox,{'building':True})
    features=[];counts=Counter()
    for index,row in result.iterrows():
        geom=row.geometry
        if geom is None or geom.is_empty:continue
        if not geom.is_valid:geom=make_valid(geom)
        if geom.geom_type=='Polygon':parts=[geom]
        elif geom.geom_type=='MultiPolygon':parts=list(geom.geoms)
        elif geom.geom_type=='GeometryCollection':parts=[g for g in geom.geoms if g.geom_type=='Polygon']
        else:continue
        props={key:row.get(key) for key in ('building','height','building:levels') if key in row.index}
        # Convert missing pandas / numpy scalar values for proper JSON serialization.
        props={k:str(v) for k,v in props.items() if v is not None and str(v) not in ('nan','<NA>','None')}
        height,source=read_height(props)
        for j,poly in enumerate(parts):
            if poly.is_empty or not poly.is_valid or poly.area<=0:continue
            counts[source]+=1
            bid=f'{str(index).replace(" ","")}-{j}'
            features.append({'type':'Feature','id':bid,'geometry':mapping(poly),
                             'properties':{**props,'id':bid,'height':height,'heightMeters':height,'heightSource':source}})
    return {'type':'FeatureCollection','features':features},dict(counts)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--bbox',nargs=4,type=float,default=DEFAULT_BBOX,metavar=('WEST','SOUTH','EAST','NORTH'))
    parser.add_argument('--output',default=str(ROOT/'public/data'))
    parser.add_argument('--date',default='2026-10-11',help='Solar demo date (YYYY-MM-DD)')
    args=parser.parse_args()
    bbox=tuple(args.bbox)
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    graph=make_graph(bbox)
    buildings,counts=make_buildings(bbox)
    if not buildings['features']:raise ValueError('No usable OSM building polygons found; try a different bbox.')
    graph['metadata']={'source':'OpenStreetMap via OSMnx 2.x','isSynthetic':False,
                      'generatedAt':datetime.now(timezone.utc).isoformat(),
                      'bbox':list(bbox),'demoDate':args.date,'heightCounts':counts,
                      'warning':'Building heights may be explicit, estimated from floors, or set to 15m; shadows use convex hull estimates.'}
    (out/'graph.json').write_text(json.dumps(graph,separators=(',',':')),encoding='utf-8')
    (out/'buildings.geojson').write_text(json.dumps(buildings,separators=(',',':')),encoding='utf-8')
    # Never accidentally pair newly exported OSM roads with stale synthetic exposure snapshots.
    for slot in ('10','13','16'):
        for name in (f'shadows-{slot}00.geojson',f'exposure-{slot}00.json'):
            stale=out/name
            if stale.exists():stale.unlink()
    (out/'DATA_PROVENANCE.txt').write_text('REAL OSM extraction completed. Shadow and exposure snapshots must be regenerated with npm run precompute before app launch. Heights may include estimates.\n',encoding='utf8')
    print('Nodes',len(graph['nodes']),'directed edges',len(graph['edges']),'buildings',len(buildings['features']))
    print('Height sources',counts,'demo endpoints',graph['defaultEndpoints'])
    print('Now run npm run precompute to replace the previous shadow/exposure snapshots.')
if __name__=='__main__':main()
