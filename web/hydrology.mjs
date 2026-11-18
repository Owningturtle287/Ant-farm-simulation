import {DAY,clamp} from './biology.mjs';
function terrainHash(x,seed){let h=(Math.imul(x,374761393)^seed)>>>0;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
import {addStock,removeStock} from './resources.mjs';
function wave(x,seed){const i=Math.floor(x),t=x-i,s=t*t*(3-2*t);return ((terrainHash(i,seed)%1000)*(1-s)+(terrainHash(i+1,seed)%1000)*s)/1000;}
export function initGroundwater(w,depth=56,data=null){w.groundwater=data?{...data,columns:new Map(data.columns??[])}:{depth,targetDepth:depth,shift:0,at:0,lastPlan:-1000,columns:new Map()};}
export function tableLevel(w,x){const g=w.groundwater;if(!g)return Infinity;w.waterShape??=new Map();let shape=w.waterShape.get(x);if(shape==null){const f=t=>wave(t/29,w.seed^0x831)*10+wave(t/71,w.seed^0x981)*6;shape=w.baseSurface(0)+f(x)-f(0);w.waterShape.set(x,shape);}return Math.max(w.baseSurface(x)+14,shape+g.depth+g.shift);}
export function floodedCells(w){
  return new Set([...w.excavated].filter(id=>flooded(w,id.split(',').map(Number))));
}
export const flooded=(w,c)=>c[1]>=tableLevel(w,c[0])-.25;
export function groundwaterHumidity(w,c){const gap=tableLevel(w,c[0])-c[1];return gap<0?.99:clamp(.99-gap*.055,0,.99);}
function contactAt(w,x){
  const y=Math.ceil(tableLevel(w,x)-.25),wet=[x,y],ledge=[x,y-1];
  if(!w.excavated.has(wet.join(','))||!w.excavated.has(ledge.join(','))||!w.walkable(ledge))return null;
  return ledge;
}

export function exposedSeep(w,p){
  const ledge=contactAt(w,p.cell[0]);
  return !!ledge&&ledge[1]===p.cell[1]&&!!w.path(w.nest,ledge);
}

export function drainClosedSeeps(w){
  for(const p of w.patches)if(p.origin==='seep'&&p.amount>0&&!exposedSeep(w,p))returnSeep(w,p);
}

function returnSeep(w,p){
  const drained=removeStock(w,p,p.amount,'drained'),column=w.groundwater.columns.get(p.cell[0]);
  if(column)column.water=Math.min(column.capacity,column.water+drained);
}

export function tickGroundwater(w,time){
  const g=w.groundwater;if(!g||time-g.at<2)return;const elapsed=time-g.at;g.at=time;
  const old=g.depth,shift=g.shift;g.depth+=clamp(g.targetDepth-g.depth,-elapsed*.035,elapsed*.035);g.shift=clamp(g.shift+(w.weather.raining?-.0005:.00009)*elapsed,-2,3);
  if(Math.abs(old+shift-g.depth-g.shift)>.001){w.climateRevision=-1;w.itemCellsRevision=-1;w.cachePoolRevision=-1;}
  const contacts=new Map(),wet=new Set();
  for(const id of w.excavated){
    const c=id.split(',').map(Number);
    if(!flooded(w,c))continue;
    wet.add(id);
    const ledge=contactAt(w,c[0]);if(ledge&&c[1]===ledge[1]+1)contacts.set(c[0],ledge);
  }
  const previous=w.groundwaterWet??new Set();if(wet.size!==previous.size||[...wet].some(id=>!previous.has(id))){w.neighborCache.clear();w.pathCache.clear();w.traffic?.routes.clear();if(w.traffic)w.traffic.bodyNavigation=null;w.itemCellsRevision=-1;w.cachePoolRevision=-1;}w.groundwaterWet=wet;
  for(const [x,ledge] of contacts)if(!w.path(w.nest,ledge))contacts.delete(x);
  for(const p of w.patches)if(p.origin==='seep'&&p.amount>0&&contacts.get(p.cell[0])?.[1]!==p.cell[1])returnSeep(w,p);
  if(w.weather.raining)for(const column of g.columns.values())column.water=Math.min(column.capacity,column.water+elapsed*.025);
  for(const [x,c] of contacts){
    let column=g.columns.get(x);if(!column){column={water:48,capacity:48};g.columns.set(x,column);}
    let p=w.patches.find(p=>p.origin==='seep'&&p.cell[0]===x);if(!p){p={id:w.nextPatchID++,kind:'water',origin:'seep',cell:[...c],amount:0,capacity:2,renewable:false};w.patches.push(p);}if(p.cell[1]!==c[1]){returnSeep(w,p);p.cell=[...c];}
    const requested=Math.min(column.water,elapsed*.025,Math.max(0,2-p.amount)),added=addStock(w,p,requested);column.water-=added;
  }
}
export function groundwaterJSON(w){return {...w.groundwater,columns:[...w.groundwater.columns]};}
