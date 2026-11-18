const key=c=>c.join(',');
export const SIGNAL_COLORS={food:'#bce77f',water:'#77d9e8',alarm:'#ff916b',brood:'#f5d27a',queen:'#d4a5e3',home:'#acc2b3'};
const SIGNAL_KINDS=['food','water','alarm','brood','queen','home'];
const HALF_LIFE={food:45,water:35,alarm:5,brood:8,queen:14,home:80};
export function initSignals(w,data={}){
  w.signals={};for(const kind of Object.keys(HALF_LIFE))w.signals[kind]=new Map(data.signals?.[kind]??data.trails?.[kind]??(kind==='food'?data.pheromones??[]:[]));
  w.trails={food:w.signals.food,water:w.signals.water};w.pheromones=new Map(data.pheromones??[]);
}
export function emit(w,kind,[x,y],strength){
  const map=w.signals[kind];if(!map)return;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,targets=[];let weight=0;
  for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){const n=(dx?fx:1-fx)*(dy?fy:1-fy),p=[ix+dx,iy+dy];if(n>0&&!w.solid(p)){targets.push([key(p),n]);weight+=n;}}
  for(const [id,n] of targets)map.set(id,Math.min(4,(map.get(id)??0)+strength*n/weight));
}
export function senseSignal(w,kind,c){const map=w.signals[kind];let value=map?.get(key(c))??0;for(const n of w.neighbors(c))value=Math.max(value,(map?.get(key(n))??0)*.7);return value;}
export function decaySignals(w,elapsed){
  for(const [kind,map] of Object.entries(w.signals)){
    const factor=Math.exp(-Math.LN2*elapsed/HALF_LIFE[kind]),next=new Map();
    for(const [id,value] of map){const amount=value*factor;if(amount>.025)next.set(id,amount);}
    if(['brood','queen','alarm','home'].includes(kind))for(const [id,value] of [...next]){
      if(value<.10)continue;const c=id.split(',').map(Number);for(const n of w.neighbors(c)){const nk=key(n);if(!map.has(nk))next.set(nk,Math.max(next.get(nk)??0,value*.18));}
    }
    // Do not diffuse repeatedly within a single update; discard negligible traces.
    w.signals[kind]=next;
  }
  w.trails={food:w.signals.food,water:w.signals.water};w.pheromones=new Map();
  for(const kind of ['food','water'])for(const [id,value] of w.signals[kind])w.pheromones.set(id,Math.max(value,w.pheromones.get(id)??0));
}
export function signalsJSON(w){return Object.fromEntries(Object.entries(w.signals).map(([kind,map])=>[kind,[...map]]));}

// Spatial interpolation gives the two antennae different local readings.
export function sampleField(map,[x,y],w){
  if(!map)return 0;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;let sum=0;
  for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){if(w?.solid([ix+dx,iy+dy]))continue;sum+=(map.get((ix+dx)+','+(iy+dy))??0)*(dx?fx:1-fx)*(dy?fy:1-fy);}return sum;
}
export function sampleChemicals(w,[x,y]){
  const out={food:0,water:0,alarm:0,brood:0,queen:0,home:0},ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  // Share terrain probes and keys across all six receptors at a single tip.
  for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
    if(w.solid([ix+dx,iy+dy]))continue;const id=(ix+dx)+','+(iy+dy),wx=dx?fx:1-fx,wy=dy?fy:1-fy;
    for(const kind of SIGNAL_KINDS)out[kind]+=(w.signals[kind]?.get(id)??0)*wx*wy;
  }return out;
}
export function resourceOdor(w,[x,y]){
  if(w.solid([Math.round(x),Math.round(y)]))return {food:0,water:0};
  // Bins hold live source references. Collection immediately reduces the sensed cue.
  if(w.odorIndexSource!==w.patches||w.odorIndexSize!==w.patches.length||w.odorIndexRevision!==w.revision){
    w.odorIndex=new Map();for(const p of w.patches){const id=Math.floor(p.cell[0]/8)+','+Math.floor(p.cell[1]/8);if(!w.odorIndex.has(id))w.odorIndex.set(id,[]);w.odorIndex.get(id).push(p);}
    w.odorIndexSource=w.patches;w.odorIndexSize=w.patches.length;w.odorIndexRevision=w.revision;
  }
  let food=0,water=0;const minX=Math.floor((x-3.2)/8),maxX=Math.floor((x+3.2)/8),minY=Math.floor((y-3.2)/8),maxY=Math.floor((y+3.2)/8);
  for(let by=minY;by<=maxY;by++)for(let bx=minX;bx<=maxX;bx++)for(const p of w.odorIndex.get(bx+','+by)??[]){
    if(p.amount<=.001)continue;const distance=Math.hypot(x-p.cell[0],y-p.cell[1]);if(distance>3.2)continue;
    // Food odor and a local moisture cue are separate from deposited trail pheromone.
    const value=Math.min(1,p.amount/6)*(1-distance/3.2)**2;
    if(p.kind==='water')water=Math.max(water,value);else food=Math.max(food,value*.55);
  }return {food,water};
}
