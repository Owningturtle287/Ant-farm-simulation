const key=c=>c.join(',');
export const SIGNAL_COLORS={food:'#b4ce8a',water:'#73bfd2',alarm:'#ed8060',brood:'#e6c574',queen:'#ba9dc9',home:'#b7c4b1'};
const HALF_LIFE={food:45,water:35,alarm:5,brood:8,queen:14,home:80};
export function initSignals(w,data={}){
  w.signals={};for(const kind of Object.keys(HALF_LIFE))w.signals[kind]=new Map(data.signals?.[kind]??data.trails?.[kind]??(kind==='food'?data.pheromones??[]:[]));
  w.trails={food:w.signals.food,water:w.signals.water};w.pheromones=new Map(data.pheromones??[]);
}
export function emit(w,kind,c,strength){const id=key(c),map=w.signals[kind];if(map)map.set(id,Math.min(4,(map.get(id)??0)+strength));}
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
