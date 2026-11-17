import {canOccupy,settleAdults,beginTraffic,routeAroundItems,nearestStance,sweptFree} from '../web/traffic.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Colony,World,key,LIMIT,DAY,BROOD_DURATION,createAnt,Random,distance} from '../web/sim.mjs';
import {MATERIALS,baseMaterial} from '../web/materials.mjs';
import {terrainHeight,basins,tickHabitat,harvest} from '../web/ecology.mjs';
import {initializeBrain,recognize,cropCapacity} from '../web/fire-ant.mjs';
import {resourceTiles,resourceBalance,initLedger,addStock} from '../web/resources.mjs';
import {emit,senseSignal,decaySignals} from '../web/signals.mjs';
import {curvedPassage,chamberCells,terrainMask,densityAt,CONTOUR_SAMPLES} from '../web/geometry.mjs';
import {planPeripheralExit,planMoundPassage} from '../web/architecture.mjs';
import {broodStage} from '../web/biology.mjs';
import {advanceSimulation} from '../web/clock.mjs';
import {cropCapacity as socialCapacity,waterCapacity,foodFill,consumeSelf,shareCrops,updateSupplyTotals,supplyBalance,accountIntake,bedRelease,bedOccupy,initializeSupplies} from '../web/provisions.mjs';
import {tickGroundwater,tableLevel} from '../web/hydrology.mjs';
import {freeCell,slotKey,findBed,holdCell,releaseCell,openNestCells,initItemSpace} from '../web/item-space.mjs';
import {SaveStore,SAVE_KEY,decodeSave} from '../web/persistence.mjs';
function primeCrop(c,a,food=0,protein=0,water=0){for(const [field,kind,n] of [['socialFood','energy',food],['socialProtein','protein',protein],['socialWater','water',water]]){c.supplyLedger[kind].introduced+=n-(a[field]??0);a[field]=n;}updateSupplyTotals(c);}
function clearBrood(c){for(const b of c.brood)bedRelease(c,b);c.brood=[];}
const run=(c,seconds)=>{for(let i=0;i<seconds*10;i++)c.step();return c;};
test('a route still moves the body when its logical cell already equals the goal',()=>{
 const c=new Colony(),a=c.ants[1];c.ants=[a];c.brood=[];c.foodItems=[];c.world.patches=[];c.world.carve([0,20],4,4);a.cell=[0,20];a.pos=[.4,20.4];a.motion.angle=0;beginTraffic(c);const route=routeAroundItems(c.world,a,[0,20]);assert.ok(route?.length,'Logical arrival cannot leave the actual body outside contact range.');
});
test('a route through occupied brood space connects body-clear segments rather than only clear endpoints',async()=>{
 const {sweptFree}=await import('../web/traffic.mjs'),{moveAnt,updateMotion}=await import('../web/locomotion.mjs');const c=new Colony(),a=c.ants[1];c.ants=[a];c.foodItems=[];c.world.patches=[];c.world.carve([0,20],4,5);c.brood=[20,21].map((y,id)=>({id:900+id,cell:[0,y],age:0,carriedBy:null}));a.cell=[0,19];a.pos=[0,19];a.motion.angle=0;beginTraffic(c);const route=routeAroundItems(c.world,a,[0,22]);assert.ok(route?.length);let prior=a.pos,angle=a.motion.angle;for(const point of route){const heading=point[2]??Math.atan2(point[1]-prior[1],point[0]-prior[0]);assert.ok(sweptFree(c.world,a,prior,point,heading,angle),'Every planned transition must fit the body around the brood.');prior=point;angle=heading;}
 a.route=route;a.task='returningFood';a.carried=1;for(let i=0;i<500&&a.route.length;i++){updateMotion(a,c.world,i*.1,.1,new Map());moveAnt(a,c.world,i*.1,.1);assert.ok(canOccupy(c.world,a,a.pos));}assert.ok(distance(a.pos,[0,22])<.08,'The actuator must actually finish the planned body path.');
});
test('opposing workers pass through a narrow tunnel without overlapping or abandoning movement',()=>{
 const c=new Colony(),a=c.ants[1],b=c.ants[2],w=c.world;c.ants=[a,b];c.brood=[];c.foodItems=[];w.patches=[];const open=new Set();for(let x=0;x<=8;x++)open.add(key([x,20]));open.add('4,19');open.add('3,19');open.add('5,19');w.solid=p=>!open.has(key(p));w.neighborCache.clear();w.pathCache.clear();
 for(const [i,n] of c.ants.entries()){n.pos=[i*8,20];n.cell=[...n.pos];n.motion.angle=i?Math.PI:0;n.task='routeTest';n.destination=[i?0:8,20];n.busyUntil=0;}beginTraffic(c);for(const n of c.ants)n.route=routeAroundItems(w,n,n.destination);assert.ok(a.route&&b.route);
 for(let i=0;i<600&&(a.pos[0]<7.8||b.pos[0]>.2);i++){c.time+=.1;beginTraffic(c);for(const n of c.ants)c.updateAnt(n,.1);assert.ok(canOccupy(w,a,a.pos));assert.ok(canOccupy(w,b,b.pos));}assert.ok(a.pos[0]>7.8&&b.pos[0]<.2,'Both workers must complete the crossing.');
});
test('cached parcels are walkable while moving one preserves its nutrients',async()=>{
 const {liftCache}=await import('../web/provisions.mjs'),{refreshItems}=await import('../web/traffic.mjs'),{moveAnt,updateMotion}=await import('../web/locomotion.mjs');const c=new Colony(),a=c.ants[1];c.ants=[a];c.brood=[];c.world.patches=[];c.foodItems=[];c.world.carve([0,20],4,4);a.pos=[0,20];a.cell=[0,20];a.motion.angle=0;
 for(const y of[-.5,.5])for(let x=-2;x<=2;x++)c.foodItems.push({id:c.foodItems.length,pos:[x/3,20+y],energy:1.5,protein:.5});for(const x of[-2,2])c.foodItems.push({id:c.foodItems.length,pos:[x/3,20],energy:1.5,protein:.5});beginTraffic(c);assert.ok(canOccupy(c.world,a,a.pos));assert.ok(routeAroundItems(c.world,a,[0,18])?.length);
 const item=c.foodItems.find(p=>p.pos[0]===0&&p.pos[1]<20),before=c.foodItems.reduce((n,p)=>n+p.energy+p.protein,0);assert.ok(liftCache(c,a,item));refreshItems(c);assert.equal(c.foodItems.reduce((n,p)=>n+p.energy+p.protein,0)+a.carried,before);assert.deepEqual(a.cargoNutrition,{energy:.75,protein:.25});a.route=routeAroundItems(c.world,a,[0,18]);assert.ok(a.route?.length);a.task='storeFood';for(let i=0;i<300&&a.route.length;i++){updateMotion(a,c.world,i*.1,.1,new Map());moveAnt(a,c.world,i*.1,.1);assert.ok(canOccupy(c.world,a,a.pos));}assert.ok(distance(a.pos,[0,18])<.08);
});
test('cancelled brood trips release their destination while completed beds remain occupied',()=>{
 const c=new Colony(),a=c.ants[1],b=c.brood[0],pending=[16,20];c.world.carve(pending,3,3);assert.ok(holdCell(c.world,pending,'b:'+b.id));a.broodID=b.id;a.broodDestination=pending;a.task='toBrood';c.releaseBrood(a);assert.ok(freeCell(c.world,pending));assert.equal(freeCell(c.world,b.cell),false);
 // A nurse loaded from an older save can still reference the bed it already filled.
 a.broodID=b.id;a.broodDestination=[...b.cell];a.task='nursing';c.releaseBrood(a);assert.equal(freeCell(c.world,b.cell),false);
});
test('an old blocked waypoint cannot cancel a newly assigned reachable trip',()=>{
 const c=new Colony(),a=c.ants[1];c.ants=[a];c.brood=[];c.foodItems=[];c.world.patches=[];c.world.carve([0,20],4,4);a.pos=[0,20];a.cell=[0,20];a.lastProgressPos=[...a.pos];a.lastProgressAt=29;a.motion.progressAt=0;a.motion.progressTarget='-2,20';a.task='refueling';a.busyUntil=0;c.time=30;beginTraffic(c);assert.ok(c.send(a,[2,20]));c.auditProgress(a);assert.deepEqual(a.destination,[2,20]);assert.ok(a.route.length);
});
test('a loaded forager finishes a long trip around finite grain piles',()=>{
 const c=new Colony(287),a=c.ants[1];c.ants=[a];c.brood=[];a.pos=[21,0];a.cell=[21,0];a.motion.angle=Math.PI;a.task='returningFood';a.carried=2;a.cargoKind='food';a.deliveryKind='food';a.deliveryAmount=2;a.cargoNutrition={energy:.8,protein:.2};c.supplyLedger.energy.introduced+=1.6;c.supplyLedger.protein.introduced+=.4;updateSupplyTotals(c);a.cargoKind='food';beginTraffic(c);a.destination=[...c.world.nest];a.route=routeAroundItems(c.world,a,c.world.nest);assert.ok(a.route?.length);
 for(let i=0;i<1200&&c.foodDelivered<2;i++){c.time+=.1;beginTraffic(c);c.updateAnt(a,.1);assert.ok(canOccupy(c.world,a,a.pos));}assert.equal(c.foodDelivered,2);assert.ok(distance(a.pos,c.world.nest)<=3);for(const kind of ['energy','protein'])assert.ok(Math.abs(supplyBalance(c,kind).error)<1e-6);
});
test('diggers can work from a clear fractional stance beside an occupied approach cell',async()=>{
 const {moveAnt,updateMotion}=await import('../web/locomotion.mjs');const c=new Colony(),a=c.ants[1],w=c.world;c.ants=[a];c.foodItems=[];w.patches=[];c.brood=[{id:900,cell:[4,20],age:0,carriedBy:null}];const open=new Set();for(let x=0;x<=4;x++)for(const y of[19,20])open.add(key([x,y]));w.solid=p=>!open.has(key(p));w.construction=[[5,20]];w.frontierVersion=-1;w.pathCache.clear();w.neighborCache.clear();a.pos=[3,19];a.cell=[3,19];a.motion.angle=0;beginTraffic(c);assert.ok(c.assignDig(a));
 for(let i=0;i<300&&a.route.length;i++){updateMotion(a,w,i*.1,.1,new Map());moveAnt(a,w,i*.1,.1);assert.ok(canOccupy(w,a,a.pos));}assert.ok(distance(a.pos,[5,20])<=1.25);a.busyUntil=0;c.updateAnt(a,.1);assert.equal(a.task,'digging');
});
test('small seeded colonies forage, excavate, grow a mound, and develop brood',()=>{
  for(const seed of [17,287,914]){
    const c=new Colony(seed);c.food=2;c.water=1;for(let i=0;i<12000&&!(c.foodDelivered>0&&c.waterDelivered>0&&c.world.soilDeposited>0&&c.births>0);i++)c.step();
    assert.ok(c.foodDelivered>0,'seed '+seed+' must return food during a shortage');assert.ok(c.waterDelivered>0,'seed '+seed+' must return water');assert.ok(c.births>0);assert.ok(c.world.soilDeposited>0);assert.ok(c.alive);
    const cargo=c.ants.filter(a=>a.task==='haulingSoil').reduce((sum,a)=>sum+a.carried,0);
    assert.equal(c.world.soilExcavated,c.world.soilDeposited+c.world.soilAbandoned+cargo);
    assert.ok(c.ants.every(a=>c.world.walkable(a.cell)));assert.ok(c.ants.length<=c.settings.populationCap);
  }
});
test('routes remain connected, tall mound walls can be climbed, and solid goals are rejected',()=>{
  const w=new World(9);for(const y of [-2,-1,0])w.deposits.add(key([3,y]));w.heights.set(3,-2);
  const route=w.path(w.nest,[4,0]);assert.ok(route.some(c=>c[1]<-1));let prior=w.nest;
  for(const next of route){assert.ok(w.neighbors(prior).some(n=>key(n)===key(next)));prior=next;}
  assert.equal(w.path(w.nest,[60,50]),null);
});
test('new saves continue seeded behavior exactly',()=>{
  const a=run(new Colony(88),80),b=Colony.fromJSON(JSON.parse(JSON.stringify(a)));
  a.place('food',7);b.place('food',7);run(a,40);run(b,40);assert.deepEqual(a.toJSON(),b.toJSON());
});
test('existing v1 colonies migrate without losing ants, excavated terrain, deposits, or elapsed days',()=>{
  const raw=readFileSync(new URL('./fixtures/v1-colony.json',import.meta.url),'utf8'),old=JSON.parse(raw).colony,c=decodeSave(raw);
  assert.equal(c.ants.length,old.ants.length);assert.equal(c.time,old.time);assert.equal(c.world.soilDeposited,old.world.soilDeposited);
  assert.deepEqual([...c.world.excavated],old.world.excavated);assert.equal(c.world.deposits.size,old.world.deposits.length);
  assert.ok(c.ants.some(a=>a.caste==='major'));assert.equal(c.settings.populationCap,120);
  run(c,60);assert.ok(c.ants.every(a=>Number.isFinite(a.health)));assert.ok(c.alive);
});
test('autosave recovers a valid backup and protects unreadable progress',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},store=new SaveStore(storage),c=run(new Colony(),30);
  store.save(c);run(c,20);store.save(c);assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).version,4);storage.setItem(SAVE_KEY,'broken');
  const recovered=store.load();assert.equal(recovered.recovered,true);assert.ok(Math.abs(recovered.colony.time-30)<.001);
  storage.setItem(SAVE_KEY+'.backup','broken');assert.throws(()=>store.load());assert.equal(store.save(c),false);assert.equal(storage.getItem(SAVE_KEY),'broken');assert.equal(store.save(c,true),true);
});
test('critical starvation causes mortality, invalid steps are ignored, and births honor a changeable ceiling',()=>{
  const c=new Colony();c.food=0;c.water=0;c.world.patches=[];c.ants=c.ants.filter(a=>a.caste==='queen');
  Object.assign(c.ants[0],{energy:.01,hydration:.01,health:.1});run(c,300);assert.equal(c.alive,false);
  const time=c.time;for(const dt of [NaN,-1,100])c.step(dt);assert.equal(c.time,time);
  const full=new Colony(9,{populationCap:60}),template=full.ants[1];
  for(let id=1000;full.ants.length<59;id++)full.ants.push({...structuredClone(template),id});
  full.brood.forEach(b=>b.age=BROOD_DURATION+1);full.step();assert.equal(full.ants.length,60);
  full.setSettings({populationCap:20});assert.equal(full.ants.length,60,'Lowering a ceiling must not cull existing ants.');
});
test('laying and development controls change separate biological processes and survive saves',()=>{
  const off=new Colony(44,{eggRate:0,broodRate:.25}),normal=new Colony(44,{eggRate:1,broodRate:.25}),fast=new Colony(44,{eggRate:4,broodRate:.25});
  for(const c of [off,normal,fast])run(c,600);
  assert.equal(off.eggsLaid,0);assert.ok(normal.eggsLaid>0);assert.ok(fast.eggsLaid>normal.eggsLaid);
  const slow=new Colony(22,{broodRate:.25}),quick=new Colony(22,{broodRate:4});run(slow,40);run(quick,40);
  assert.ok(quick.brood[0].age>slow.brood[0].age);
  const restored=Colony.fromJSON(JSON.parse(JSON.stringify(fast)));assert.deepEqual(restored.settings,fast.settings);
  assert.equal(new Colony().ants.length,13);assert.equal(new Colony(1,{startingWorkers:6}).ants.length,7);
});
test('young workers can switch to resource work during a shortage instead of following fixed ID jobs',()=>{
  const c=new Colony(99),a=c.ants[1];a.cell=[...c.world.nest];a.pos=[...a.cell];a.initialAgeDays=1;
  a.traits={...a.traits,forage:.8,water:.8,care:.8,dig:.8};c.food=0;c.protein=0;c.water=0;c.updateDemand();a.knownNeeds=null;c.chooseJob(a);
  assert.ok(['forage','water'].includes(a.lastJob));assert.ok(['exploring','toFood','toWater'].includes(a.task));
});
test('source memories are not omniscient and lose reliability after an actual failed visit',()=>{
  const c=new Colony(17),a=c.ants[1];c.world.place('food',-19);const food=c.world.patches.find(p=>p.kind==='food'&&p.cell[0]===-19);
  c.world.patches=[food];beginTraffic(c);a.cell=[-17,c.world.surface(-17)-1];a.pos=[...a.cell];a.foragingKind='food';assert.ok(c.discover(a));food.amount=0;
  a.cell=[10,c.world.surface(10)-1];a.pos=[...a.cell];assert.ok(c.discover(a));assert.deepEqual(a.target,food.cell,'Distant depletion is not magically known.');
  a.cell=[...food.cell];a.pos=[...a.cell];a.route=[];a.busyUntil=0;c.updateAnt(a,.1);
  assert.ok(a.memories[0].confidence<.85);assert.equal(a.memories[0].failures,1);assert.ok(a.memories[0].avoidUntil>c.time);
});
test('recruitment requires a nearby returning nestmate',()=>{
  const c=new Colony(2),scout=c.ants[1],donor=c.ants[2];Object.assign(donor,{cell:[3,0],pos:[3,0],task:'returningFood',memory:[-19,0],carried:2.5});
  scout.cell=[50,0];scout.pos=[50,0];scout.encounterAt=0;c.time=5;c.occupancy=new Map([[key(donor.cell),[donor]]]);c.encounter(scout);assert.equal(scout.memories.length,0);
  scout.cell=[2,0];scout.pos=[2,0];scout.encounterAt=0;c.encounter(scout);assert.equal(scout.memories.length,0,'Contact activation must not convey remote coordinates.');assert.equal(scout.brain.recruitedKind,'food');assert.ok(scout.brain.recruitUntil>c.time);assert.equal(c.recruitments,1);
});
test('larvae need actual local care and protein rather than a global nurse bonus',()=>{
  const c=new Colony(12),nurse=c.ants[1],b=c.brood[0];c.brood=[b];b.age=BROOD_DURATION*.4;b.nutrition=0;b.lastCare=0;
  Object.assign(nurse,{task:'nursing',broodID:b.id,cell:[40,0],pos:[40,0],route:[],busyUntil:0});
  c.updateAnt(nurse,.1);assert.equal(b.nutrition,0);const age=b.age;c.updateBrood(5);assert.equal(b.age,age);
  c.time=20;primeCrop(c,nurse,0,.5,0);Object.assign(nurse,{cell:[...b.cell],pos:[...b.cell],route:[],busyUntil:0,task:'nursing'});c.updateAnt(nurse,.1);
  assert.ok(b.nutrition>0);c.updateBrood(5);assert.ok(b.age>age);
  b.nutrition=0;c.protein=0;primeCrop(c,nurse,0,0,0);nurse.task='nursing';nurse.route=[];nurse.busyUntil=0;c.updateAnt(nurse,.1);assert.equal(b.nutrition,0);
});
test('every depth is soft diggable earth and deposited spoil stays distinct',()=>{
  const w=new World(5);for(const y of [12,26,60,500,5000]){assert.equal(w.material([0,y]),'earth');assert.equal(w.digTime([0,y]),w.digTime([0,12]));}
  assert.ok(!Object.keys(MATERIALS).includes('rock'));w.planRoom(new Random(1));const site=w.frontier()[0],origin=w.material(site);assert.ok(w.excavate(site));
  const pile=w.depositSite();assert.ok(w.deposit(pile,origin));assert.equal(w.material(pile),'spoil');assert.equal(w.spoilOrigins.get(key(pile)),origin);
  w.groundwater.depth=w.groundwater.targetDepth=6000;w.excavated.add(key([0,4999]));assert.equal(w.excavate([0,5000]),true);
});
test('a colony with ample usable space does not dig endlessly',()=>{
  const c=new Colony(1);c.world.carve([0,15],25,12);c.world.construction=[];c.updateDemand();run(c,120);assert.equal(c.world.soilExcavated,0);assert.equal(c.world.construction.length,0);
});
test('128x uses the same fixed ticks, while a CPU budget bounds catch-up work',()=>{
  const c=new Colony(1),reference=new Colony(1);let pending=0;
  for(let i=0;i<20;i++){const step=advanceSimulation(c,pending,.05,128,()=>0);pending=step.pending;}
  for(let i=0;i<1280;i++)reference.step();assert.ok(Math.abs(c.time-128)<1e-6);assert.deepEqual(c.toJSON(),reference.toJSON());
  let clock=0;const bounded=advanceSimulation(new Colony(),100,.1,128,()=>clock++,6);assert.ok(bounded.ticks<10);assert.ok(bounded.pending<=64);assert.ok(bounded.ticks>0);
});

test('seeded terrain has connected slopes, natural depressions, and varied asymmetrical mounds',()=>{
  const signatures=[];
  for(const seed of [17,287,914,12345]){
    const w=new World(seed),heights=Array.from({length:241},(_,i)=>w.surface(i-120));assert.ok(new Set(heights).size>2);assert.ok(heights.slice(1).every((y,i)=>Math.abs(y-heights[i])<=1));
    for(const x of [-60,-20,20,60])assert.ok(w.path(w.entrance(),[x,w.surface(x)-1]),'Foragers must be able to traverse the slopes.');
    assert.ok(basins(w).length>0);for(let i=0;i<100;i++)assert.ok(w.deposit(w.depositSite(),'earth'));
    const thickness=Array.from({length:41},(_,i)=>w.baseSurface(i-20)-w.surface(i-20));assert.notDeepEqual(thickness,[...thickness].reverse());signatures.push(thickness.join(','));
    const restored=World.fromJSON(JSON.parse(JSON.stringify(w)));assert.deepEqual(Array.from({length:81},(_,i)=>restored.surface(i-40)),Array.from({length:81},(_,i)=>w.surface(i-40)));
  }assert.equal(new Set(signatures).size,4);
});
test('grain depletion withers grass, and its regrowth requires a delay and maturation',()=>{
  const w=new World(287),p=w.patches.find(p=>p.origin==='grass');harvest(w,p,p.amount,0);assert.equal(p.stage,'dead');assert.equal(p.amount,0);
  w.weather.nextRain=Infinity;tickHabitat(w,60);assert.equal(p.stage,'dead');
  let time=60;for(;time<DAY*6;time+=2)tickHabitat(w,time);assert.equal(p.stage,'seed');assert.ok(p.amount>0);
  harvest(w,p,p.amount,time);assert.equal(p.stage,'dead');
  w.deposit([p.cell[0],w.surface(p.cell[0])-1]);for(let i=0;i<2500;i++)tickHabitat(w,time+i*2+2);assert.equal(p.amount,0,'Grass buried by spoil must not grow on the mound.');
});
test('rain gathers in depressions, fills puddles, then stops and water evaporates',()=>{
  const w=new World(287);w.patches=w.patches.filter(p=>p.kind!=='water');w.weather.nextRain=0;
  for(let t=2;t<=20;t+=2)tickHabitat(w,t);assert.equal(w.weather.raining,true);const pools=w.patches.filter(p=>p.origin==='puddle');assert.ok(pools.length>0);
  for(const p of pools){assert.ok(p.amount>0);const y=w.surface(p.cell[0]);assert.ok(y>w.surface(p.left-1));assert.ok(y>w.surface(p.right+1));}
  const p=pools[0];w.weather.until=21;tickHabitat(w,22);assert.equal(w.weather.raining,false);const water=p.amount;tickHabitat(w,42);assert.ok(p.amount<water);
});
test('queen walks under shelter, lays beside her body, and workers carry single reserved eggs to nursery',()=>{
  const c=new Colony(287),queen=c.ants[0];clearBrood(c);c.food=80;c.water=60;c.protein=30;c.lastEgg=-1000;primeCrop(c,queen,1,.4,.5);c.updateDemand();
  c.updateQueen(queen);assert.equal(queen.task,'laying');const at=[...queen.cell];c.time=queen.layUntil;c.updateQueen(queen);assert.equal(c.brood.length,1);const b=c.brood[0];assert.notDeepEqual(b.cell,at);assert.ok(distance(b.cell,at)<=1.6);assert.equal(broodStage(b),'egg');assert.equal(b.needsTransport,true);
  const nurse=c.ants[1],other=c.ants[2];const contact=[...c.world.excavated].map(k=>k.split(',').map(Number)).find(p=>distance(p,b.cell)<=1.4&&canOccupy(c.world,nurse,p));assert.ok(contact);Object.assign(nurse,{cell:[...contact],pos:[...contact]});c.sense(nurse);assert.equal(c.assignBroodTransport(nurse),true);assert.equal(c.assignBroodTransport(other),false,'A second nurse must not reserve the same egg.');
  let carried=false;for(let i=0;i<2000&&c.broodMoved===0;i++){c.step();if(b.carriedBy!=null){carried=true;const carrier=c.ants.find(a=>a.id===b.carriedBy);assert.deepEqual(b.pos,carrier.pos);}}
  assert.equal(carried,true);assert.equal(c.broodMoved,1);assert.equal(b.carriedBy,null);assert.equal(b.needsTransport,false);assert.notDeepEqual(b.cell,at);
  c.ants=[queen];for(const p of openNestCells(c.world)){if(distance(p,queen.cell)>.6&&distance(p,queen.cell)<=1.6&&freeCell(c.world,p)){const baby={id:c.nextID++,cell:p,age:0,nutrition:1,vitality:1,lastCare:c.time,carriedBy:null};if(bedOccupy(c,baby,p))c.brood.push(baby);}}
  primeCrop(c,queen,1,.4,.5);queen.task='queenRest';queen.route=[];queen.queenCheckAt=0;beginTraffic(c);c.updateQueen(queen);assert.equal(queen.task,'queenMoving','A crowded laying area must prompt a local move.');const positions=new Set();for(let i=0;i<300;i++){c.step();positions.add(key(queen.cell));assert.equal(c.world.onSurface(queen.cell),false);}assert.ok(positions.size>1);
});
test('brood retains three distinct stages and a carrier death releases it without duplication',()=>{
  const c=new Colony(287),[egg,larva,pupa]=c.brood;assert.deepEqual(c.brood.map(broodStage),['egg','larva','pupa']);
  const nurse=c.ants[1];nurse.task='carryingBrood';nurse.carryingBrood=egg.id;nurse.broodID=egg.id;egg.carriedBy=nurse.id;egg.pos=[...nurse.pos];nurse.health=-1;
  c.step();assert.ok(!c.ants.includes(nurse));assert.equal(egg.carriedBy,null);assert.equal(egg.needsTransport,true);assert.equal(c.brood.filter(b=>b.id===egg.id).length,1);
});
test('blocked routes replan without discarding or reclassifying food, and resting is purposeful',()=>{
  const c=new Colony(287),a=c.ants[1];c.ants=[c.ants[0],a];a.cell=[...c.world.entrance()];a.pos=[...a.cell];Object.assign(a,{task:'returningWater',carried:2,cargoKind:'water',route:[],lastProgressAt:0,lastProgressPos:[...a.pos]});
  c.time=30;c.auditProgress(a);assert.equal(a.carried,2);assert.equal(a.task,'returningWater');assert.ok(a.route.length>0);assert.equal(c.world.runtime.recoveries,1);
  c.chooseJob(a);assert.equal(a.task,'returningWater');for(let i=0;i<1000&&c.waterDelivered===0;i++)c.step();assert.ok(c.waterDelivered>=2);assert.equal(c.world.soilDeposited,0);
  a.task='grooming';a.busyUntil=c.time+15;const recoveries=c.world.runtime.recoveries;c.auditProgress(a);assert.equal(c.world.runtime.recoveries,recoveries);
});
test('v0.3 progress migrates without reshaping existing ground or losing its state',()=>{
  const raw=readFileSync(new URL('./fixtures/v2-colony.json',import.meta.url),'utf8'),d=JSON.parse(raw).colony,c=decodeSave(raw);
  assert.equal(c.ants.length,d.ants.length);assert.equal(c.world.terrainVersion,0);assert.equal(c.world.soilExcavated,d.world.soilExcavated);assert.equal(c.world.deposits.size,d.world.deposits.length);assert.equal(c.time,d.time);
  run(c,180);assert.ok(c.alive);assert.equal(c.world.soilExcavated,c.world.soilDeposited+c.world.soilAbandoned+c.ants.filter(a=>a.cargoKind==='soil').reduce((sum,a)=>sum+a.carried,0));
});

test('attendants physically provision a queen beyond the central food-sharing area',()=>{
  const c=new Colony(287,{eggRate:0}),queen=c.ants[0],nurse=c.ants[1];c.ants=[queen,nurse];c.brood=[];
  for(let x=-12;x<=0;x++)c.world.excavated.add(key([x,11]));c.world.carve([-12,12],3,2);c.world.changed([-12,12]);
  Object.assign(queen,{cell:[-12,12],pos:[-12,12],energy:.5,hydration:.5,queenCheckAt:Infinity});
  Object.assign(nurse,{cell:[...c.world.nest],pos:[...c.world.nest],route:[],busyUntil:0});
  c.updateDemand();c.chooseJob(nurse);assert.equal(nurse.task,'toCache');assert.equal(queen.energy,.5,'A distant attendant cannot feed remotely.');
  for(let i=0;i<2000&&queen.energy<.7;i++)c.step();assert.ok(queen.energy>.7);assert.ok(queen.hydration>.7);assert.equal(nurse.carried,0);
});

test('rain, growth, and brood in flight continue exactly across a save',()=>{
  const raw=readFileSync(new URL('./fixtures/v3-living.json',import.meta.url),'utf8'),a=decodeSave(raw),b=Colony.fromJSON(JSON.parse(JSON.stringify(a)));
  assert.equal(a.world.weather.raining,true);assert.ok(a.ants.some(a=>a.carryingBrood));run(a,30);run(b,30);assert.deepEqual(a.toJSON(),b.toJSON());
});

test('finite resource squares disappear, cargo equals removed stock, and consumption transfers only that stock',()=>{
  const c=new Colony(287),a=c.ants[1];c.world.place('water',-20);const p=c.world.patches.at(-1);harvest(c.world,p,p.amount-6,0);
  initLedger(c.world);for(const patch of c.world.patches)c.world.resourceLedger[patch.kind].created+=patch.amount;
  const before=resourceTiles(c.world,p).length;assert.equal(before,3);
  const carried=harvest(c.world,p,2,0);assert.equal(carried,2);assert.equal(resourceTiles(c.world,p).length,2);
  Object.assign(a,{carried,cargoKind:'water',task:'returningWater',cell:[...c.world.nest],pos:[...c.world.nest],route:[],busyUntil:0});
  primeCrop(c,a,0,0,0);const water=c.water;c.updateAnt(a,.1);c.time=a.busyUntil;c.updateAnt(a,.1);assert.ok(c.water>=water+2-.001);
  harvest(c.world,p,100,c.time);assert.deepEqual(resourceTiles(c.world,p),[]);assert.equal(harvest(c.world,p,100,c.time),0);
  for(const kind of ['food','water'])assert.ok(Math.abs(resourceBalance(c.world,kind).error)<1e-8);
});
test('placed food is finite and never respawns as another dead insect or nectar drop',()=>{
  const w=new World(287);w.place('food',40);const patches=w.patches.slice(-2);assert.deepEqual(patches.map(p=>p.origin),['prey','nectar']);
  for(const p of patches){harvest(w,p,p.amount,0);assert.equal(resourceTiles(w,p).length,0);}
  for(let time=2;time<DAY*8;time+=2)tickHabitat(w,time);
  assert.ok(patches.every(p=>p.amount===0));assert.ok(Math.abs(resourceBalance(w,'food').error)<1e-7);
});
test('water and protein searches do not loop on plentiful carbohydrate food',()=>{
  const c=new Colony(287),a=c.ants[1];c.world.patches=[];c.world.place('food',20);const nectar=c.world.patches.find(p=>p.origin==='nectar');c.world.patches=[nectar];
  Object.assign(a,{cell:[...nectar.cell],pos:[...nectar.cell],foragingKind:'water',wantProtein:false,memories:[]});assert.equal(c.discover(a),false);
  a.foragingKind='food';a.wantProtein=true;assert.equal(c.discover(a),false);a.wantProtein=false;assert.equal(c.discover(a),true);
});
test('large fire-ant workers change tasks with stimuli instead of becoming permanent guards',()=>{
  const c=new Colony(287),a=c.ants[1];Object.assign(a,{caste:'major',bodySize:.95,cell:[...c.world.nest],pos:[...c.world.nest],initialAgeDays:15});
  c.food=0;c.protein=0;c.water=30;c.updateDemand();a.knownNeeds=null;c.chooseJob(a);assert.equal(a.lastJob,'forage');assert.notEqual(a.task,'patrolling');
  c.food=100;c.protein=100;primeCrop(c,c.ants[0],1,.4,.5);c.brood[0].nutrition=0;c.brood[0].age=DAY*10;a.initialAgeDays=1;a.traits.care=.45;c.brood.forEach(b=>b.lastCare=-100);c.world.construction=[];c.world.carve([0,15],12,7);c.updateDemand();a.knownNeeds=null;a.cell=[...c.brood[0].cell];a.pos=[...a.cell];a.senseAt=0;beginTraffic(c);const carePose=nearestStance(c.world,a,c.brood[0].cell);assert.ok(carePose);a.pos=carePose;a.cell=carePose.map(Math.round);beginTraffic(c);c.chooseJob(a);assert.ok(['nursing','toBrood','carryingBrood','toCache'].includes(a.task));
  const count=a.brain.taskHistory.length;for(let i=0;i<600;i++)c.step();assert.ok(a.brain.taskHistory.length>count);assert.equal(c.ants.some(a=>a.task==='patrolling'),false);
});
test('contact recognizes colony odor rather than an ID and unfamiliar cues release alarm',()=>{
  const c=new Colony(287),a=c.ants[1],b=c.ants[2];assert.equal(recognize(a,b),true);const originalID=b.id;b.id=8888;assert.equal(recognize(a,b),true);b.id=originalID;
  a.cell=[...c.world.nest];a.pos=[...a.cell];b.cell=[...a.cell];b.pos=[...a.cell];b.odor=[1.8,1.8,1.8];c.occupancy=new Map([[key(a.cell),[a,b]]]);a.encounterAt=0;c.encounter(a);
  assert.ok(c.alarmEvents>0);assert.ok(senseSignal(c.world,'alarm',a.cell)>.1);assert.equal(a.brain.lastContact,'Unfamiliar colony odor · alarm response');
});
test('chemical trails affect local route choice, evaporate, and alarm defense ends',()=>{
  const w=new World(287),c=new Colony(287),a=c.ants[1];const place=c.world.entrance();a.cell=[...place];a.pos=[...place];a.route=[];
  emit(c.world,'food',a.cell,2);const strength=senseSignal(c.world,'food',a.cell);decaySignals(c.world,180);assert.ok(senseSignal(c.world,'food',a.cell)<strength);
  c.world.patches=[];const choices=c.world.neighbors(a.cell).filter(p=>c.world.onSurface(p)),preferred=choices[0];emit(c.world,'food',preferred,4);let followed=0;
  for(let i=0;i<100;i++){a.recent=[];a.route=[];a.memories=[];a.foragingKind='food';c.explore(a);if(key(a.route[0])===key(preferred))followed++;}assert.ok(followed>65,'Local trail concentration must influence actual movement choices.');
  const responders=c.disturb(a.cell);assert.ok(responders>0);assert.ok(c.ants.some(a=>a.task==='investigating'));
  run(c,90);assert.equal(c.ants.some(a=>['patrolling','investigating'].includes(a.task)),false);
});
test('new nests have procedural narrow side mouths with connected subsurface routes',()=>{
  const signatures=new Set();for(const seed of [17,287,914,19000]){const w=new World(seed),e=w.entrances[0];assert.ok(Math.abs(e.mouth[0])>=8);assert.ok(w.path(w.nest,e.mouth));assert.ok(w.solid([0,w.baseSurface(0)]),'The mound center is not an open canyon.');signatures.add(key(e.mouth));
    assert.ok(planPeripheralExit(w,new Random(seed),600));const planned=w.entrances.at(-1);assert.ok(Math.abs(planned.mouth[0]-e.mouth[0])>=7);assert.ok(w.construction.length>0);
  }assert.ok(signatures.size>1);
});
test('workers can tunnel through mound deposits without creating or losing soil',()=>{
  const w=new World(287);for(let i=0;i<110;i++)w.deposit(w.depositSite(),'earth');assert.ok(planMoundPassage(w,new Random(5),1000));
  const depBefore=w.soilDeposited,candidate=[...w.deposits].map(s=>s.split(',').map(Number)).find(c=>w.solid([c[0],c[1]-1])&&w.solid([c[0],c[1]+1]));assert.ok(candidate);
  // Open a connected approach from the founder tunnel to the chosen mound cell.
  const below=[candidate[0],candidate[1]+1];if(w.deposits.has(key(below))){assert.ok(w.excavate(below)||!w.solid(below));}
  // A reachable frontier in the queued plan must ultimately include spoil.
  let rehandled=false,guard=0;while(w.construction.length&&guard++<300){const site=w.frontier()[0];if(!site)break;const spoil=w.deposits.has(key(site));if(w.excavate(site)&&spoil){rehandled=true;break;}}
  assert.equal(rehandled,true);assert.ok(w.moundTunnels.size>0);assert.ok(w.soilDeposited<depBefore);assert.ok(w.soilRehandled>0);
});
test('v0.4 colonies keep adults, ground, settings, and stage identity while old patrols are released',()=>{
  const raw=readFileSync(new URL('./fixtures/v4-colony.json',import.meta.url),'utf8'),d=JSON.parse(raw).colony;d.ants[1].caste='major';d.ants[1].task='patrolling';
  const c=Colony.fromJSON(d);assert.equal(c.ants.length,d.ants.length);assert.deepEqual(c.settings,{...d.settings,waterTableDepth:d.settings.waterTableDepth??56});assert.deepEqual([...c.world.excavated],d.world.excavated);assert.equal(c.world.deposits.size,d.world.deposits.length);assert.equal(c.ants[1].task,'reserve');
  assert.equal(c.species,'Solenopsis invicta');assert.deepEqual(c.brood.map(broodStage),d.brood.map(b=>b.age<8*DAY?'egg':b.age<27*DAY?'larva':'pupa'));
});
test('accelerated fire-ant generations grow past the small founder population and maintain a replacement brood pool',()=>{
  const c=new Colony(287,{broodRate:8,eggRate:4,populationCap:60});run(c,DAY*9);
  // Physical traffic can delay a brood cohort. Retain the population and birth requirements within a bounded extra generation window.
  for(let i=0;i<DAY*3/.1&&(c.ants.length<45||c.births<=32);i++)c.step();
  assert.ok(c.alive);assert.ok(c.ants.length>=45,JSON.stringify({days:c.time/DAY,adults:c.ants.length,births:c.births,brood:c.brood.length,stages:c.brood.reduce((n,b)=>(n[broodStage(b)]=(n[broodStage(b)]??0)+1,n),{}),food:c.food,water:c.water}));assert.ok(c.births>32);assert.ok(c.brood.length>0);assert.equal(c.ants.some(a=>a.task==='patrolling'),false);
  assert.ok(c.world.moundTunnels.size>0);assert.ok(c.ants.every(a=>c.world.walkable(a.cell)));
  const carried=c.ants.filter(a=>a.cargoKind==='soil').reduce((n,a)=>n+a.carried,0);assert.equal(c.world.soilExcavated,c.world.soilDeposited+c.world.soilAbandoned+carried);
  for(const kind of ['food','water'])assert.ok(Math.abs(resourceBalance(c.world,kind).error)<1e-5);
});

test('recognized nestmates share a bounded crop-derived meal through actual contact',()=>{
  const c=new Colony(287),a=c.ants[1],b=c.ants[2];Object.assign(a,{cell:[...c.world.nest],pos:[...c.world.nest],energy:.2,hydration:.2});Object.assign(b,{cell:[...a.cell],pos:[...a.cell],energy:.95,hydration:.95});
  primeCrop(c,a,0,0,0);primeCrop(c,b,1,.2,.8);c.occupancy=new Map([[key(a.cell),[a,b]]]);const food=foodFill(a)+foodFill(b),water=a.socialWater+b.socialWater;c.encounter(a);
  assert.ok(foodFill(a)>0);assert.ok(a.socialWater>0);assert.ok(Math.abs(foodFill(a)+foodFill(b)-food)<1e-10);assert.ok(Math.abs(a.socialWater+b.socialWater-water)<1e-10);consumeSelf(c,a,1);assert.ok(a.energy>.2);assert.ok(a.hydration>.2);assert.ok(c.socialTransfers>=1);
});
test('adequate stores damp recruitment so returning workers cannot sustain a food-collecting feedback loop',()=>{
  const c=new Colony(287),a=c.ants[1];c.food=1000;c.protein=1000;c.water=1000;c.brood=[];c.world.carve([0,14],25,12);c.world.construction=[];primeCrop(c,c.ants[0],1,.4,.5);c.updateDemand();a.cell=[...c.world.nest];a.pos=[...a.cell];
  a.brain.recruitedKind='food';a.brain.recruitUntil=1000;let reserves=0;
  for(let i=0;i<50;i++){a.knownNeeds=null;a.route=[];c.chooseJob(a);if(['reserve','resting','grooming'].includes(a.task))reserves++;}
  assert.ok(reserves>30);assert.equal(a.brain.taskHistory.some(h=>h.job==='defend'),false);
});

test('a harvested insect is never refilled; later wildlife creates a distinct finite source',()=>{
  const w=new World(287),old=w.patches.find(p=>p.origin==='prey'),oldID=old.id,region=Math.floor(old.cell[0]/32);harvest(w,old,old.amount,0);w.nextPrey.set(region,0);const before=w.nextPatchID;tickHabitat(w,2);
  assert.equal(old.amount,0);assert.ok(w.patches.some(p=>p.origin==='prey'&&p.id>=before&&p.id!==oldID&&p.amount>0));assert.ok(Math.abs(resourceBalance(w,'food').error)<1e-8);
});

test('migration preserves the previous queen lifespan multiplier rather than aging her into premature death',()=>{
  const d=JSON.parse(readFileSync(new URL('./fixtures/v4-colony.json',import.meta.url),'utf8')).colony,queen=d.ants.find(a=>a.caste==='queen');queen.traits.lifeDays=100;queen.age=200*DAY;
  const c=Colony.fromJSON(d),converted=c.ants.find(a=>a.caste==='queen');assert.equal(converted.traits.lifeDays,3500);assert.ok(converted.traits.lifeDays>converted.initialAgeDays+converted.age/DAY);
});

test('haulers can cross mound roofs above the old routing ceiling and never deposit into galleries',()=>{
  const w=new World(287);w.terrainVersion=0;w.terrainCache.clear();
  for(let y=0;y>=-24;y--)w.deposits.add(key([3,y]));w.heights.set(3,-24);w.changed([3,-24]);
  const route=w.path([2,0],[4,0]);assert.ok(route);assert.ok(route.some(c=>c[1]<-24));
  const natural=new World(287),site=natural.depositSite();assert.ok(site);natural.moundTunnels.add(key(site));natural.changed(site);
  const next=natural.depositSite();assert.ok(next);assert.notEqual(key(next),key(site));assert.ok(natural.path(natural.entrance(),next));assert.equal(natural.deposit(site),false);
});

test('loaded workers interrupt work to refuel and resume delivery without losing earth',()=>{
  const c=new Colony(287,{eggRate:0}),a=c.ants[1];c.ants=[c.ants[0],a];c.brood=[];c.world.construction=[];
  a.cell=[...c.world.entrance()];a.pos=[...a.cell];Object.assign(a,{energy:.12,hydration:.12,carried:1,cargoKind:'soil',cargoMaterial:'earth',task:'haulingSoil',selfCheckAt:0,route:[]});c.world.soilExcavated++;
  c.step();assert.equal(a.task,'refueling');assert.equal(a.carried,1);assert.equal(a.cargoKind,'soil');
  run(c,180);assert.ok(a.energy>.5);assert.ok(a.hydration>.5);assert.ok(c.world.soilDeposited>=1);assert.equal(c.ants.length,2);
  assert.equal(c.world.soilExcavated,c.world.soilDeposited+c.world.soilAbandoned+c.ants.filter(a=>a.cargoKind==='soil').reduce((n,a)=>n+a.carried,0));
});

test('refueling brood carriers retain and physically transport their brood item',()=>{
  const c=new Colony(287),a=c.ants[1],b=c.brood[0];const approach=c.world.neighbors(c.world.entrance()).find(p=>c.world.onSurface(p)&&canOccupy(c.world,a,p));assert.ok(approach);a.cell=[...approach];a.pos=[...a.cell];Object.assign(a,{energy:.12,hydration:.12,task:'carryingBrood',carryingBrood:b.id,broodID:b.id,broodDestination:[...c.nursery],selfCheckAt:0,route:[]});b.carriedBy=a.id;b.cell=[...a.cell];b.pos=[...a.pos];
  c.step();assert.equal(a.task,'refueling');assert.equal(a.carryingBrood,b.id);assert.equal(b.carriedBy,a.id);
  for(let i=0;i<2000&&(a.energy<=.2||a.hydration<=.2);i++){c.step();if(b.carriedBy===a.id)assert.deepEqual(b.pos,a.pos);}
  assert.ok(a.energy>.12);assert.ok(a.hydration>.12);assert.ok(c.brood.some(item=>item.id===b.id));
});

test('exposed old gallery cells are outdoor air rather than a permanent dark chamber',()=>{
  const w=new World(287),c=[35,-8];w.moundTunnels.add(key(c));assert.equal(w.coveredMound(c),false);assert.equal(w.onSurface(c),true);assert.equal(w.walkable(c),false);
  w.deposits.add(key([35,-9]));w.heights.set(35,-9);w.changed(c);assert.equal(w.coveredMound(c),true);assert.equal(w.walkable(c),true);assert.equal(w.inForagingZone(c),true);
});

test('queen attendants do not drain food stores when only unavailable water is needed',()=>{
  const c=new Colony(287),q=c.ants[0],a=c.ants[1];c.water=0;c.food=100;primeCrop(c,q,1,.4,0);q.energy=.9;q.hydration=.1;const foodBefore=c.food;assert.equal(c.assignQueenCare(a),false);assert.equal(c.food,foodBefore);
  c.water=10;primeCrop(c,q,1,.4,0);primeCrop(c,a,0,0,1);q.cell=[4,10];q.pos=[4,10];a.cell=[...c.world.nest];a.pos=[...a.cell];assert.equal(c.assignQueenCare(a),true);a.route=[];a.busyUntil=0;c.updateAnt(a,.1);assert.equal(a.socialFood,0);assert.equal(q.socialWater,0,'Crop contents cannot reach a distant queen remotely.');const stored=c.foodItems.reduce((n,p)=>n+p.energy,0);for(let i=0;i<300&&q.socialWater<=0;i++)c.step();assert.ok(q.socialWater>0);assert.equal(c.foodItems.reduce((n,p)=>n+p.energy,0),stored);
});

test('protein collectors take insect pieces rather than seeds sharing the same location',()=>{
  const c=new Colony(287),a=c.ants[1];c.world.patches=[];initItemSpace(c.world);c.world.place('food',20);const prey=c.world.patches.find(p=>p.origin==='prey'&&p.renewable===false),grain={...prey,id:c.world.nextPatchID++,origin:'grass',amount:0,capacity:5,pieces:[],nutrition:{energy:.85,protein:.15}};c.world.patches.unshift(grain);addStock(c.world,grain,5);initLedger(c.world);beginTraffic(c);
  const pose=nearestStance(c.world,a,prey.cell);assert.ok(pose);a.pos=pose;a.cell=pose.map(Math.round);beginTraffic(c);a.foragingKind='food';a.wantProtein=true;a.memories=[];const grainBefore=grain.amount,preyBefore=prey.amount;assert.ok(grainBefore>0);assert.ok(c.discover(a));assert.equal(a.sourceID,prey.id);a.route=[];a.collectKind='food';c.finishHarvest(a);assert.ok(a.cargoNutrition.protein>.4);assert.equal(grain.amount,grainBefore);assert.ok(prey.amount<preyBefore);
});

test('thousands of haul-and-gallery cycles retain bounded, supported mound slopes',()=>{
  for(const seed of [17,287,914]){
    const w=new World(seed);for(let i=0;i<500;i++){const site=w.depositSite();assert.ok(site);assert.ok(w.deposit(site));w.soilExcavated++;if(i%60===0&&planMoundPassage(w,new Random(seed+i),i)){for(let n=0;n<100&&w.construction.length;n++){const target=w.frontier()[0];if(!target)break;if(w.excavate(target)){const next=w.depositSite();assert.ok(next);assert.ok(w.deposit(next));}}}}
    const peak=Math.max(...[...w.heights].map(([x,y])=>w.baseSurface(x)-y));assert.ok(peak<16,`Seed ${seed} produced a ${peak}-cell tower.`);
    for(const [x,y] of w.heights)assert.ok(Math.abs(y-w.surface(x-1))<=1&&Math.abs(y-w.surface(x+1))<=1,'Every mound edge must retain a supported slope.');
    assert.ok(w.moundTunnels.size<w.deposits.size*.25);assert.ok(w.path(w.nest,w.foragingExit()));
    for(const e of w.entrances){assert.ok(w.walkable(e.mouth));assert.ok(w.baseSurface(e.mouth[0])-w.surface(e.mouth[0]-1)<=3);}
  }
});

test('unstable legacy mounds settle once with all soil, ants, brood and stores retained',()=>{
  const original=new Colony(287),d=JSON.parse(JSON.stringify(original));delete d.world.geometryVersion;d.world.deposits=[];d.world.spoilOrigins=[];
  for(let x=-4;x<=4;x++)for(let y=-22;y<0;y++){d.world.deposits.push(key([x,y]));d.world.spoilOrigins.push([key([x,y]),'earth']);}
  d.world.soilDeposited=d.world.deposits.length;d.world.soilExcavated=d.world.soilDeposited;d.ants[1].cell=[2,-23];d.ants[1].pos=[2,-23];
  const c=Colony.fromJSON(d);assert.equal(c.world.soilDeposited,d.world.soilDeposited);assert.equal(c.ants.length,d.ants.length);assert.equal(c.brood.length,d.brood.length);assert.equal(c.food,d.food);assert.equal(c.water,d.water);assert.deepEqual([...c.world.excavated],d.world.excavated);
  assert.ok(c.ants.every(a=>c.world.walkable(a.cell)));assert.ok(Math.min(...c.world.heights.values())>-10);const next=Colony.fromJSON(JSON.parse(JSON.stringify(c)));assert.deepEqual(c.toJSON(),next.toJSON());
});

test('curved routes and rotated organic chambers are connected and varied',()=>{
  const shapes=new Set();for(const seed of [1,19,287,912]){const route=curvedPassage([0,0],[14,16],new Random(seed));let last=[0,0];for(const c of route){assert.equal(Math.abs(c[0]-last[0])+Math.abs(c[1]-last[1]),1);last=c;}assert.deepEqual(last,[14,16]);shapes.add(JSON.stringify(route));const chamber=chamberCells([0,0],5,2,seed);assert.ok(chamber.length>15);assert.ok(chamber.some(c=>c[0]&&c[1]));}assert.ok(shapes.size>2);
});

test('subcell contours preserve corridor centers and agree across chunk boundaries',()=>{
  const w=new World(287),mask=terrainMask(w,0,0),n=16*CONTOUR_SAMPLES;assert.equal(mask.length,n*n);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)assert.equal(mask[(y*8+4)*n+x*8+4],Number(w.solid([x,y])));
  const a=terrainMask(w,-1,0),b=terrainMask(w,0,0);for(let y=0;y<n;y++){const wy=-.5+(y+.5)/8;assert.equal(a[y*n+n-1],Number(densityAt(-.5-.5/8,wy,(x,y)=>w.solid([x,y]))>=.5));assert.equal(b[y*n],Number(densityAt(-.5+.5/8,wy,(x,y)=>w.solid([x,y]))>=.5));}
  assert.ok(mask.some((v,i)=>i%n&&v!==mask[i-1]));
});

test('legacy wide surface breaches are narrowed with existing soil while preserving an entrance route',()=>{
  const d=JSON.parse(readFileSync(new URL('./fixtures/v1-colony.json',import.meta.url),'utf8')).colony,c=Colony.fromJSON(d),w=c.world;
  for(const e of w.entrances){assert.ok(w.walkable(e.mouth));assert.ok(w.path(w.nest,e.mouth));const open=Array.from({length:9},(_,i)=>e.mouth[0]+i-4).filter(x=>!w.solid([x,w.baseSurface(x)]));assert.ok(open.length<=1);}
  assert.equal(w.soilDeposited,d.world.soilDeposited);assert.ok(c.ants.every(a=>w.walkable(a.cell)));
});

test('diagonal contour capsules smooth valid turns while retaining solid cell centers',()=>{
  const solid=(x,y)=>!(x===y&&x>=0&&x<=1)&&!(x===0&&y===1);assert.equal(densityAt(.8,.2,solid),0);assert.equal(densityAt(1,0,solid),1);assert.equal(densityAt(0,0,solid),0);
  const blocked=(x,y)=>!(x===y&&x>=0&&x<=1);assert.ok(densityAt(.8,.2,blocked)>=.5,'Two solid corner flanks must not become a visual shortcut.');
});

test('mound branches reuse nearby passages instead of repeatedly opening the queen-to-surface fan',()=>{
  const w=new World(287);for(let i=0;i<250;i++)w.deposit(w.depositSite());
  for(let x=-35;x<=35;x++)w.excavated.add(key([x,5]));w.rebuildNavigation();w.changed([0,5]);
  let planned=false;for(let i=0;i<10&&!planned;i++)planned=planMoundPassage(w,new Random(i+1600),1000);assert.ok(planned);
  const original=w.construction.filter(c=>c[1]>=w.baseSurface(c[0]));assert.ok(original.length<18);assert.ok(original.every(c=>Math.hypot(c[0]-w.nest[0],c[1]-w.nest[1])>1));
});

test('cooperative ticks yield and finish with the same colony and RNG state as synchronous ticks',async()=>{
  const {SimulationRunner}=await import('../web/clock.mjs'),a=new Colony(287,{startingWorkers:40}),b=Colony.fromJSON(JSON.parse(JSON.stringify(a))),runner=new SimulationRunner();let clock=0,yielded=false;
  for(let i=0;i<30;i++){runner.advance(a,.1,1,false,()=>clock++,1);yielded||=runner.busy;}
  await runner.finish(a);const ticks=Math.round(a.time/.1);for(let i=0;i<ticks;i++)b.step();assert.ok(yielded);assert.ok(ticks>0);assert.deepEqual(a.toJSON(),b.toJSON());
});
test('population ceilings support 10000 while retaining small defaults and valid saved adults',()=>{
  const c=new Colony(287,{populationCap:10000});assert.equal(LIMIT,10000);assert.equal(c.settings.populationCap,10000);assert.equal(c.ants.length,13);assert.equal(new Colony().settings.populationCap,120);c.setSettings({populationCap:12000});assert.equal(c.settings.populationCap,10000);
  const d=JSON.parse(JSON.stringify(c));d.ants=Array.from({length:10000},(_,id)=>({id,caste:id?'worker':'queen',cell:[0,11],pos:[0,11]}));d.water=0;d.nutrition.water=0;d.supplyLedger.water={introduced:0,consumed:0,lost:0};const restored=Colony.fromJSON(d);assert.equal(restored.ants.length,10000);assert.equal(restored.settings.populationCap,10000);assert.equal(restored.ants.at(-1).id,9999);
});
test('terrain cache keeps revisited chunks and evicts by bytes in least-recent order',async()=>{
  const {TerrainCache}=await import('../web/render-cache.mjs'),cache=new TerrainCache(12);cache.put('a',{bytes:4});cache.put('b',{bytes:4});cache.put('c',{bytes:4});assert.ok(cache.get('a'));cache.put('d',{bytes:4});assert.equal(cache.get('b'),undefined);assert.equal(cache.bytes,12);assert.equal(cache.size,3);cache.put('a',{bytes:8});assert.ok(cache.bytes<=12);cache.clear();assert.equal(cache.bytes,0);
});
test('terrain snapshots are isolated, preserve full-detail pixels, and support lower zoom detail',async()=>{
  const {snapshotTerrain,rasterTerrain,rasterRows}=await import('../web/terrain-raster.mjs'),{createHash}=await import('node:crypto'),c=Colony.fromJSON(JSON.parse(readFileSync(new URL('./fixtures/v6-mature.json',import.meta.url),'utf8')).colony),s=snapshotTerrain(c.world,0,1),full=rasterTerrain(s);
  assert.equal(createHash('sha256').update(full.data).digest('hex'),'54830c2ac29cd093852ef5af29b6e8a9125a1e4e8e31c5cd8afc0cb045dabdae');const rows=rasterRows(s);let r,yields=0;do{r=rows.next();yields++;}while(!r.done);assert.ok(yields>30);assert.deepEqual(r.value.data,full.data);
  c.world.deposits.clear();assert.deepEqual(rasterTerrain(s).data,full.data);const low=rasterTerrain({...s,lod:8});assert.equal(low.size,128);assert.equal(low.data.length,full.data.length/4);
});

test('sub-threshold grain and insect residues are accounted for before their source disappears',()=>{
  const w=new World(287),grass=w.patches.find(p=>p.origin==='grass');harvest(w,grass,grass.amount-.0004,0);assert.equal(grass.amount,0);assert.ok(Math.abs(resourceBalance(w,'food').error)<1e-7);
  const prey=w.patches.find(p=>p.origin==='prey');harvest(w,prey,prey.amount-.0003,0);prey.decayAt=1e10;w.weather.nextRain=1e10;tickHabitat(w,DAY+2);assert.equal(w.patches.includes(prey),false);assert.ok(Math.abs(resourceBalance(w,'food').error)<1e-7);
});

test('database read failures protect the large-colony marker from automatic replacement',async()=>{
  const {ColonyStore}=await import('../web/large-saves.mjs'),data=new Map([['little-colony.web.v1.database','1']]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},database={open(){throw Error('Database unavailable');}},store=new ColonyStore(storage,database);
  await assert.rejects(()=>store.load(),/Database unavailable/);assert.equal(store.blocked,true);assert.equal(await store.save(new Colony()),false);assert.equal(storage.getItem('little-colony.web.v1.database'),'1');assert.equal(storage.getItem('little-colony.web.v1'),null);
});

const motionWorld=()=>({seed:287,revision:0,patches:[],signals:Object.fromEntries(['food','water','alarm','brood','queen','home'].map(k=>[k,new Map()])),solid:([x,y])=>Math.abs(x)>12||Math.abs(y)>12,walkable(c){return !this.solid(c);}});
test('continuous locomotion accelerates and rounds turns without snapping or crossing soil',async()=>{
  const {updateMotion,moveAnt,wrapAngle,clearSegment}=await import('../web/locomotion.mjs'),w=motionWorld(),a=initializeBrain(createAnt(4,'worker',[0,0],287),287);a.task='toDig';a.route=[[1,0],[2,0],[3,1],[3,2],[4,2]];
  const headings=new Set();let subcellArrivals=0,maxStep=0,firstSpeed=0;
  for(let i=0;i<180&&a.route.length;i++){const previous=[...a.pos],angle=a.motion.angle;updateMotion(a,w,i*.1,.1);const arrived=moveAnt(a,w,i*.1,.1);if(i===0)firstSpeed=a.motion.speed;maxStep=Math.max(maxStep,distanceForTest(previous,a.pos));assert.ok(Math.abs(wrapAngle(a.motion.angle-angle))<=.751);assert.ok(clearSegment(w,previous,a.pos));if(arrived&&a.route.length&&distanceForTest(a.pos,a.cell)>.005)subcellArrivals++;headings.add(a.motion.angle.toFixed(2));}
  assert.equal(a.route.length,0);assert.ok(firstSpeed<2);assert.ok(maxStep<.38);assert.ok(headings.size>8);assert.ok(subcellArrivals>0);assert.ok(distanceForTest(a.pos,[4,2])<.08);
});
const distanceForTest=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('separate antenna samples causally steer toward a local trail rather than cosmetic wobble',async()=>{
  const {updateMotion,moveAnt}=await import('../web/locomotion.mjs');const trajectories=[];
  for(const side of [-1,1]){const w=motionWorld(),a=initializeBrain(createAnt(7,'worker',[0,0],287),287);a.task='exploring';a.foragingKind='food';a.route=[[8,0]];a.motion.angle=0;a.motion.phase=0;a.motion.nextPause=100;
    for(let x=0;x<=8;x++)w.signals.food.set(key([x,side]),2);
    updateMotion(a,w,0,.1);assert.ok(side*(a.brain.antennae.right.food-a.brain.antennae.left.food)>0);assert.ok(side*a.motion.turn>0);assert.notDeepEqual(a.brain.antennae.tips.left,a.brain.antennae.tips.right);
    for(let i=0;i<12;i++){updateMotion(a,w,i*.1,.1);moveAnt(a,w,i*.1,.1);}trajectories.push(a.pos[1]);
  }assert.ok(trajectories[0]<-.05);assert.ok(trajectories[1]>.05);
});
test('exploratory sampling pauses are bounded and a loaded ant keeps delivering',async()=>{
  const {updateMotion,moveAnt}=await import('../web/locomotion.mjs');
  for(const loaded of [false,true]){const w=motionWorld(),a=initializeBrain(createAnt(5,'worker',[0,0],287),287);a.task=loaded?'returningFood':'exploring';a.route=[[1,0],[2,0]];a.motion.angle=0;a.motion.nextPause=0;a.carried=loaded?1:0;
    updateMotion(a,w,1,.1);if(!loaded){assert.ok(a.motion.pauseUntil>1&&a.motion.pauseUntil<1.43);assert.ok(a.motion.nextPause>=7);}else assert.equal(a.motion.pauseUntil,0);
    for(let i=0;i<50&&a.route.length;i++){updateMotion(a,w,1+i*.1,.1);moveAnt(a,w,1+i*.1,.1);}assert.equal(a.route.length,0);
  }
});
test('nearby source odors deplete immediately and remain separate from deposited pheromones',async()=>{
  const {resourceOdor}=await import('../web/signals.mjs'),w=motionWorld(),p={kind:'food',origin:'prey',amount:12,cell:[1,0]};w.patches=[p];
  const before=resourceOdor(w,[0,0]).food;assert.ok(before>0);p.amount=1;assert.ok(resourceOdor(w,[0,0]).food<before);p.amount=0;assert.equal(resourceOdor(w,[0,0]).food,0);assert.equal(w.signals.food.size,0);
  assert.equal(resourceOdor(w,[-8,0]).food,0);
});
test('steered carriers traverse rounded diagonal exits and retain their loads',async()=>{
  const {updateMotion,moveAnt}=await import('../web/locomotion.mjs');
  for(const seed of [17,287,914]){const c=new Colony(seed),a=c.ants[1],start=c.world.nest,goal=c.world.foragingExit(start);a.cell=[...start];a.pos=[...start];a.task='haulingSoil';a.carried=1;a.cargoKind='soil';a.route=c.world.path(start,goal);c.ants=[a];c.brood=[];c.foodItems=[];c.world.patches=[];beginTraffic(c);
    for(let i=0;i<500&&a.route.length;i++){updateMotion(a,c.world,i*.1,.1);moveAnt(a,c.world,i*.1,.1);}assert.equal(a.route.length,0,`seed ${seed} must pass the narrow mouth`);assert.equal(a.carried,1);assert.ok(distanceForTest(a.pos,goal)<.08);
  }
});
test('nearby bodies cause bounded passing and slowing rather than synchronized overlap',async()=>{
  const {updateMotion}=await import('../web/locomotion.mjs'),w=motionWorld(),a=initializeBrain(createAnt(4,'worker',[0,0],287),287),b=initializeBrain(createAnt(5,'worker',[0,0],287),287);a.task='toFood';a.route=[[1,0]];a.motion.angle=0;b.pos=[.6,0];
  updateMotion(a,w,1,.1,new Map([['0,0',[a,b]]]));assert.ok(a.motion.separation>0&&a.motion.separation<=.32);assert.ok(a.motion.yielding>=.7&&a.motion.yielding<1);
});
test('new soil overlap triggers continuous escape without losing an existing task or load',async()=>{
  const {updateMotion,recoverBody}=await import('../web/locomotion.mjs'),w=motionWorld(),a=initializeBrain(createAnt(8,'worker',[0,0],17),17);a.pos=[.65,.1];a.task='returningWater';a.carried=2;a.route=[[0,1],[0,2]];const route=structuredClone(a.route);
  w.solid=([x,y])=>x===1&&(y===0||y===1);w.revision++;
  for(let i=0;i<12;i++){const before=[...a.pos];updateMotion(a,w,i*.1,.1);if(a.motion.recovering)recoverBody(a,w,.1);assert.ok(distanceForTest(before,a.pos)<=.161);}
  assert.ok(densityAt(...a.pos,(x,y)=>w.solid([x,y]))<.49);assert.equal(a.motion.recovering,false);assert.deepEqual(a.route,route);assert.equal(a.carried,2);assert.equal(a.task,'returningWater');
});
test('active construction does not strand a body inside freshly deposited soil contours',()=>{
  for(const seed of [17,702]){const c=new Colony(seed),overlapTicks=new Map();let longest=0;
  for(let i=0;i<3000;i++){c.step();for(const a of c.ants){const count=densityAt(...a.pos,(x,y)=>c.world.solid([x,y]))>=.5?(overlapTicks.get(a.id)??0)+1:0;overlapTicks.set(a.id,count);longest=Math.max(longest,count);}}
  assert.ok(c.world.soilDeposited>0);assert.ok(longest<=8,`A body stayed inside solid soil for ${longest} ticks`); /* Collision-driven queue replans are legitimate; the direct solid-overlap bound above remains strict. */}
});

test('individual food and water crops scale with body size and self-feeding conserves nutrient mass',()=>{
  const c=new Colony(),small=c.ants[1],large=c.ants[2];small.bodySize=.2;large.bodySize=.9;assert.ok(socialCapacity(large)>socialCapacity(small));assert.ok(waterCapacity(large)>waterCapacity(small));
  primeCrop(c,small,.6,.2,.5);small.energy=.4;small.hydration=.3;const before={energy:small.socialFood,water:small.socialWater};consumeSelf(c,small,1);assert.ok(small.energy>.4);assert.ok(small.hydration>.3);assert.ok(small.socialFood<before.energy);assert.ok(small.socialWater<before.water);
  for(const kind of ['energy','protein','water'])assert.ok(Math.abs(supplyBalance(c,kind).error)<1e-8);
});
test('full ants physically place excess food into separate cache slots after personal needs are met',()=>{
  const c=new Colony(287,{eggRate:0}),a=c.ants[1];for(const ant of c.ants){primeCrop(c,ant,socialCapacity(ant)*.8,socialCapacity(ant)*.2,waterCapacity(ant));ant.energy=1;ant.hydration=1;}const free=[...c.world.excavated].map(k=>k.split(',').map(Number)).find(p=>canOccupy(c.world,a,p));assert.ok(free);a.cell=[...free];a.pos=[...a.cell];a.carried=2;a.cargoKind='food';a.cargoNutrition={energy:.8,protein:.2};accountIntake(c,'food',2,a.cargoNutrition);updateSupplyTotals(c);const before=c.foodItems.length;
  c.assignFoodStorage(a);for(let i=0;i<500&&c.foodItems.length===before;i++)c.step();assert.ok(c.foodItems.length>before);assert.ok(c.foodItems.at(-1).energy>0);assert.ok(new Set(c.foodItems.map(p=>slotKey(p.pos))).size===c.foodItems.length);for(const kind of ['energy','protein','water'])assert.ok(Math.abs(supplyBalance(c,kind).error)<1e-7);
});
test('water pickup fills only the personal crop and never creates an indoor water cache',()=>{
  const c=new Colony(),a=c.ants[1];c.world.place('water',-20);const p=c.world.patches.at(-1);primeCrop(c,a,0,0,0);a.cell=[...p.cell];a.pos=[...p.cell];a.task='toWater';a.collectKind='water';a.hydration=1;const before=p.amount,caches=c.foodItems.length;c.finishHarvest(a);
  assert.ok(a.socialWater>0&&a.socialWater<=waterCapacity(a));assert.equal(a.carried,0);assert.ok(Math.abs(before-p.amount-a.socialWater)<1e-8);assert.equal(c.foodItems.length,caches);assert.ok(c.foodItems.every(p=>p.energy+p.protein>0));
  primeCrop(c,a,0,0,waterCapacity(a));a.cell=[...p.cell];a.pos=[...p.cell];a.task='toWater';const stock=p.amount;c.finishHarvest(a);assert.equal(p.amount,stock,'A full crop cannot remove another water portion.');
});
test('all grounded resource portions, food parcels and brood beds have distinct space',()=>{
  const c=new Colony(),used=new Set(),mark=p=>{const k=slotKey(p);assert.equal(used.has(k),false,'Two ground items share '+k);used.add(k);};
  for(const p of c.world.patches)for(const i of p.pieces)mark(i.pos);for(const p of c.foodItems)mark(p.pos);for(const b of c.brood)if(b.carriedBy==null)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)mark([b.cell[0]+x/3,b.cell[1]+y/3]);
  const round=Colony.fromJSON(JSON.parse(JSON.stringify(c)));assert.equal(round.foodItems.length,c.foodItems.length);assert.deepEqual(round.brood.map(b=>b.cell),c.brood.map(b=>b.cell));
});
test('legacy stacked brood is separated without deleting identities or stages',()=>{
  const d=JSON.parse(readFileSync(new URL('./fixtures/v6-mature.json',import.meta.url),'utf8')).colony;for(const b of d.brood)b.cell=[...d.world.nest??[0,11]];const before=d.brood.map(b=>[b.id,b.age]);const c=Colony.fromJSON(d);assert.deepEqual(c.brood.map(b=>[b.id,b.age]),before);assert.equal(new Set(c.brood.filter(b=>b.carriedBy==null).map(b=>key(b.cell))).size,c.brood.filter(b=>b.carriedBy==null).length);
});
test('brood space pressure queues real excavation instead of stacking new beds',()=>{
  const c=new Colony(287),w=c.world;for(const id of [...w.excavated]){const p=id.split(',').map(Number);if(w.walkable(p)&&!w.onSurface(p)&&freeCell(w,p)){const b={id:c.nextID++,age:0,cell:p,nutrition:1,vitality:1,lastCare:0,carriedBy:null};c.brood.push(b);const token='b:'+b.id;for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)w.itemSlots.set((p[0]*3+x)+','+(p[1]*3+y),token);}}
  c.updateDemand();const before=w.excavated.size;assert.equal(c.freeBeds,0);assert.ok(c.demand.dig>0);c.proposeConstruction(c.ants[1],c.demand);assert.ok(w.construction.length>0);assert.equal(w.excavated.size,before,'A proposal must be physically excavated by workers.');
});
test('the deep water table has seeded contours, exposed finite seeps, and rain recharge',()=>{
  const w=new World(287);assert.ok(tableLevel(w,0)>w.nest[1]+30);assert.ok(Math.abs(tableLevel(w,10)-tableLevel(w,70))>1);const y=Math.ceil(tableLevel(w,0)-1.2);w.carve([0,y],1,1);tickGroundwater(w,2);let seep=w.patches.find(p=>p.origin==='seep'&&p.cell[0]===0);assert.ok(seep&&seep.amount>0);let taken=harvest(w,seep,100,2);
  for(let i=2;i<=2000;i++){tickGroundwater(w,i*2);taken+=harvest(w,seep,100,i*2);}assert.ok(taken<=48+1e-7);assert.ok(taken>40);assert.ok(w.groundwater.columns.get(0).water<1e-6);w.weather.raining=true;tickGroundwater(w,4010);assert.ok(seep.amount>0);assert.ok(Math.abs(resourceBalance(w,'water').error)<1e-7);
});
test('groundwater depth is adjustable and moves gradually while surviving a save',()=>{
  const c=new Colony();const before=c.world.waterTable(0);c.setSettings({waterTableDepth:120});tickGroundwater(c.world,10);assert.ok(c.world.waterTable(0)>before);assert.ok(c.world.waterTable(0)<120);const d=Colony.fromJSON(JSON.parse(JSON.stringify(c)));assert.equal(d.settings.waterTableDepth,120);assert.equal(d.world.waterTable(30),c.world.waterTable(30));assert.equal(d.ants.length,c.ants.length);
});
test('dry surface pools disappear and rain adds actual new finite portions',()=>{
  const w=new World(287),p=w.patches.find(p=>p.origin==='puddle'&&p.amount>0);assert.ok(p);if(p.amount>4)harvest(w,p,p.amount-4,0);w.weather.raining=false;w.weather.nextRain=1e12;tickHabitat(w,600);assert.equal(p.amount,0);assert.equal(resourceTiles(w,p).length,0);w.weather.raining=true;w.weather.intensity=1;w.weather.until=1000;tickHabitat(w,602);assert.ok(p.amount>0);assert.ok(resourceTiles(w,p).length>0);
});
test('drought prompts local downward moisture probes without instant tunnels or source coordinates',()=>{
  const c=new Colony(287);for(const p of c.world.patches)if(p.kind==='water')harvest(c.world,p,p.amount,0);c.time=DAY*3;c.world.weather.raining=false;c.world.weather.lastRainAt=0;c.water=0;c.world.construction=[];c.updateDemand();const before=c.world.excavated.size;c.proposeConstruction(c.ants[1],c.demand);assert.ok(c.world.waterDig);assert.ok(c.world.construction.length>0&&c.world.construction.length<=8);assert.equal(c.world.excavated.size,before);assert.ok(c.world.waterDig.tip[1]>c.world.nest[1]);
});
test('food, water and protein remain conserved across harvesting, sharing, storage, feeding and reproduction',()=>{
  const c=new Colony(287);c.food=1;run(c,600);assert.ok(c.foodDelivered>0);assert.ok(c.eggsLaid>0);assert.ok(c.foodItems.length>0);for(const k of ['energy','protein','water'])assert.ok(Math.abs(supplyBalance(c,k).error)<1e-6,k+' duplicated or vanished');for(const k of ['food','water'])assert.ok(Math.abs(resourceBalance(c.world,k).error)<1e-6);
});
test('far zoom terrain sampling remains bounded while preserving the full-detail raster contract',async()=>{
  const {snapshotTerrain,rasterTerrain}=await import('../web/terrain-raster.mjs'),w=new World();for(const lod of [2,4]){const result=rasterTerrain(snapshotTerrain(w,0,1,lod));assert.equal(result.size,16*lod);assert.equal(result.data.length,(16*lod)**2*4);}
});
test('abandoned transport and storage claims cannot permanently block unused nest space',()=>{
  const c=new Colony(),a=c.ants[1],b=c.brood[0],free=[...c.world.excavated].map(k=>k.split(',').map(Number)).find(p=>freeCell(c.world,p));assert.ok(free);a.broodID=b.id;a.broodDestination=[...free];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)c.world.itemSlots.set((free[0]*3+x)+','+(free[1]*3+y),'b:'+b.id);a.task='resting';c.updateDemand();assert.equal(a.broodDestination,null);assert.ok(freeCell(c.world,free));
});
test('a nurse with a full energy crop can fetch solid protein and physically feed a larva',()=>{
  const c=new Colony(287,{eggRate:0}),a=c.ants[1],queen=c.ants[0],baby=c.brood[1];for(const b of c.brood)if(b!==baby)bedRelease(c,b);c.brood=[baby];baby.nutrition=.1;
  c.ants=[queen,a];primeCrop(c,queen,socialCapacity(queen)*.6,socialCapacity(queen)*.4,waterCapacity(queen));primeCrop(c,a,socialCapacity(a),0,1);queen.task='queenRest';queen.busyUntil=1e9;a.cell=[-2,10];a.pos=[...a.cell];a.route=[];a.busyUntil=0;a.knownBrood=[baby.id];c.updateDemand();assert.equal(c.assignCare(a),true);assert.equal(a.task,'toCache');let carried=false;
  for(let i=0;i<1000&&baby.nutrition<.5;i++){c.step();if(a.cargoKind==='broodMeal'&&a.carried>0)carried=true;}
  assert.ok(carried,'A full crop must not prevent solid-food transport.');assert.ok(baby.nutrition>=.5,'The pellet must be delivered to the larva, not consumed remotely.');
});
test('nurses claim different beds and prioritize hungry larvae over recently tended eggs',()=>{
  const c=new Colony(287,{eggRate:0}),q=c.ants[0],[a,b]=c.ants.slice(1,3);primeCrop(c,q,3,1,2);
  c.world.carve([0,12],5,3);c.time=1000;c.brood.forEach((baby,i)=>{baby.cell=[i*2-2,12];baby.age=i===0?0:DAY*9;baby.nutrition=i===0?1:.1;baby.lastCare=990;baby.needsTransport=false;baby.lastMoved=1000;baby.carriedBy=null;});
  for(const ant of [a,b]){ant.cell=[0,12];ant.pos=[0,12];ant.knownBrood=c.brood.map(b=>b.id);primeCrop(c,ant,.5,.4,1);}
  assert.ok(c.assignCare(a));assert.ok(c.assignCare(b));assert.notEqual(a.broodID,b.broodID);assert.ok([a,b].every(ant=>broodStage(c.brood.find(x=>x.id===ant.broodID))==='larva'));
});
test('a protein-rich crop fuels work without a repeated empty energy-cache visit',()=>{
  const c=new Colony(287,{eggRate:0}),q=c.ants[0],a=c.ants[1];primeCrop(c,q,3,1,2);primeCrop(c,a,0,socialCapacity(a),1);a.energy=.5;clearBrood(c);c.updateDemand();c.chooseJob(a);assert.notEqual(a.cachePurpose==='self'&&a.task==='toCache',true);
  for(let i=0;i<20;i++)consumeSelf(c,a,1);assert.ok(a.energy>.95);assert.ok(a.socialProtein<socialCapacity(a));assert.ok(Math.abs(supplyBalance(c,'protein').error)<1e-7);
});
test('groundwater preserves dry route caches and invalidates them when passages flood',()=>{
  const w=new World(287);assert.ok(w.path(w.nest,[-4,12]));assert.ok(w.pathCache.size>0);tickGroundwater(w,2);assert.ok(w.pathCache.size>0,'A distant groundwater horizon must not discard dry routes every two seconds.');
  w.carve([0,35],1,1);assert.ok(w.walkable([0,35]));assert.ok(w.path(w.nest,[-4,12]));w.groundwater.targetDepth=24;tickGroundwater(w,1000);assert.equal(w.walkable([0,35]),false);assert.equal(w.pathCache.size,0,'Flooded topology must invalidate routes.');
});
test('nursery searches reuse geometry while observing new reservations, releases and excavation',()=>{
  const c=new Colony(),w=c.world;w.carve([12,15],3,2);const near=[12,15],first=findBed(w,near);assert.ok(first);assert.ok(holdCell(w,first,'test-bed'));const other=findBed(w,near);assert.ok(other);assert.notDeepEqual(other,first);releaseCell(w,first,'test-bed');assert.deepEqual(findBed(w,near),first);
  const far=[100,12];findBed(w,far);w.carve(far,3,2);assert.deepEqual(findBed(w,far),far);assert.ok(w.bedPools.size<=16);
});

test('adult cores remain solid while brood and cached food are walkable',async()=>{
 const {beginTraffic,bodyGap,canOccupy,sweptFree}=await import('../web/traffic.mjs');
 const c=new Colony(287),w=c.world;c.ants=c.ants.slice(0,2);c.brood=[];c.foodItems=[];w.patches=[];w.carve([0,20],8,3);
 for(const [i,a] of c.ants.entries()){a.cell=[i*3,20];a.pos=[...a.cell];a.motion.angle=0;}beginTraffic(c);
 assert.ok(bodyGap(c.ants[0],c.ants[1])>0);assert.equal(sweptFree(w,c.ants[0],[0,20],[6,20],0),false,'A large time step must not tunnel through another adult.');
 c.brood=[{id:990,cell:[1,20],age:DAY*9,carriedBy:null}];beginTraffic(c);assert.equal(canOccupy(w,c.ants[0],[1,20]),true);
 c.brood=[];c.foodItems=[{id:991,pos:[1,20],energy:1,protein:0}];beginTraffic(c);assert.equal(canOccupy(w,c.ants[0],[1,20]),true);
});
test('roofed untagged air gaps remain connected across the mound and original soil seam',()=>{
 const w=new World(287),x=0,y=w.baseSurface(x)-1;
 for(let xx=-2;xx<=2;xx++){w.deposits.add(key([xx,y-3]));w.heights.set(xx,y-3);for(let yy=y;yy<=y+2;yy++)w.excavated.add(key([xx,yy]));}
 w.changed([x,y]);assert.equal(w.moundTunnels.has(key([x,y])),false);assert.equal(w.coveredMound([x,y]),true);assert.equal(w.walkable([x,y]),true);assert.ok(w.path([x,y-1],[x,y+2]));
});
test('new eggs leave the queen body clear and nurses use adjacent contact positions',async()=>{
 const {beginTraffic,canOccupy}=await import('../web/traffic.mjs');const c=new Colony(287),q=c.ants[0];primeCrop(c,q,2,1,1);c.ants=[q];beginTraffic(c);
 assert.equal(c.layEgg(q),true);const b=c.brood.at(-1);assert.notDeepEqual(b.cell,q.cell);assert.ok(canOccupy(c.world,q,q.pos));assert.equal(b.carriedBy,null);
});
test('compressed older adult positions are separated without deleting ants or supplies',async()=>{
 const {bodyGap}=await import('../web/traffic.mjs');const old=new Colony(287).toJSON();for(const a of old.ants){a.cell=[0,11];a.pos=[0,11];}delete old.trafficVersion;const c=Colony.fromJSON(old);assert.equal(c.ants.length,old.ants.length);assert.equal(c.food,old.food);
 for(let i=0;i<c.ants.length;i++)for(let j=i+1;j<c.ants.length;j++)assert.ok(bodyGap(c.ants[i],c.ants[j])>=-.002);
});

test('a pupa can emerge beside its nurse when the actual adult footprint fits',async()=>{
  const {bodyGap}=await import('../web/traffic.mjs');const c=new Colony(287),q=c.ants[0],n=c.ants[1],b=c.brood.at(-1);for(const other of c.brood)if(other!==b)bedRelease(c,other);c.brood=[b];c.ants=[q,n];b.age=BROOD_DURATION+1;b.carriedBy=null;n.cell=[...b.cell];n.pos=[b.cell[0],b.cell[1]+.52];n.motion.angle=0;beginTraffic(c);assert.ok(canOccupy(c.world,n,n.pos));
  c.updateBrood(.1);const born=c.ants.find(a=>a.id===b.id);assert.ok(born,'Clear adult body space must allow emergence.');assert.ok(bodyGap(n,born)>=-.001);assert.equal(c.brood.some(x=>x.id===b.id),false);
});
test('routing recognizes a clear vertical stance even when a horizontal body cannot fit',async()=>{
  const {routeAroundItems}=await import('../web/traffic.mjs');const c=new Colony(287),a=c.ants[1];const left=c.ants[2],right=c.ants[3];c.ants=[a,left,right];c.brood=[];c.world.patches=[];c.world.carve([0,20],5,5);left.pos=[-.3,20];right.pos=[.3,20];left.cell=[0,20];right.cell=[0,20];left.motion.angle=right.motion.angle=Math.PI/2;a.cell=[0,23];a.pos=[0,23];a.bodySize=.55;a.motion.angle=Math.PI/2;
  c.foodItems=[];beginTraffic(c);assert.equal(canOccupy(c.world,a,[0,20],0),false);assert.equal(canOccupy(c.world,a,[0,20],Math.PI/2),true);const route=routeAroundItems(c.world,a,[0,20]);assert.ok(route);assert.deepEqual(route.at(-1).slice(0,2),[0,20]);
});

test('finite grain piles remain climbable without walking through their pieces',()=>{
  const c=new Colony(287),a=c.ants[2];c.ants=[a];c.brood=[];a.cell=[45,0];a.pos=[...a.cell];a.task='returningFood';a.carried=2;a.cargoKind='food';a.deliveryKind='food';a.deliveryAmount=2;a.cargoNutrition={energy:.8,protein:.2};c.supplyLedger.energy.introduced+=1.6;c.supplyLedger.protein.introduced+=.4;updateSupplyTotals(c);beginTraffic(c);
  a.destination=[1,11];a.route=routeAroundItems(c.world,a,a.destination);assert.ok(a.route?.length,'a crop-laden worker needs a route over grain piles');
  for(let i=0;i<1600&&c.foodDelivered<2;i++){c.time+=.1;beginTraffic(c);c.updateAnt(a,.1);assert.ok(canOccupy(c.world,a,a.pos),'The actual turning and walking body must keep clear of every finite grain portion.');}
  assert.equal(c.foodDelivered,2,'The worker must finish a real delivery using its normal recovery decisions.');assert.ok(distance(a.pos,c.world.nest)<=3);for(const kind of ['energy','protein'])assert.ok(Math.abs(supplyBalance(c,kind).error)<1e-6);
});

test('a stalled distant queen feeder does not exclude a nearby donor',()=>{
  const c=new Colony(287),q=c.ants[0],far=c.ants[1],near=c.ants[2];
  primeCrop(c,q,0,0,0);far.pos=[60,0];far.cell=[60,0];far.task='feedingQueen';far.lastProgressAt=c.time;
  near.pos=[1,11];near.cell=[1,11];primeCrop(c,near,.6,.5,.5);beginTraffic(c);
  assert.equal(c.assignQueenCare(near),true);c.feedQueen(near);assert.ok(q.socialProtein>0);assert.ok(q.socialWater>0);
});

test('brood can be placed beneath adults while retaining its own ground reservation',()=>{
 const c=new Colony(287),n=c.ants[1],b=c.brood[0];for(const baby of c.brood)bedRelease(c,baby);c.brood=[b];c.ants=[n];c.foodItems=[];c.world.patches=[];c.world.carve([0,20],4,3);
 b.age=0;b.cell=[0,20];b.carriedBy=n.id;n.task='carryingBrood';n.carryingBrood=b.id;n.broodID=b.id;n.cell=[0,20];n.pos=[0,20.38];n.motion.angle=0;n.broodDestination=[0,20];holdCell(c.world,[0,20],'b:'+b.id);beginTraffic(c);
 c.carryBrood(n);assert.equal(b.carriedBy,null,'Adults can stand over grounded brood.');assert.equal(freeCell(c.world,[0,20]),false);assert.ok(canOccupy(c.world,n,[0,20]));
 n.cell=[0,21];n.pos=[0,21];beginTraffic(c);assert.equal(b.carriedBy,null);assert.ok(canOccupy(c.world,n,n.pos));
});

test('surface soil carriers keep a placement route instead of stopping at every step',()=>{
 const c=new Colony(),a=c.ants[1];c.ants=[a];c.brood=[];c.foodItems=[];c.world.patches=[];beginTraffic(c);
 const p=[20,c.world.surface(20)-1],n=c.world.neighbors(p).find(q=>c.world.onSurface(q));assert.ok(n);a.cell=p;a.pos=[...p];a.motion.angle=Math.atan2(n[1]-p[1],n[0]-p[0]);a.route=[n];a.destination=[...n];a.depositTarget=[n[0]+2,c.world.surface(n[0]+2)];a.task='haulingSoil';a.carried=1;a.cargoKind='soil';a.busyUntil=0;beginTraffic(c);
 c.updateAnt(a,.1);assert.ok(a.route.length,'A placement route must remain active while walking outside.');assert.ok(distance(a.pos,p)>0);
});
test('a worker yielding beside brood completes its sidestep before contact work',()=>{
 const c=new Colony(),a=c.ants[1],b=c.brood[0];c.ants=[a];c.brood=[b];c.foodItems=[];c.world.patches=[];c.world.carve([0,20],5,4);b.cell=[0,21];b.carriedBy=null;a.cell=[0,20];a.pos=[0,20];a.motion.angle=0;a.task='nursing';a.broodID=b.id;a.route=[[1,20],[2,20]];a.destination=[0,21];a.motion.yieldingRoute=true;a.motion.yieldTarget=[2,20];a.motion.resumeGoal=[0,21];a.motion.yieldEnd=c.time+10;a.busyUntil=0;beginTraffic(c);
 c.updateAnt(a,.1);assert.ok(a.route.length);assert.ok(a.pos[0]>0,'Contact range must not cancel a physical yielding route.');assert.equal(a.motion.yieldingRoute,true);
});

test('brood pickup uses physical contact rather than the rounded navigation cell',()=>{
 const c=new Colony(),a=c.ants[1],b=c.brood[0];for(const baby of c.brood)bedRelease(c,baby);c.ants=[a];c.brood=[b];c.foodItems=[];c.world.patches=[];c.world.carve([0,20],4,4);b.cell=[0,20];b.carriedBy=null;holdCell(c.world,b.cell,'b:'+b.id);a.pos=[.8,19.2];a.cell=[1,19];a.motion.angle=Math.PI/2;a.broodID=b.id;a.broodDestination=[0,23];beginTraffic(c);
 assert.ok(distance(a.cell,b.cell)>1.1);assert.ok(distance(a.pos,b.cell)<1.25);c.collectBrood(a);assert.equal(b.carriedBy,a.id);assert.equal(a.carryingBrood,b.id);
});

test('resource return completes from contact range even when the rounded cell is outside it',()=>{
 const c=new Colony(),a=c.ants[1];c.ants=[a];c.brood=[];c.foodItems=[];c.world.patches=[];c.world.carve([0,11],5,3);a.pos=[-2.76,10.01];a.cell=[-3,10];a.task='returningFood';a.deliveryKind='food';a.deliveryAmount=1;a.route=[[-2,10]];a.destination=[...c.world.nest];a.busyUntil=0;beginTraffic(c);
 assert.ok(distance(a.pos,c.world.nest)<3);assert.ok(distance(a.cell,c.world.nest)>3);c.updateAnt(a,.1);assert.equal(a.task,'sharing');c.time=2;c.updateAnt(a,.1);assert.equal(c.foodDelivered,1);assert.equal(a.deliveryKind,null);
});

test('a supported contour waypoint is not rejected by its rounded sky cell',async()=>{
 const {terrainFree}=await import('../web/traffic.mjs');const c=new Colony(),a=c.ants[1],w=c.world;c.ants=[a];c.brood=[];c.foodItems=[];w.patches=[];w.solid=p=>p[1]>=1;w.baseSurface=()=>1;w.surface=()=>1;beginTraffic(c);
 a.pos=[-1,-.7];a.cell=[-1,0];a.motion.angle=0;a.task='toDig';a.target=[1,1];a.route=[[0,-.7,0],[1,0]];a.destination=[1,0];a.busyUntil=0;assert.equal(w.walkable([0,-1]),false);assert.equal(terrainFree(w,[0,-.7]),true);
 c.updateAnt(a,.1);assert.ok(a.pos[0]>-1);assert.ok(a.route.length,'A legal continuous waypoint must survive the navigation check.');
});

test('terrain recovery checks the turning body against a nearby worker',async()=>{
 const {bodyGap}=await import('../web/traffic.mjs'),{recoverBody}=await import('../web/locomotion.mjs');const c=new Colony(),a=c.ants[3],b=c.ants[5],w=c.world;c.ants=[a,b];c.brood=[];c.foodItems=[];w.patches=[];
 const solid=new Set(['4,-1','4,0','5,0','6,0','4,1','5,1','6,1','7,1','8,1','9,1','4,2','5,2','6,2','7,2','8,2','9,2']);w.solid=p=>solid.has(key(p));
 a.bodySize=.5000064463320006;a.pos=[6.558649430538055,.3090973218818867];a.cell=[7,0];a.motion.angle=2.5306357040438163;a.motion.recovering=true;b.bodySize=.37813687004982244;b.pos=[6.906131690267359,.34741408799553813];b.cell=[7,0];b.motion.angle=-3.8849890445439956;beginTraffic(c);
 assert.ok(bodyGap(a,b)>0);const start=[...a.pos];recoverBody(a,w,.1);assert.ok(distance(start,a.pos)>0,'Recovery can translate without forcing a blocked turn.');assert.ok(bodyGap(a,b)>=-.001);
});

test('loss of grain footing recovers to supported ground without a position snap',async()=>{
 const {terrainFree}=await import('../web/traffic.mjs'),{recoverBody}=await import('../web/locomotion.mjs');const c=new Colony(),a=c.ants[1],w=c.world;c.ants=[a];c.brood=[];c.foodItems=[];w.patches=[];w.solid=p=>p[1]>=1;w.baseSurface=()=>1;w.surface=()=>1;a.pos=[0,-1.1];a.cell=[0,0];a.motion.angle=Math.PI/2;a.motion.recovering=true;beginTraffic(c);
 assert.equal(terrainFree(w,a.pos),false);recoverBody(a,w,.1);assert.ok(a.pos[1]>-1.1&&a.pos[1]<-.9);for(let i=0;i<20&&a.motion.recovering;i++)recoverBody(a,w,.1);assert.equal(terrainFree(w,a.pos),true);assert.equal(a.motion.recovering,false);
});

test('interrupted brood jobs release their work claims so another nurse can help',()=>{
 const c=new Colony(),b=c.brood[1],hauler=c.ants[1],oldNurse=c.ants[2],helper=c.ants[3];primeCrop(c,c.ants[0],2,1,1);primeCrop(c,helper,.3,.5,.2);hauler.task='refueling';hauler.broodID=b.id;hauler.carryingBrood=null;oldNurse.task='exploring';oldNurse.broodID=b.id;c.broodClaims.add(b.id);c.careClaims=new Map([[b.id,oldNurse.id]]);b.nutrition=.2;b.needsTransport=false;b.lastMoved=c.time;helper.cell=[b.cell[0]+1,b.cell[1]];helper.pos=[...helper.cell];helper.knownBrood=[b.id];beginTraffic(c);
 c.updateDemand();assert.equal(c.broodClaims.has(b.id),false);assert.equal(c.careClaims.has(b.id),false);assert.equal(c.assignCare(helper),true);assert.equal(helper.task,'nursing');assert.equal(helper.broodID,b.id);
});

test('continuous movement deposits readable chemical trails without heading coordinates or buried signal cells',async()=>{
 const {senseAntennae}=await import('../web/locomotion.mjs');const c=new Colony(),a=c.ants[1],w=c.world;c.ants=[a];c.brood=[];c.foodItems=[];w.patches=[];w.carve([0,20],4,4);a.pos=[0,20];a.cell=[0,20];a.task='exploring';a.foragingKind='food';a.motion.angle=0;a.motion.phase=0;a.motion.nextSense=0;beginTraffic(c);w.signals.food.clear();
 emit(w,'food',[.75,20.8,Math.PI/2],2);assert.ok([...w.signals.food.keys()].every(id=>id.split(',').length===2&&id.split(',').every(n=>Number.isInteger(Number(n)))));assert.ok(Math.abs([...w.signals.food.values()].reduce((s,n)=>s+n,0)-2)<1e-9);
 senseAntennae(a,w,0,new Map());assert.ok(a.brain.antennae.right.food>a.brain.antennae.left.food);assert.ok(a.motion.turn>0,'An antenna must be able to read and steer toward the actual deposited trail.');
 w.excavated.delete(key([1,21]));w.changed([1,21]);w.signals.food.clear();emit(w,'food',[.75,20.8,Math.PI/2],2);assert.equal(w.signals.food.has('1,21'),false);assert.ok(Math.abs([...w.signals.food.values()].reduce((s,n)=>s+n,0)-2)<1e-9);
});
