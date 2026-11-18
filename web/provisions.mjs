import {clamp} from './biology.mjs';
import {initItemSpace,restorePieces,findBed,freeCell,holdCell,releaseCell,findCacheSlot,reserveSlot,releaseSlot,ITEM_UNIT,broodBeds} from './item-space.mjs';
export const cropCapacity=a=>1.2+(a.bodySize??.4)*2.4;
export const waterCapacity=a=>cropCapacity(a)*.85;
export const foodFill=a=>(a.socialFood??0)+(a.socialProtein??0);
export function initCrop(a){a.socialFood??=0;a.socialProtein??=0;a.socialWater??=0;}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const anchor=c=>c.world.rooms.find(r=>r.kind==='storage')?.center??c.world.nest;
export function updateSupplyTotals(c){let energy=0,protein=0,water=0;for(const a of c.ants){initCrop(a);energy+=a.socialFood;protein+=a.socialProtein;water+=a.socialWater;if(a.cargoKind==='food'||a.cargoKind==='broodMeal'){energy+=a.carried*(a.cargoNutrition?.energy??.5);protein+=a.carried*(a.cargoNutrition?.protein??.5);}}for(const p of c.foodItems){energy+=p.energy;protein+=p.protein;}c.nutrition={energy,protein,water};}
function legacyAnnex(c){
  const w=c.world,index=w.rooms.filter(r=>r.legacyAnnex).length,x=(index%2?-1:1)*(12+Math.floor(index/2)*11),y=Math.max(w.baseSurface(x)+5,11),center=[x,y],previous=w.rooms.filter(r=>r.kind==='storage').at(-1)?.center??w.nest;
  const added=[];for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-4;xx<=x+4;xx++)added.push([xx,yy]);let p=[...previous];while(p[0]!==x||p[1]!==y){p=[...p];if(p[0]!==x)p[0]+=Math.sign(x-p[0]);else p[1]+=Math.sign(y-p[1]);added.push(p);}
  for(const q of added)if(w.solid(q)&&q[1]>=w.baseSurface(q[0])){w.excavated.add(q.join(','));w.soilExcavated++;w.soilAbandoned++;w.changed(q);}
  w.rooms.push({kind:'storage',center,rx:4,ry:2,legacyAnnex:true});return center;
}
export function initializeSupplies(c,legacy=null){
  const w=c.world;initItemSpace(w);c.foodItems??=[];c.nextFoodID??=0;c.supplyVersion=1;c.nutrition={energy:0,protein:0,water:0};
  for(const a of c.ants)initCrop(a);
  restorePieces(w);
  for(const p of c.foodItems)if(!reserveSlot(w,p.pos,'f:'+p.id))throw Error('Overlapping food cache in the saved nest');
  for(const b of c.brood){
    if(b.carriedBy!=null)continue;
    const position=bedPosition(b);
    let bed=w.walkable(b.cell)&&!w.onSurface(b.cell)&&freeCell(w,position,'b:'+b.id)?position:findBed(w,b.home??w.nest,'b:'+b.id);
    if(!bed&&legacy){legacyAnnex(c);bed=findBed(w,w.nest,'b:'+b.id);}
    if(!bed||!bedOccupy(c,b,bed))throw Error('A brood item has no individual bed');
  }
  for(const a of c.ants){if(a.cacheSlot&&!reserveSlot(w,a.cacheSlot,'a:'+a.id))a.cacheSlot=null;if(a.broodDestination&&a.broodID!=null&&['toBrood','carryingBrood'].includes(a.task)&&!holdCell(w,a.broodDestination,'b:'+a.broodID))a.broodDestination=null;}
  if(legacy){
    // Existing virtual reserves become explicit parcels once. New food always needs worker excavation.
    c.foodItems=[];c.nextFoodID=0;for(const a of c.ants){a.socialFood=0;a.socialProtein=0;a.socialWater=0;}
    const total=(legacy.food??0)+(legacy.protein??0);addReserve(c,'energy',total,true);if(total>0)for(const p of c.foodItems){p.protein=p.energy*(legacy.protein??0)/total;p.energy-=p.protein;}setReserve(c,'water',legacy.water??0);
    let carriedWater=0;for(const a of c.ants)if(a.cargoKind==='water'&&a.carried){carriedWater+=a.carried;a.deliveryAmount=a.carried;a.deliveryKind='water';a.carried=0;a.cargoKind=null;}if(carriedWater)setReserve(c,'water',c.water+carriedWater);
    if(w.rooms.some(r=>r.legacyAnnex))c.record('Older reserves received individual beds and cache spaces. Earth removed for the one-time annex is recorded in the soil balance.');
  }
  updateSupplyTotals(c);if(legacy||!c.supplyLedger)c.supplyLedger=Object.fromEntries(['energy','protein','water'].map(k=>[k,{introduced:c.nutrition[k],consumed:0,lost:0}]));
}
function addReserve(c,kind,amount,expand=false){
  let left=amount;for(let attempt=0;left>1e-9&&attempt<200000;attempt++){
    let pos=findCacheSlot(c.world,anchor(c));if(!pos){if(!expand)break;legacyAnnex(c);pos=findCacheSlot(c.world,anchor(c));if(!pos)break;}
    const n=Math.min(ITEM_UNIT,left),item={id:c.nextFoodID++,pos,energy:kind==='energy'?n:0,protein:kind==='protein'?n:0,createdAt:c.time};c.foodItems.push(item);reserveSlot(c.world,pos,'f:'+item.id);left-=n;
  }return amount-left;
}
export function setReserve(c,kind,value){
  value=Math.max(0,Number(value)||0);const before=c.nutrition?.[kind]??0;if(!c.nutrition){c['_'+kind]=value;return;}
  if(kind==='water'){
    let left=value;for(const a of c.ants){initCrop(a);a.socialWater=Math.min(waterCapacity(a),left);left-=a.socialWater;}
    // Legacy excess is released outside, never made into an indoor water stockpile.
    if(left>1e-8){const before=c.world.resourceLedger.water.created;c.world.place('water',c.world.entrance()[0]+3,left);const runoff=Math.max(0,left-(c.world.resourceLedger.water.created-before));c.world.resourceLedger.water.created+=runoff;c.world.resourceLedger.water.runoff=(c.world.resourceLedger.water.runoff??0)+runoff;c.releasedLegacyWater=(c.releasedLegacyWater??0)+left;}
  }else{
    updateSupplyTotals(c);let delta=value-c.nutrition[kind];const field=kind==='energy'?'socialFood':'socialProtein';
    if(delta<0){let left=-delta;for(const a of c.ants){const n=Math.min(left,a[field]??0);a[field]-=n;left-=n;}for(const p of c.foodItems){const n=Math.min(left,p[kind]);p[kind]-=n;left-=n;}cleanCache(c);}else if(delta>0)addReserve(c,kind,delta,true);
  }updateSupplyTotals(c);if(c.supplyLedger)c.supplyLedger[kind].introduced+=c.nutrition[kind]-before;
}
export function cleanCache(c){c.foodItems=c.foodItems.filter(p=>{if(p.energy+p.protein>1e-9)return true;releaseSlot(c.world,p.pos,'f:'+p.id);return false;});}
export function consumeSelf(c,a,dt){
  initCrop(a);const food=Math.min(a.socialFood,(1-a.energy)*.4,dt*.05),water=Math.min(a.socialWater,(1-a.hydration)*.15,dt*.018);
  const protein=a.socialFood<.001?Math.min(a.socialProtein,(1-a.energy)*.6,dt*.02):0;a.socialProtein-=protein;a.energy=clamp(a.energy+protein/.6);if(protein){c.nutrition.protein-=protein;if(c.supplyLedger)c.supplyLedger.protein.consumed+=protein;}
  a.socialFood-=food;a.socialWater-=water;a.energy=clamp(a.energy+food/.4);a.hydration=clamp(a.hydration+water/.15);c.nutrition.energy=Math.max(0,c.nutrition.energy-food);c.nutrition.water=Math.max(0,c.nutrition.water-water);if(c.supplyLedger){c.supplyLedger.energy.consumed+=food;c.supplyLedger.water.consumed+=water;}
}
export function fillFromCargo(a){
  if(a.cargoKind!=='food'||!a.carried)return 0;const n=Math.min(a.carried,Math.max(0,cropCapacity(a)-foodFill(a))),mix=a.cargoNutrition??{energy:.5,protein:.5};a.socialFood+=n*mix.energy;a.socialProtein+=n*mix.protein;a.carried-=n;if(a.carried<1e-9){a.carried=0;a.cargoKind=null;}return n;
}
export function takeQueenMeal(c,donor,queen){
  const room=Math.max(0,cropCapacity(queen)*.9-foodFill(queen));
  const protein=Math.min(.35,Math.max(0,.65-queen.socialProtein),donor.socialProtein,room);
  const food=Math.min(.5,Math.max(0,1.15-queen.socialFood),donor.socialFood,room-protein);
  const water=Math.min(.3,Math.max(0,waterCapacity(queen)*.9-queen.socialWater),donor.socialWater);
  donor.socialProtein-=protein;queen.socialProtein+=protein;
  donor.socialFood-=food;queen.socialFood+=food;
  donor.socialWater-=water;queen.socialWater+=water;
  const moved=food+protein+water;
  if(moved>0)c.socialTransfers++;
  return moved;
}
export function takeCache(c,a,item){
  if(!item||dist(a.pos,item.pos)>1.4)return false;let total=item.energy+item.protein,moved=0,n=Math.min(total,Math.max(0,cropCapacity(a)-foodFill(a)));
  if(n>1e-9){const e=n*item.energy/total,p=n-e;item.energy-=e;item.protein-=p;a.socialFood+=e;a.socialProtein+=p;moved+=n;}
  // A nurse can bring a grain portion to larvae with a full crop.
  total=item.energy+item.protein;if(a.cachePurpose==='care'&&a.socialProtein<.05&&!a.carried&&!a.carryingBrood&&item.protein>.001&&total>1e-9){n=Math.min(ITEM_UNIT,total,cropCapacity(a));const e=n*item.energy/total,p=n-e;item.energy-=e;item.protein-=p;a.carried=n;a.cargoKind='broodMeal';a.cargoNutrition={energy:e/n,protein:p/n};a.cargoOrigin=item.origin;moved+=n;}
  cleanCache(c);return moved>0;
}
export function liftCache(c,a,item){
  if(!item||a.carried||a.carryingBrood||dist(a.pos,item.pos)>.8)return false;
  const total=item.energy+item.protein;if(total<=1e-9)return false;
  a.carried=total;a.cargoKind='food';a.cargoNutrition={energy:item.energy/total,protein:item.protein/total};a.cargoOrigin=item.origin;
  a.cacheClearance={pos:[...item.pos],until:c.time+30};item.energy=0;item.protein=0;cleanCache(c);return true;
}
export function feedBroodCargo(c,a,wanted){
  if(a.cargoKind!=='broodMeal'||!a.carried||!(a.cargoNutrition?.protein>0))return 0;const mix=a.cargoNutrition,n=Math.min(a.carried,wanted/mix.protein),protein=n*mix.protein,energy=n*mix.energy;a.carried-=n;c.nutrition.energy-=energy;c.nutrition.protein-=protein;c.supplyLedger.energy.consumed+=energy;c.supplyLedger.protein.consumed+=protein;if(a.carried<1e-9){a.carried=0;a.cargoKind=null;a.cargoNutrition=null;}return protein;
}
export function nearestCache(c,a,protein=false){
  const candidates=c.foodItems.filter(p=>c.world.walkable(p.pos.map(Math.round))&&(protein?p.protein>.001:p.energy>.001));let best=null,d=Infinity;for(const p of candidates){const n=dist(a.pos,p.pos)+(protein?p.energy:p.protein)/Math.max(.001,p.energy+p.protein)*12;if(n<d){d=n;best=p;}}return best;
}
export function cacheSlotFor(c,a){const p=findCacheSlot(c.world,anchor(c),a.cacheClearance?.until>c.time?a.cacheClearance.pos:null);if(p)reserveSlot(c.world,p,'a:'+a.id);return p;}
export function storeCargo(c,a){
  if(!a.cacheSlot||dist(a.pos,a.cacheSlot)>1.4||a.cargoKind!=='food'||!a.carried)return false;
  const n=Math.min(ITEM_UNIT,a.carried),mix=a.cargoNutrition??{energy:.5,protein:.5};
  const item={id:c.nextFoodID,pos:[...a.cacheSlot],energy:n*mix.energy,protein:n*mix.protein,createdAt:c.time};
  if(a.cargoOrigin)item.origin=a.cargoOrigin;
  releaseSlot(c.world,a.cacheSlot,'a:'+a.id);
  if(!reserveSlot(c.world,item.pos,'f:'+item.id))return false;
  c.nextFoodID++;c.foodItems.push(item);a.carried-=n;a.cacheSlot=null;
  if(a.carried<1e-9){a.carried=0;a.cargoKind=null;a.cargoOrigin=null;}
  return true;
}
export function consumeNutrient(c,a,kind,amount){const field=kind==='energy'?'socialFood':kind==='protein'?'socialProtein':'socialWater',n=Math.min(amount,a[field]??0);a[field]-=n;c.nutrition[kind]=Math.max(0,c.nutrition[kind]-n);if(c.supplyLedger)c.supplyLedger[kind].consumed+=n;return n;}
export function bedPosition(b){
  return b.bed&&b.bed.every((value,i)=>Math.round(value)===b.cell[i])?b.bed:b.cell;
}
export function bedAvailable(c,b,near){return findBed(c.world,near,'b:'+b.id);}
export function bedOccupy(c,b,pos){
  if(!holdCell(c.world,pos,'b:'+b.id))return false;
  b.cell=pos.map(n=>Math.round(n)||0);
  if(pos.some((value,i)=>value!==b.cell[i]))b.bed=[...pos];else delete b.bed;
  return true;
}
export function bedRelease(c,b){releaseCell(c.world,bedPosition(b),'b:'+b.id);}
export function freeBedCount(c){return broodBeds(c.world).filter(p=>freeCell(c.world,p)).length;}

export function supplyBalance(c,kind){const held=c.nutrition[kind],l=c.supplyLedger[kind];return {held,...l,error:l.introduced-held-l.consumed-l.lost};}
export function accountIntake(c,kind,n,mix={energy:.5,protein:.5}){if(kind==='water')c.supplyLedger.water.introduced+=n;else{c.supplyLedger.energy.introduced+=n*mix.energy;c.supplyLedger.protein.introduced+=n*mix.protein;}}
export function accountDeath(c,a){for(const [kind,n] of [['energy',a.socialFood+((a.cargoKind==='food'||a.cargoKind==='broodMeal')?a.carried*(a.cargoNutrition?.energy??.5):0)],['protein',a.socialProtein+((a.cargoKind==='food'||a.cargoKind==='broodMeal')?a.carried*(a.cargoNutrition?.protein??.5):0)],['water',a.socialWater]])c.supplyLedger[kind].lost+=n;}

export function rebuildReservations(c){
  const w=c.world;w.itemSlots=new Map();
  for(const p of w.patches)for(const i of p.pieces??[])if(i.amount>1e-9){if(!reserveSlot(w,i.pos,'r:'+p.id))throw Error('Surface resource overlap');}
  for(const p of c.foodItems)if(!reserveSlot(w,p.pos,'f:'+p.id))throw Error('Food cache overlap');
  const living=new Set(c.brood.map(b=>b.id));
  for(const b of c.brood)if(b.carriedBy==null&&!holdCell(w,bedPosition(b),'b:'+b.id))throw Error('Brood bed overlap');
  for(const a of c.ants){
    if(a.broodDestination&&living.has(a.broodID)&&['toBrood','carryingBrood'].includes(a.task)){if(!holdCell(w,a.broodDestination,'b:'+a.broodID))a.broodDestination=null;}else a.broodDestination=null;
    if(a.cacheSlot&&a.task==='storeFood'&&a.carried&&a.cargoKind==='food'){if(!reserveSlot(w,a.cacheSlot,'a:'+a.id))a.cacheSlot=null;}else a.cacheSlot=null;
  }
}
