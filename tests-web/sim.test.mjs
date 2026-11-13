import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Colony,World,key,LIMIT} from '../web/sim.mjs';
import {SaveStore,SAVE_KEY} from '../web/persistence.mjs';
const run=(colony,seconds)=>{for(let i=0;i<seconds*10;i++)colony.step();return colony;};
test('three seeded colonies gather food/water, excavate, deposit soil, and raise brood',()=>{
  for(const seed of [17,287,914]){
    const c=run(new Colony(seed),360);
    assert.ok(c.foodDelivered>0,'food');assert.ok(c.waterDelivered>0,'water');assert.ok(c.births>0,'brood');assert.ok(c.world.soilDeposited>0,'mound');assert.ok(c.alive,'queen');
    const cargo=c.ants.filter(a=>a.task==='haulingSoil').reduce((sum,a)=>sum+a.carried,0);
    assert.equal(c.world.soilExcavated,c.world.soilDeposited+c.world.soilAbandoned+cargo);assert.ok(c.ants.every(a=>c.world.walkable(a.cell)));assert.ok(c.ants.length<=LIMIT);
  }
});
test('routes remain connected, walls can be climbed, and solid destinations are rejected',()=>{
  const w=new World(9);for(const y of [-2,-1,0])w.deposits.add(key([3,y]));w.heights.set(3,-2);
  const route=w.path(w.nest,[4,0]);assert.ok(route.some(c=>c[1]<-1));let prior=w.nest;
  for(const next of route){assert.ok(w.neighbors(prior).some(n=>key(n)===key(next)));prior=next;}
  assert.equal(w.path(w.nest,[60,50]),null);
});
test('seeded behavior is deterministic and save restoration continues exactly',()=>{
  const a=run(new Colony(88),80),b=Colony.fromJSON(JSON.parse(JSON.stringify(a)));
  a.place('food',7);b.place('food',7);run(a,40);run(b,40);assert.deepEqual(a.toJSON(),b.toJSON());
});
test('autosave recovers a valid backup and protects unreadable existing progress',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=new SaveStore(storage),c=run(new Colony(),30);store.save(c);run(c,20);store.save(c);storage.setItem(SAVE_KEY,'broken');
  const recovered=store.load();assert.equal(recovered.recovered,true);assert.ok(Math.abs(recovered.colony.time-30)<.001);
  storage.setItem(SAVE_KEY+'.backup','broken');assert.throws(()=>store.load());assert.equal(store.save(c),false);assert.equal(storage.getItem(SAVE_KEY),'broken');assert.equal(store.save(c,true),true);
});
test('starvation ends a colony, invalid steps are ignored, and births respect the cap',()=>{
  const c=new Colony();c.food=0;c.water=0;c.world.patches=[];c.ants=c.ants.filter(a=>a.caste==='queen');run(c,700);assert.equal(c.alive,false);
  const time=c.time;for(const dt of [NaN,-1,100])c.step(dt);assert.equal(c.time,time);
  const full=new Colony(),template=full.ants[1];for(let id=1000;full.ants.length<119;id++)full.ants.push({...structuredClone(template),id});
  full.brood.forEach(b=>b.age=151);full.step();assert.equal(full.ants.length,120);
});
