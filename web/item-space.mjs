import {spaceForItem} from './traffic.mjs';
// A shared third-cell lattice prevents ground items and brood beds from overlapping.
import {densityAt} from './geometry.mjs';
export const ITEM_UNIT=2,SUB=3;
export const slotKey=([x,y])=>Math.round(x*SUB)+','+Math.round(y*SUB);
export const cellKey=([x,y])=>x+','+y;
const owner=p=>'r:'+p.id;
export function initItemSpace(w){w.itemSlots=new Map();w.spaceReady=true;}
function hasNeighborSlot(w,pos,matches){
  const x=Math.round(pos[0]*SUB),y=Math.round(pos[1]*SUB);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const held=w.itemSlots.get((x+dx)+','+(y+dy));
    if(held&&matches(held))return true;
  }
  return false;
}
const isBed=id=>id.startsWith('b:');
const isCache=id=>id.startsWith('f:')||id.startsWith('a:');
export function reserveSlot(w,pos,id){
  const k=slotKey(pos),old=w.itemSlots.get(k);
  if((old&&old!==id)||(isCache(id)&&hasNeighborSlot(w,pos,isBed)))return false;
  w.itemSlots.set(k,id);
  return true;
}
export function releaseSlot(w,pos,id){const k=slotKey(pos);if(w.itemSlots.get(k)===id)w.itemSlots.delete(k);}
// Bed centers may be fractional. Two brood beds need two lattice steps of clearance.
export function freeCell(w,c,id=null){
  const center=w.itemSlots.get(slotKey(c));
  return (!center||center===id)&&!hasNeighborSlot(w,c,held=>held!==id&&(isBed(held)||isCache(held)));
}
export function holdCell(w,c,id){if(!freeCell(w,c,id))return false;return reserveSlot(w,c,id);}
export function releaseCell(w,c,id){releaseSlot(w,c,id);}
function resourcePositions(w,p){
  if(p.kind==='water'&&p.origin!=='seep'){
    const left=p.left??p.cell[0]-1,right=p.right??p.cell[0]+1,bottom=w.surface(p.cell[0])-.5,spill=Math.max(w.surface(left-1),w.surface(right+1))-.5;
    const rows=Math.max(1,Math.min(12,Math.ceil((bottom-spill)*SUB))),out=[];
    for(let row=0;row<rows;row++)for(let x=left;x<=right;x++)if(w.surface(x)===w.surface(p.cell[0]))for(let sub=-1;sub<=1;sub++)out.push([x+sub/SUB,Math.floor((bottom-(row+.5)/SUB)*SUB)/SUB]);
    return out.sort((a,b)=>b[1]-a[1]||Math.abs(a[0]-p.cell[0])-Math.abs(b[0]-p.cell[0])||a[0]-b[0]);
  }
  const out=[],[x,y]=p.cell;for(let ring=0;ring<=2;ring++)for(let dy=-2;dy<=0;dy++)for(let dx=-ring;dx<=ring;dx++)if(ring===0||Math.abs(dx)===ring)out.push([x+dx/SUB,y+dy/SUB]);return out;
}
export function allocatePieces(w,p,amount){
  p.pieces??=[];p.nextPieceID??=0;let placed=0;
  // A partially consumed item can refill, but never exceeds its own finite unit.
  for(const item of p.pieces){const n=Math.min(amount-placed,ITEM_UNIT-item.amount);if(n>0){item.amount+=n;placed+=n;}if(placed>=amount-1e-9)return placed;}
  for(const pos of resourcePositions(w,p)){
    if(placed>=amount-1e-9)break;if(w.itemSlots.has(slotKey(pos))||(p.kind==='food'&&p.origin!=='grass'&&!spaceForItem(w,pos,.10)))continue;
    if(densityAt(...pos,(x,y)=>w.solid([x,y]))>=.49)continue;
    const n=Math.min(ITEM_UNIT,amount-placed),item={id:p.nextPieceID++,pos,amount:n};p.pieces.push(item);if(w.traffic)w.traffic.itemDirty=true;reserveSlot(w,pos,owner(p));placed+=n;
  }return placed;
}
export function consumePieces(w,p,amount,preferred=null){
  if(!p.pieces)return;let remaining=amount;
  const ordered=preferred==null?p.pieces:[...p.pieces.filter(i=>i.id===preferred),...p.pieces.filter(i=>i.id!==preferred)];
  for(const item of ordered){const n=Math.min(remaining,item.amount);item.amount-=n;remaining-=n;if(item.amount<=1e-9)releaseSlot(w,item.pos,owner(p));if(remaining<=1e-9)break;}
  const count=p.pieces.length;p.pieces=p.pieces.filter(i=>i.amount>1e-9);if(w.traffic&&p.pieces.length!==count)w.traffic.itemDirty=true;
}
export function restorePieces(w){
  for(const p of w.patches){const amount=p.amount;p.pieces??=[];for(const item of p.pieces)if(item.amount>0&&(w.itemSlots.has(slotKey(item.pos))||!reserveSlot(w,item.pos,owner(p))))throw Error('Overlapping resource items in saved ground');if(!p.pieces.length&&amount>0){const placed=allocatePieces(w,p,amount);if(placed<amount-1e-7){p.amount=placed;if(w.resourceLedger)w.resourceLedger[p.kind].buried+=amount-placed;}}}
}
export function travelLanes(w){if(w.laneRevision!==w.revision){w.laneRevision=w.revision;w.lanes=new Set([w.nest.join(',')]);for(const r of w.rooms){const route=w.path(w.nest,r.center);if(route)for(const p of route)w.lanes.add(p.join(','));}}return w.lanes;}
export function openNestCells(w){if(w.itemCellsRevision!==w.revision){w.itemCellsRevision=w.revision;w.itemCells=[...w.excavated,...w.moundTunnels].map(k=>k.split(',').map(Number)).filter(c=>w.walkable(c)&&!w.onSurface(c)&&w.conditions(c).humidity<.88&&!travelLanes(w).has(c.join(','))&&[[1,0],[-1,0],[0,1],[0,-1]].filter(d=>w.walkable([c[0]+d[0],c[1]+d[1]])).length>=3);const seen=new Set();w.itemCells=w.itemCells.filter(c=>{const k=cellKey(c);if(seen.has(k))return false;seen.add(k);return true;});}return w.itemCells;}
export function broodBeds(w){
  const cells=openNestCells(w);
  if(w.bedPoolCells!==cells){
    w.bedPoolCells=cells;w.bedPools=new Map();w.bedCenters=[];
    for(const c of cells)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const x=c[0]*SUB+dx,y=c[1]*SUB+dy;
      if(x%2||y%2)continue;
      const pos=[x/SUB,y/SUB];
      if(densityAt(...pos,(sx,sy)=>w.solid([sx,sy]))<.40)w.bedCenters.push(pos);
    }
  }
  return w.bedCenters;
}
export function findBed(w,near,id=null){
  const centers=broodBeds(w),key=cellKey(near);
  let ordered=w.bedPools.get(key);
  if(!ordered){
    ordered=centers.map(c=>({c,d:Math.hypot(c[0]-near[0],c[1]-near[1])})).sort((a,b)=>a.d-b.d).map(v=>v.c);
    if(w.bedPools.size>=16)w.bedPools.delete(w.bedPools.keys().next().value);
    w.bedPools.set(key,ordered);
  }
  const best=ordered.find(c=>freeCell(w,c,id));
  return best?[...best]:null;
}
export function cachePositions(w,near){const cells=openNestCells(w);return [...cells].sort((a,b)=>Math.hypot(a[0]-near[0],a[1]-near[1])-Math.hypot(b[0]-near[0],b[1]-near[1])).flatMap(c=>{const out=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)out.push([c[0]+x/SUB,c[1]+y/SUB]);return out;});}
export function findCacheSlot(w,near,avoid=null){
  const anchor=cellKey(near);if(w.cachePoolRevision!==w.revision||w.cachePoolAnchor!==anchor){w.cachePoolRevision=w.revision;w.cachePoolAnchor=anchor;w.cachePool=cachePositions(w,near);w.cacheCursor=0;}
  for(let i=0;i<w.cachePool.length;i++){const p=w.cachePool[i];if((!avoid||Math.hypot(p[0]-avoid[0],p[1]-avoid[1])>=1.5)&&!w.itemSlots.has(slotKey(p))&&!hasNeighborSlot(w,p,isBed)&&w.walkable(p.map(Math.round))&&w.conditions(p.map(Math.round)).humidity<.88&&spaceForItem(w,p,.115,null,'cache')&&densityAt(...p,(x,y)=>w.solid([x,y]))<.42)return [...p];}return null;
}
