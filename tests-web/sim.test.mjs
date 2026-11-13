import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Colony,World,key,LIMIT,DAY,BROOD_DURATION,createAnt,Random} from '../web/sim.mjs';
import {MATERIALS,baseMaterial} from '../web/materials.mjs';
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
  store.save(c);run(c,20);store.save(c);assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).version,2);storage.setItem(SAVE_KEY,'broken');
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
  const c=new Colony(17),a=c.ants[1];a.cell=[-17,0];a.pos=[...a.cell];a.foragingKind='food';assert.ok(c.discover(a));
  const food=c.world.patches.find(p=>p.kind==='food'&&p.cell[0]===-19);food.amount=0;
  a.cell=[10,0];a.pos=[...a.cell];assert.ok(c.discover(a));assert.deepEqual(a.target,[-19,0],'A distant depletion is not magically known.');
  a.cell=[-19,0];a.pos=[...a.cell];a.route=[];a.busyUntil=0;c.updateAnt(a,.1);
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
test('soil layers affect excavation and spoil preserves its origin without becoming grassy topsoil',()=>{
  const w=new World(5);assert.equal(w.material([0,12]),'sand');assert.equal(w.material([0,26]),'clay');assert.ok(w.digTime([0,26])>w.digTime([0,12]));
  w.planRoom(new Random(1));const site=w.frontier()[0],origin=w.material(site);assert.ok(w.excavate(site));const pile=w.depositSite();assert.ok(w.deposit(pile,origin));assert.equal(w.material(pile),'spoil');assert.equal(w.spoilOrigins.get(key(pile)),origin);
  let stone;for(let y=32;y<60&&!stone;y++)for(let x=-30;x<30;x++)if(baseMaterial([x,y],w.seed)==='rock'){stone=[x,y];break;}
  assert.ok(stone);w.excavated.add(key([stone[0]-1,stone[1]]));assert.equal(w.digTime(stone),Infinity);assert.equal(w.excavate(stone),false);
  const wet=new World(2);wet.patches=Array.from({length:12},(_,id)=>({id,kind:'water',cell:[id%3-1,0],amount:80}));assert.ok(wet.conditions([0,1]).humidity>.94);assert.equal(wet.digTime([0,1]),Infinity);
});
test('a colony with ample usable space does not dig endlessly',()=>{
  const c=new Colony(1);c.world.carve([0,15],25,12);c.world.construction=[];run(c,120);assert.equal(c.world.soilExcavated,0);assert.equal(c.world.construction.length,0);
});
test('64x uses the same fixed ticks, while a CPU budget bounds catch-up work',()=>{
  const c=new Colony(1),reference=new Colony(1);let pending=0;
  for(let i=0;i<20;i++){const step=advanceSimulation(c,pending,.05,64,()=>0);pending=step.pending;}
  for(let i=0;i<640;i++)reference.step();assert.ok(Math.abs(c.time-64)<1e-6);assert.deepEqual(c.toJSON(),reference.toJSON());
  let clock=0;const bounded=advanceSimulation(new Colony(),100,.1,64,()=>clock++,6);assert.ok(bounded.ticks<10);assert.ok(bounded.pending<=32);assert.ok(bounded.ticks>0);
});
