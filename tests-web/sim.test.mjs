import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Colony,World,key,LIMIT,DAY,BROOD_DURATION,createAnt,Random} from '../web/sim.mjs';
import {MATERIALS,baseMaterial} from '../web/materials.mjs';
import {terrainHeight,basins,tickHabitat,harvest} from '../web/ecology.mjs';
import {broodStage} from '../web/biology.mjs';
import {advanceSimulation} from '../web/clock.mjs';
import {SaveStore,SAVE_KEY,decodeSave} from '../web/persistence.mjs';
const run=(c,seconds)=>{for(let i=0;i<seconds*10;i++)c.step();return c;};
test('small seeded colonies forage, excavate, grow a mound, and develop brood',()=>{
  for(const seed of [17,287,914]){
    const c=run(new Colony(seed),360);
    assert.ok(c.foodDelivered>0);assert.ok(c.waterDelivered>0);assert.ok(c.births>0);assert.ok(c.world.soilDeposited>0);assert.ok(c.alive);
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
  assert.deepEqual([...c.world.excavated],old.world.excavated);assert.deepEqual([...c.world.deposits],old.world.deposits);
  assert.ok(c.ants.some(a=>a.caste==='major'));assert.equal(c.settings.populationCap,120);
  run(c,60);assert.ok(c.ants.every(a=>Number.isFinite(a.health)));assert.ok(c.alive);
});
test('autosave recovers a valid backup and protects unreadable progress',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},store=new SaveStore(storage),c=run(new Colony(),30);
  store.save(c);run(c,20);store.save(c);assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).version,3);storage.setItem(SAVE_KEY,'broken');
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
  c.world.patches=[food];a.cell=[-17,c.world.surface(-17)-1];a.pos=[...a.cell];a.foragingKind='food';assert.ok(c.discover(a));food.amount=0;
  a.cell=[10,c.world.surface(10)-1];a.pos=[...a.cell];assert.ok(c.discover(a));assert.deepEqual(a.target,food.cell,'Distant depletion is not magically known.');
  a.cell=[...food.cell];a.pos=[...a.cell];a.route=[];a.busyUntil=0;c.updateAnt(a,.1);
  assert.ok(a.memories[0].confidence<.85);assert.equal(a.memories[0].failures,1);assert.ok(a.memories[0].avoidUntil>c.time);
});
test('recruitment requires a nearby returning nestmate',()=>{
  const c=new Colony(2),scout=c.ants[1],donor=c.ants[2];Object.assign(donor,{cell:[3,0],pos:[3,0],task:'returningFood',memory:[-19,0],carried:2.5});
  scout.cell=[50,0];scout.pos=[50,0];scout.encounterAt=0;c.time=5;c.occupancy=new Map([[key(donor.cell),[donor]]]);c.encounter(scout);assert.equal(scout.memories.length,0);
  scout.cell=[2,0];scout.pos=[2,0];scout.encounterAt=0;c.encounter(scout);assert.equal(scout.memories.length,1);assert.equal(c.recruitments,1);
});
test('larvae need actual local care and protein rather than a global nurse bonus',()=>{
  const c=new Colony(12),nurse=c.ants[1],b=c.brood[0];c.brood=[b];b.age=BROOD_DURATION*.4;b.nutrition=0;b.lastCare=0;
  Object.assign(nurse,{task:'nursing',broodID:b.id,cell:[40,0],pos:[40,0],route:[],busyUntil:0});
  c.updateAnt(nurse,.1);assert.equal(b.nutrition,0);const age=b.age;c.updateBrood(5);assert.equal(b.age,age);
  c.time=20;Object.assign(nurse,{cell:[...b.cell],pos:[...b.cell],route:[],busyUntil:0,task:'nursing'});c.updateAnt(nurse,.1);
  assert.ok(b.nutrition>0);c.updateBrood(5);assert.ok(b.age>age);
  b.nutrition=0;c.protein=0;nurse.task='nursing';nurse.route=[];nurse.busyUntil=0;c.updateAnt(nurse,.1);assert.equal(b.nutrition,0);
});
test('every depth is soft diggable earth and deposited spoil stays distinct',()=>{
  const w=new World(5);for(const y of [12,26,60,500,5000]){assert.equal(w.material([0,y]),'earth');assert.equal(w.digTime([0,y]),w.digTime([0,12]));}
  assert.ok(!Object.keys(MATERIALS).includes('rock'));w.planRoom(new Random(1));const site=w.frontier()[0],origin=w.material(site);assert.ok(w.excavate(site));
  const pile=w.depositSite();assert.ok(w.deposit(pile,origin));assert.equal(w.material(pile),'spoil');assert.equal(w.spoilOrigins.get(key(pile)),origin);
  w.excavated.add(key([0,4999]));assert.equal(w.excavate([0,5000]),true);
});
test('a colony with ample usable space does not dig endlessly',()=>{
  const c=new Colony(1);c.world.carve([0,15],25,12);c.world.construction=[];run(c,120);assert.equal(c.world.soilExcavated,0);assert.equal(c.world.construction.length,0);
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
test('queen walks under shelter, lays at her own position, and workers carry single reserved eggs to nursery',()=>{
  const c=new Colony(287),queen=c.ants[0];c.brood=[];c.food=80;c.water=60;c.protein=30;c.lastEgg=-1000;c.updateDemand();
  c.updateQueen(queen);assert.equal(queen.task,'laying');const at=[...queen.cell];c.time=queen.layUntil;c.updateQueen(queen);assert.equal(c.brood.length,1);const b=c.brood[0];assert.deepEqual(b.cell,at);assert.equal(broodStage(b),'egg');assert.equal(b.needsTransport,true);
  const nurse=c.ants[1],other=c.ants[2];assert.equal(c.assignBroodTransport(nurse),true);assert.equal(c.assignBroodTransport(other),false,'A second nurse must not reserve the same egg.');
  let carried=false;for(let i=0;i<2000&&c.broodMoved===0;i++){c.step();if(b.carriedBy!=null){carried=true;const carrier=c.ants.find(a=>a.id===b.carriedBy);assert.deepEqual(b.pos,carrier.pos);}}
  assert.equal(carried,true);assert.equal(c.broodMoved,1);assert.equal(b.carriedBy,null);assert.equal(b.needsTransport,false);assert.notDeepEqual(b.cell,at);
  const positions=new Set();for(let i=0;i<6000;i++){c.step();positions.add(key(queen.cell));assert.equal(c.world.onSurface(queen.cell),false);}assert.ok(positions.size>1);
});
test('brood retains three distinct stages and a carrier death releases it without duplication',()=>{
  const c=new Colony(287),[egg,larva,pupa]=c.brood;assert.deepEqual(c.brood.map(broodStage),['egg','larva','pupa']);
  const nurse=c.ants[1];nurse.task='carryingBrood';nurse.carryingBrood=egg.id;nurse.broodID=egg.id;egg.carriedBy=nurse.id;egg.pos=[...nurse.pos];nurse.health=-1;
  c.step();assert.ok(!c.ants.includes(nurse));assert.equal(egg.carriedBy,null);assert.equal(egg.needsTransport,true);assert.equal(c.brood.filter(b=>b.id===egg.id).length,1);
});
test('blocked routes replan without discarding or reclassifying food, and resting is purposeful',()=>{
  const c=new Colony(287),a=c.ants[1];a.cell=[...c.world.entrance()];a.pos=[...a.cell];Object.assign(a,{task:'returningWater',carried:2,cargoKind:'water',route:[],lastProgressAt:0,lastProgressPos:[...a.pos]});
  c.time=30;c.auditProgress(a);assert.equal(a.carried,2);assert.equal(a.task,'returningWater');assert.ok(a.route.length>0);assert.equal(c.world.runtime.recoveries,1);
  c.chooseJob(a);assert.equal(a.task,'returningWater');for(let i=0;i<1000&&c.waterDelivered===0;i++)c.step();assert.ok(c.waterDelivered>=2);assert.equal(c.world.soilDeposited,0);
  a.task='grooming';a.busyUntil=c.time+15;const recoveries=c.world.runtime.recoveries;c.auditProgress(a);assert.equal(c.world.runtime.recoveries,recoveries);
});
test('v0.3 progress migrates without reshaping existing ground or losing its state',()=>{
  const raw=readFileSync(new URL('./fixtures/v2-colony.json',import.meta.url),'utf8'),d=JSON.parse(raw).colony,c=decodeSave(raw);
  assert.equal(c.ants.length,d.ants.length);assert.equal(c.world.terrainVersion,0);assert.equal(c.world.soilExcavated,d.world.soilExcavated);assert.deepEqual([...c.world.deposits],d.world.deposits);assert.equal(c.time,d.time);
  run(c,180);assert.ok(c.alive);assert.equal(c.world.soilExcavated,c.world.soilDeposited+c.world.soilAbandoned+c.ants.filter(a=>a.cargoKind==='soil').reduce((sum,a)=>sum+a.carried,0));
});

test('attendants physically provision a queen beyond the central food-sharing area',()=>{
  const c=new Colony(287,{eggRate:0}),queen=c.ants[0],nurse=c.ants[1];c.ants=[queen,nurse];c.brood=[];
  for(let x=-12;x<=0;x++)c.world.excavated.add(key([x,11]));c.world.carve([-12,12],3,2);c.world.changed([-12,12]);
  Object.assign(queen,{cell:[-12,12],pos:[-12,12],energy:.5,hydration:.5,queenCheckAt:Infinity});
  Object.assign(nurse,{cell:[...c.world.nest],pos:[...c.world.nest],route:[],busyUntil:0});
  c.updateDemand();c.chooseJob(nurse);assert.equal(nurse.task,'toQueenStore');c.updateAnt(nurse,.1);assert.equal(nurse.task,'feedingQueen');assert.equal(queen.energy,.5,'A distant attendant cannot feed remotely.');
  for(let i=0;i<2000&&queen.energy<.7;i++)c.step();assert.ok(queen.energy>.7);assert.ok(queen.hydration>.7);assert.equal(nurse.carried,0);
});

test('rain, growth, and brood in flight continue exactly across a save',()=>{
  const raw=readFileSync(new URL('./fixtures/v3-living.json',import.meta.url),'utf8'),a=decodeSave(raw),b=Colony.fromJSON(JSON.parse(JSON.stringify(a)));
  assert.equal(a.world.weather.raining,true);assert.ok(a.ants.some(a=>a.carryingBrood));run(a,30);run(b,30);assert.deepEqual(a.toJSON(),b.toJSON());
});
