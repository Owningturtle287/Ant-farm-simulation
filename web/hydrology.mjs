import {DAY,clamp} from './biology.mjs';
function terrainHash(x,seed){let h=(Math.imul(x,374761393)^seed)>>>0;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
import {addStock,removeStock} from './resources.mjs';
function wave(x,seed){const i=Math.floor(x),t=x-i,s=t*t*(3-2*t);return ((terrainHash(i,seed)%1000)*(1-s)+(terrainHash(i+1,seed)%1000)*s)/1000;}
export function initGroundwater(w,depth=56,data=null){w.groundwater=data?{...data,columns:new Map(data.columns??[])}:{depth,targetDepth:depth,shift:0,at:0,lastPlan:-1000,columns:new Map()};}
export function tableLevel(w,x){const g=w.groundwater;if(!g)return Infinity;w.waterShape??=new Map();let shape=w.waterShape.get(x);if(shape==null){const f=t=>wave(t/29,w.seed^0x831)*10+wave(t/71,w.seed^0x981)*6;shape=w.baseSurface(0)+f(x)-f(0);w.waterShape.set(x,shape);}return Math.max(w.baseSurface(x)+14,shape+g.depth+g.shift);}
export const flooded=(w,c)=>c[1]>=tableLevel(w,c[0])-.25;
export function groundwaterHumidity(w,c){const gap=tableLevel(w,c[0])-c[1];return gap<0?.99:clamp(.99-gap*.055,0,.99);}
export function tickGroundwater(w,time){
  const g=w.groundwater;if(!g||time-g.at<2)return;const elapsed=time-g.at;g.at=time;
  w.neighborCache.clear();w.pathCache.clear();const old=g.depth;g.depth+=clamp(g.targetDepth-g.depth,-elapsed*.035,elapsed*.035);g.shift=clamp(g.shift+(w.weather.raining?-.0005:.00009)*elapsed,-2,3);
  if(Math.abs(old-g.depth)>.001){w.climateRevision=-1;w.neighborCache.clear();w.pathCache.clear();w.itemCellsRevision=-1;}
  // Only an actually excavated, reachable capillary fringe exposes collectable seepage.
  const contacts=new Map();for(const id of w.excavated){const c=id.split(',').map(Number),gap=tableLevel(w,c[0])-c[1];if(gap>=.3&&gap<=2.2&&w.walkable(c)&&!w.onSurface(c)){const old=contacts.get(c[0]);if(!old||old[1]<c[1])contacts.set(c[0],c);}}
  for(const p of w.patches)if(p.origin==='seep'&&!contacts.has(p.cell[0])){const drained=removeStock(w,p,Math.min(p.amount,elapsed*.02),'drained'),column=g.columns.get(p.cell[0]);if(column)column.water=Math.min(column.capacity,column.water+drained);}
  for(const [x,c] of contacts){let column=g.columns.get(x);if(!column){column={water:48,capacity:48};g.columns.set(x,column);}if(w.weather.raining)column.water=Math.min(column.capacity,column.water+elapsed*.025);
    let p=w.patches.find(p=>p.origin==='seep'&&p.cell[0]===x);if(!p){p={id:w.nextPatchID++,kind:'water',origin:'seep',cell:[...c],amount:0,capacity:2,renewable:false};w.patches.push(p);}if(p.cell[1]!==c[1]){const drained=removeStock(w,p,p.amount,'drained');column.water=Math.min(column.capacity,column.water+drained);p.cell=[...c];}
    const requested=Math.min(column.water,elapsed*.025,Math.max(0,2-p.amount)),added=addStock(w,p,requested);column.water-=added;
  }
}
export function groundwaterJSON(w){return {...w.groundwater,columns:[...w.groundwater.columns]};}
