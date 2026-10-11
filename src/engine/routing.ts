/** Dijkstra on the actual directed pedestrian graph. No invented edges. */
import { EngineError } from '../types';
import type { ExposureSnapshot, GraphData, GraphEdge, GraphNode } from '../types';

interface HeapEntry { node: string; cost: number }
/** Small binary min-heap: O(log V) push/pop; tested with synthetic graphs. */
export class MinHeap {
  private a: HeapEntry[] = [];
  get size(): number { return this.a.length; }
  push(x: HeapEntry): void {
    const a=this.a; a.push(x); let i=a.length-1;
    while(i>0){const p=(i-1)>>1;if(a[p].cost<=x.cost)break;a[i]=a[p];i=p;}a[i]=x;
  }
  pop(): HeapEntry | undefined {
    const a=this.a;if(!a.length)return undefined;
    const first=a[0],last=a.pop()!;
    if(a.length){let i=0;while(true){let j=2*i+1;if(j>=a.length)break;
      if(j+1<a.length&&a[j+1].cost<a[j].cost)j++;
      if(last.cost<=a[j].cost)break;a[i]=a[j];i=j;}a[i]=last;}
    return first;
  }
}
export interface Path { edgeIds: string[]; edges: GraphEdge[]; cost: number }
export class PedestrianGraph {
  readonly nodes: Map<string, GraphNode>;
  readonly edges: Map<string, GraphEdge>;
  private readonly adjacent: Map<string, GraphEdge[]>;
  constructor(data: GraphData) {
    this.nodes = new Map(data.nodes.map(n=>[n.id,n]));
    this.edges=new Map();this.adjacent=new Map(data.nodes.map(n=>[n.id,[]]));
    if(!this.nodes.size)throw new EngineError('DATA_ERROR','The pedestrian graph contains no nodes.');
    for(const e of data.edges){
      if(this.edges.has(e.id)||!this.nodes.has(e.u)||!this.nodes.has(e.v)||!(e.lengthMeters>0)||!Number.isFinite(e.lengthMeters)||e.geometry.length<2)
        throw new EngineError('DATA_ERROR',`Invalid edge ${e.id}.`);
      for(const coord of e.geometry)if(coord.length!==2||!coord.every(Number.isFinite))throw new EngineError('DATA_ERROR',`Invalid coordinates for edge ${e.id}.`);
      this.edges.set(e.id,e);this.adjacent.get(e.u)!.push(e);
    }
    for(const edges of this.adjacent.values())edges.sort((a,b)=>a.id.localeCompare(b.id));
  }
  /** Edges are directed: reverse travel is possible only when its reverse edge exists. */
  dijkstra(start: string, end: string, exposure: ExposureSnapshot, alpha: number): Path {
    if(!this.nodes.has(start)||!this.nodes.has(end))throw new EngineError('INVALID_INPUT','Selected pedestrian node does not exist.');
    if(!Number.isFinite(alpha)||alpha<0||alpha>5)throw new EngineError('INVALID_INPUT','Shade preference must be between 0 and 5.');
    if(start===end)return {edgeIds:[],edges:[],cost:0};
    const costs=new Map<string,number>([[start,0]]),previous=new Map<string,GraphEdge>();
    const heap=new MinHeap();heap.push({node:start,cost:0});
    while(heap.size){
      const cur=heap.pop()!;
      if(cur.cost!==(costs.get(cur.node)??Infinity))continue;
      if(cur.node===end)break;
      for(const edge of this.adjacent.get(cur.node)??[]){
        // Even distance-only results must have trustworthy exposure metrics later.
        const frac=exposure[edge.id];
        if(!Number.isFinite(frac)||frac<0||frac>1)throw new EngineError('MISSING_EXPOSURE',`Missing or invalid sunlight exposure for edge ${edge.id}.`);
        const weight=edge.lengthMeters*(1+alpha*frac);
        const candidate=cur.cost+weight;
        if(candidate<(costs.get(edge.v)??Infinity)-1e-9){
          costs.set(edge.v,candidate);previous.set(edge.v,edge);heap.push({node:edge.v,cost:candidate});
        }
      }
    }
    if(!costs.has(end))throw new EngineError('NO_ROUTE','No pedestrian route found between these locations.');
    const reverse:GraphEdge[]=[];
    for(let node=end;node!==start;){
      const edge=previous.get(node);if(!edge)throw new EngineError('NO_ROUTE','Pedestrian route is disconnected.');
      reverse.push(edge);node=edge.u;
      if(reverse.length>this.edges.size)throw new EngineError('DATA_ERROR','Invalid route predecessor chain.');
    }
    reverse.reverse();
    return {edgeIds:reverse.map(e=>e.id),edges:reverse,cost:costs.get(end)!};
  }
}
