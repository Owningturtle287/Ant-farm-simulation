import {DAY,BROOD_DURATION,LIMIT,DEFAULT_SETTINGS,Random,clamp,settingsFrom,createAnt,normalizeAnt,adultDays,broodStage} from './biology.mjs';
import {MATERIALS,baseMaterial,materialAt,conditionsAt,digDuration,hashCell} from './materials.mjs';
export {DAY,BROOD_DURATION,LIMIT,DEFAULT_SETTINGS,Random,createAnt,adultDays,broodStage};
export const key=([x,y])=>x+','+y;
export const cell=s=>s.split(',').map(Number);
export const same=(a,b)=>!!a && !!b && a[0]===b[0] && a[1]===b[1];
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const adjacent=([x,y])=>[[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
const names=['Amber','Clover','Fern','Hazel','Moss','Pip','Rowan','Sage'];
export const antName=a=>a.caste==='queen'?'Queen Aurelia':names[a.id%8]+' '+String(a.id).padStart(2,'0');
export const casteLabel=a=>a.caste==='major'?'Major worker':a.caste==='queen'?'Queen':'Minor worker';
export const taskLabels={queen:'Preparing eggs',queenRest:'Resting between egg batches',exploring:'Scouting the clearing',toFood:'Following a food source',toWater:'Collecting water',
  returningFood:'Bringing food home',returningWater:'Bringing water home',sharing:'Sharing food and water',toDig:'Heading to the dig',digging:'Excavating soil',
  haulingSoil:'Carrying an earth pellet',nursing:'Feeding and tending brood',resting:'Resting in the nest',grooming:'Grooming',patrolling:'Guarding the entrance'};
export function reason(a){return a.decision || 'Responding to local conditions and colony needs.';}

export class World{
  constructor(seed=287){
    this.seed=seed;this.excavated=new Set();this.deposits=new Set();this.heights=new Map();this.spoilOrigins=new Map();
    this.construction=[];this.plannedRooms=0;this.revision=0;this.chunkRevisions=new Map();this.soilExcavated=0;this.soilDeposited=0;this.soilAbandoned=0;
    this.pheromones=new Map();this.trails={food:new Map(),water:new Map()};this.nest=[0,11];this.pathCache=new Map();this.neighborCache=new Map();
    this.runtime={pathCalls:0,pathMs:0};this.frontierVersion=-1;this.frontierCache=[];
    this.rooms=[{kind:'queen',center:[0,11],rx:3,ry:2},{kind:'nursery',center:[-5,10],rx:2,ry:1},{kind:'storage',center:[4,11],rx:2,ry:1}];
    for(let y=1;y<=12;y++)this.excavated.add(key([0,y]));
    for(const room of this.rooms)this.carve(room.center,room.rx,room.ry);
    for(let x=-5;x<=4;x++)this.excavated.add(key([x,11]));
    this.patches=[{id:0,cell:[-19,0],kind:'food',amount:140},{id:1,cell:[25,0],kind:'food',amount:180},{id:2,cell:[13,0],kind:'water',amount:180},{id:3,cell:[-36,0],kind:'water',amount:120}];
  }
  carve([cx,cy],rx,ry){for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++)if(x*x/(rx*rx)+y*y/(ry*ry)<=1.12)this.excavated.add(key([cx+x,cy+y]));}
  solid(c){return this.deposits.has(key(c)) || (c[1]>=1 && !this.excavated.has(key(c)));}
  surface(x){return this.heights.get(x)??1;}
  walkable(c){return !this.solid(c) && (c[1]>0 || c[1]===this.surface(c[0])-1 || adjacent(c).some(n=>this.solid(n)));}
  material(c){return materialAt(this,c);}
  conditions(c){return conditionsAt(this,c);}
  digTime(c,skill=0){return digDuration(this,c,skill);}
  neighbors(c){
    const id=key(c),cached=this.neighborCache.get(id);if(cached)return cached;
    const [x,y]=c,all=adjacent(c);for(const dx of [-1,1])for(const dy of [-1,1])if(!this.solid([x+dx,y]) || !this.solid([x,y+dy]))all.push([x+dx,y+dy]);
    const result=all.filter(n=>this.walkable(n));if(this.neighborCache.size>6000)this.neighborCache.clear();this.neighborCache.set(id,result);return result;
  }
  path(start,goal){
    this.runtime.pathCalls++;const began=performance.now();
    try{
      if(!this.walkable(start) || !this.walkable(goal))return null;if(same(start,goal))return [];
      const id=key(start)+'>'+key(goal),cached=this.pathCache.get(id);if(cached)return cached.map(c=>[...c]);
      const minX=Math.min(start[0],goal[0],-12)-8,maxX=Math.max(start[0],goal[0],12)+8,minY=Math.min(start[1],goal[1],-6)-3,maxY=Math.max(start[1],goal[1],15)+8;
      const queue=[start],previous=new Map([[key(start),null]]);let head=0;
      while(head<queue.length && head<12000){
        const current=queue[head++];for(const next of this.neighbors(current)){
          const nextKey=key(next);if(previous.has(nextKey)||next[0]<minX||next[0]>maxX||next[1]<minY||next[1]>maxY)continue;
          previous.set(nextKey,current);
          if(same(next,goal)){const route=[next];let cursor=current;while(!same(cursor,start)){route.push(cursor);cursor=previous.get(key(cursor));}route.reverse();if(this.pathCache.size>=256)this.pathCache.delete(this.pathCache.keys().next().value);this.pathCache.set(id,route);return route.map(c=>[...c]);}
          queue.push(next);
        }
      }return null;
    }finally{this.runtime.pathMs+=performance.now()-began;}
  }
  planRoom(rng=new Random(this.seed+this.plannedRooms),kind='nursery'){
    const anchors=this.rooms.filter(r=>this.excavated.has(key(r.center)));let best=null;
    for(let i=0;i<12;i++){
      const anchor=anchors[rng.int(0,anchors.length-1)],side=rng.int(0,1)?1:-1;
      const center=[anchor.center[0]+side*rng.int(5,9),Math.max(7,anchor.center[1]+rng.int(-1,6))],rx=rng.int(2,4),ry=rng.int(1,2);
      const condition=this.conditions(center),ideal=kind==='nursery'?.62:.48;
      let score=Math.abs(condition.humidity-ideal)*14+Math.abs(center[0])*.015;
      for(const r of this.rooms)score+=Math.max(0,rx+r.rx+2-distance(center,r.center))*2;
      if(condition.humidity>.9 || baseMaterial(center,this.seed)==='rock')score+=100;
      const plan=[],cursor=[...anchor.center];let blocked=false;
      while(!same(cursor,center)){
        const chooseY=cursor[1]!==center[1] && (cursor[0]===center[0] || rng.int(0,2)===0);
        cursor[chooseY?1:0]+=Math.sign(center[chooseY?1:0]-cursor[chooseY?1:0]);
        if(baseMaterial(cursor,this.seed)==='rock'){blocked=true;break;}plan.push([...cursor]);
      }
      if(blocked)continue;
      for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++){
        const c=[center[0]+x,center[1]+y],roughness=(hashCell(c,this.seed)%11)*.012;
        if(x*x/(rx*rx)+y*y/(ry*ry)<=1+roughness && baseMaterial(c,this.seed)!=='rock')plan.push(c);
      }
      if(!best || score<best.score)best={score,plan,center,rx,ry};
    }
    if(!best)return false;
    const known=new Set(this.construction.map(key));
    for(const c of best.plan)if(this.solid(c)&&!known.has(key(c))){this.construction.push(c);known.add(key(c));}
    this.rooms.push({kind,center:best.center,rx:best.rx,ry:best.ry});this.plannedRooms++;this.frontierVersion=-1;return true;
  }
  frontier(){
    if(this.frontierVersion!==this.revision){
      this.frontierCache=this.construction.filter(c=>this.solid(c)&&Number.isFinite(this.digTime(c))&&adjacent(c).some(n=>this.walkable(n)));
      this.frontierVersion=this.revision;
    }return this.frontierCache;
  }
  changed(c){
    this.revision++;this.pathCache.clear();this.neighborCache.clear();this.frontierVersion=-1;
    for(const n of [c,...adjacent(c)])this.chunkRevisions.set(key([Math.floor(n[0]/16),Math.floor(n[1]/16)]),this.revision);
  }
  excavate(c){
    if(c[1]<=0||!this.solid(c)||!Number.isFinite(this.digTime(c))||!adjacent(c).some(n=>this.walkable(n)))return false;
    this.excavated.add(key(c));this.construction=this.construction.filter(n=>!same(n,c));this.soilExcavated++;this.changed(c);return true;
  }
  depositSite(){
    let best=null,score=Infinity;
    const radius=12+Math.floor(this.soilDeposited/80);
    for(let x=-radius;x<=radius;x++)if(Math.abs(x)>=2){
      const y=this.surface(x)-1;
      // Short carrying distances, a clear entrance, and a stable, broad slope.
      const neighborHeight=Math.min(this.surface(x-1),this.surface(x+1));
      const steep=Math.max(0,neighborHeight-(y+1))*2,candidate=-y+Math.abs(x)*.20+steep;
      if(candidate<score){best=[x,y];score=candidate;}
    }return best;
  }
  deposit(c,origin='mixed'){
    if(c[1]!==this.surface(c[0])-1||Math.abs(c[0])<2)return false;
    this.deposits.add(key(c));this.heights.set(c[0],c[1]);this.spoilOrigins.set(key(c),origin??'mixed');this.soilDeposited++;this.changed(c);
    for(const p of this.patches)if(p.cell[0]===c[0])p.cell[1]=c[1]-1;return true;
  }
  place(kind,x){
    x=Math.max(-2000,Math.min(2000,Math.round(x)))||0;const old=this.patches.find(p=>p.cell[0]===x&&p.kind===kind);
    if(old)old.amount+=80;else this.patches.push({id:Math.max(...this.patches.map(p=>p.id),0)+1,cell:[x,this.surface(x)-1],kind,amount:80});
  }
  toJSON(){return {seed:this.seed,excavated:[...this.excavated],deposits:[...this.deposits],spoilOrigins:[...this.spoilOrigins],construction:this.construction,rooms:this.rooms,plannedRooms:this.plannedRooms,
    revision:this.revision,chunkRevisions:[...this.chunkRevisions],soilExcavated:this.soilExcavated,soilDeposited:this.soilDeposited,soilAbandoned:this.soilAbandoned,
    pheromones:[...this.pheromones],trails:{food:[...this.trails.food],water:[...this.trails.water]},patches:this.patches};}
  static fromJSON(d,legacy=false){
    const w=new World(d.seed);Object.assign(w,d);
    for(const f of ['excavated','deposits'])w[f]=new Set(d[f]);
    for(const f of ['chunkRevisions','pheromones','spoilOrigins'])w[f]=new Map(d[f]??[]);
    w.trails={food:new Map(d.trails?.food??d.pheromones??[]),water:new Map(d.trails?.water??[])};
    w.heights=new Map();for(const id of w.deposits){const [x,y]=cell(id);w.heights.set(x,Math.min(w.heights.get(x)??1,y));if(!w.spoilOrigins.has(id))w.spoilOrigins.set(id,'mixed');}
    if(legacy){w.construction=[];w.rooms=[{kind:'queen',center:[0,11],rx:6,ry:3},{kind:'nursery',center:[-10,10],rx:4,ry:2},{kind:'storage',center:[10,10],rx:4,ry:2}];}
    w.pathCache=new Map();w.neighborCache=new Map();w.runtime={pathCalls:0,pathMs:0};w.frontierVersion=-1;w.frontierCache=[];return w;
  }
}

export class Colony{
  constructor(seed=287,settings={}){
    this.modelVersion=2;this.settings=settingsFrom(settings);this.world=new World(seed);this.rng=new Random(seed);this.time=0;
    const n=Math.min(this.settings.startingWorkers,this.settings.populationCap-1);
    this.food=Math.max(12,n*.7);this.protein=Math.max(5,n*.3);this.water=Math.max(8,n*.5);
    this.ants=[createAnt(0,'queen',this.world.nest,seed,60)];this.brood=[];this.events=[];this.nextID=n+1;
    this.foodDelivered=0;this.waterDelivered=0;this.births=0;this.deaths=0;this.eggsLaid=0;this.broodLost=0;this.recruitments=0;this.lastEgg=0;this.lastPlan=0;this.lastDecay=0;this.lastDemand=-10;this.demand=null;
    this.occupancy=new Map();this.reserved=new Set();
    const open=[...this.world.excavated].map(cell).filter(c=>c[1]>=9);
    for(let id=1;id<=n;id++){const c=id<=3?[(id-2)*3,0]:open[this.rng.int(0,open.length-1)];this.ants.push(createAnt(id,'worker',c,seed,1+this.rng.int(0,17)));}
    for(const fraction of [.38,.78,.99])this.brood.push({id:this.nextID++,age:BROOD_DURATION*fraction,cell:[-5+this.brood.length%3-1,10],nutrition:1,vitality:1,lastCare:0});
    this.record('A small colony begins its life in the clearing.');
  }
  get day(){return Math.floor(this.time/DAY)+1;}
  get alive(){return this.ants.some(a=>a.caste==='queen');}
  get nursery(){
    const rooms=this.world.rooms.filter(r=>r.kind==='nursery'&&this.world.walkable(r.center));
    rooms.sort((a,b)=>{
      const score=r=>Math.abs(this.world.conditions(r.center).humidity-.62)+this.brood.filter(b=>distance(b.cell,r.center)<4).length*.012;
      return score(a)-score(b);
    });return rooms[0]?.center??[-5,10];
  }
  setSettings(changes){this.settings=settingsFrom({...this.settings,...changes});}
  record(text){this.events.unshift({time:this.time,text});this.events=this.events.slice(0,6);}
  updateDemand(){
    const count=this.ants.length,nurses=this.ants.filter(a=>a.task==='nursing').length,diggers=this.ants.filter(a=>['toDig','digging','haulingSoil'].includes(a.task)).length;
    const larvae=this.brood.filter(b=>broodStage(b)==='larva').length;
    const foodTarget=count*.9+larvae*1.2,waterTarget=count*.6+this.brood.length*.25,desiredSpace=40+count*2.4+this.brood.length*.8;
    this.demand={forage:(this.food>foodTarget*1.6?.015:.16)+clamp((foodTarget-this.food)/Math.max(1,foodTarget))*.85+clamp((larvae*.6-this.protein)/Math.max(1,larvae*.6))*.6,
      water:(this.water>waterTarget*1.6?.01:.10)+clamp((waterTarget-this.water)/Math.max(1,waterTarget))*.9,care:clamp((1+this.brood.length/3-nurses)/Math.max(1,1+this.brood.length/3),.04,1),
      dig:clamp((desiredSpace-this.world.excavated.size)/Math.max(12,desiredSpace))*(1/(1+diggers*.35)),desiredSpace};
    this.lastDemand=this.time;
  }
  step(dt=.1){
    if(!Number.isFinite(dt)||dt<=0||dt>1)return;
    this.time+=dt;
    if(this.time-this.lastDemand>=1||!this.demand)this.updateDemand();
    if(this.time-this.lastDecay>=2){
      const elapsed=this.time-this.lastDecay,factor=Math.exp(-Math.LN2*elapsed/45);this.world.pheromones.clear();
      for(const kind of ['food','water'])for(const [id,value] of this.world.trails[kind]){const next=value*factor;if(next<.025)this.world.trails[kind].delete(id);else{this.world.trails[kind].set(id,next);this.world.pheromones.set(id,Math.max(next,this.world.pheromones.get(id)??0));}}
      this.lastDecay=this.time;
    }
    if(this.time-this.lastPlan>12){
      if(!this.world.construction.length && this.world.excavated.size<this.demand.desiredSpace)this.world.planRoom(this.rng,this.brood.length>this.ants.length*.3?'nursery':'storage');
      // Abandon unreachable construction instead of retrying a blocked dig forever.
      if(this.world.construction.length && !this.world.frontier().length){this.world.construction=[];this.world.frontierVersion=-1;}
      this.lastPlan=this.time;
    }
    this.occupancy=new Map();this.reserved=new Set();
    for(const a of this.ants){const id=key(a.cell);if(!this.occupancy.has(id))this.occupancy.set(id,[]);this.occupancy.get(id).push(a);if(a.target&&['toDig','digging'].includes(a.task))this.reserved.add(key(a.target));}
    for(const a of this.ants)this.updateAnt(a,dt);
    for(const a of this.ants)if(!this.world.walkable(a.cell)){a.cell=[a.cell[0],this.world.surface(a.cell[0])-1];a.pos=[...a.cell];a.route=[];}
    const lost=this.ants.filter(a=>a.health<=0);for(const a of lost)if(a.task==='haulingSoil')this.world.soilAbandoned+=a.carried;
    this.deaths+=lost.length;if(lost.some(a=>a.caste==='queen'))this.record('The queen has died. A new colony can begin when you are ready.');
    this.ants=this.ants.filter(a=>a.health>0);this.updateBrood(dt);
  }
  needsFor(a){
    if(!a.knownNeeds || (distance(a.cell,this.world.nest)<9 && this.time-a.needsAt>6)){a.knownNeeds={...this.demand};a.needsAt=this.time;}
    return a.knownNeeds;
  }
  send(a,target){
    a.target=[...target];const route=this.world.path(a.cell,target);
    if(route){a.route=route;return true;}
    a.route=[];if(!a.carried)a.task='resting';a.busyUntil=this.time+3;return false;
  }
  learn(a,source,kind,confidence=.85){
    const old=a.memories.find(m=>same(m.cell,source)&&m.kind===kind);
    if(old)Object.assign(old,{confidence:Math.max(old.confidence,confidence),lastSeen:this.time,failures:0,avoidUntil:0});
    else a.memories.push({cell:[...source],kind,confidence,lastSeen:this.time,failures:0,avoidUntil:0});
    a.memories.sort((x,y)=>y.confidence-x.confidence||y.lastSeen-x.lastSeen);a.memories=a.memories.slice(0,3);a.memory=[...source];
  }
  encounter(a){
    if(this.time<a.encounterAt)return;a.encounterAt=this.time+3;
    for(const c of [a.cell,...adjacent(a.cell)])for(const other of this.occupancy.get(key(c))??[]){
      if(other.id===a.id || !other.task.startsWith('returning') || !other.memory || distance(a.pos,other.pos)>1.4)continue;
      const kind=other.task==='returningWater'?'water':'food';
      if(!a.memories.some(m=>same(m.cell,other.memory)&&m.kind===kind)){
        this.learn(a,other.memory,kind,.48);this.recruitments++;
        a.decision='An antennal encounter with a returning nestmate provided a resource location.';
      }return;
    }
  }
  updateAnt(a,dt){
    a.age+=dt;const active=a.route.length?1.5:a.task==='digging'?1.8:.65;
    a.energy=clamp(a.energy-dt*active/(DAY*5),.01,1);a.hydration=clamp(a.hydration-dt*active/(DAY*4));
    const inNest=distance(a.cell,this.world.nest)<7;
    if(inNest&&this.food>0&&a.energy<.85){const amount=Math.min(.85-a.energy,dt*.035,this.food/.4);this.food=Math.max(0,this.food-amount*.4);a.energy+=amount;}
    if(inNest&&this.water>0&&a.hydration<.9){const amount=Math.min(.9-a.hydration,dt*.03,this.water/.15);this.water=Math.max(0,this.water-amount*.15);a.hydration+=amount;}
    const lifespan=a.caste==='queen'?a.traits.lifeDays*35:a.traits.lifeDays*(a.caste==='major'?1.4:1),aged=adultDays(a)>lifespan;
    a.health=clamp(a.health+(a.energy<.08||a.hydration<.1?-dt/DAY*.8:aged?-dt/DAY*.4:dt/DAY*.12));
    if(a.caste==='queen'){
      a.task=this.food>.4&&this.water>.2&&a.health>.5?'queen':'queenRest';
      a.decision=a.task==='queen'?'Egg production follows the laying setting, available food, hydration, and nursery capacity.':'Conserving resources until the colony can support more brood.';return;
    }
    if(!this.world.walkable(a.cell)){a.cell=[a.cell[0],this.world.surface(a.cell[0])-1];a.pos=[...a.cell];a.route=[];}
    this.encounter(a);
    if(a.route.length){
      const next=a.route[0];
      if(!this.world.walkable(next)){a.route=[];if(a.target&&this.world.walkable(a.target))a.route=this.world.path(a.cell,a.target)??[];return;}
      const dx=next[0]-a.pos[0],dy=next[1]-a.pos[1],length=Math.hypot(dx,dy),traffic=Math.max(0,(this.occupancy.get(key(next))?.length??0)-1);
      const speed=(a.caste==='major'?2.5:3)*(a.carried?.72:1)*(.7+a.energy*.3)/(1+traffic*.18);
      if(length<=speed*dt){
        a.cell=[...next];a.pos=[...next];a.route.shift();
        if(a.task.startsWith('returning')){
          const kind=a.task==='returningWater'?'water':'food',trail=this.world.trails[kind],strength=(.12+.20*Math.exp(-(this.time-a.sourceAt)/50))*a.carried/2.5;
          trail.set(key(next),Math.min(4,(trail.get(key(next))??0)+strength));this.world.pheromones.set(key(next),Math.max(trail.get(key(next)),this.world.pheromones.get(key(next))??0));
        }
        if(a.task==='exploring'&&this.time>=a.perceptionAt){a.perceptionAt=this.time+.8;this.discover(a);}
      }else{a.pos[0]+=dx/length*speed*dt;a.pos[1]+=dy/length*speed*dt;}return;
    }
    if(this.time<a.busyUntil)return;
    switch(a.task){
      case 'returningFood':case 'returningWater':
        if(distance(a.cell,this.world.nest)>2.5){this.send(a,this.world.nest);break;}
        a.returnKind=a.task==='returningWater'?'water':'food';a.task='sharing';a.busyUntil=this.time+1.5;a.decision='Transferring collected food or water to the colony near the queen.';break;
      case 'sharing':
        if(a.returnKind==='water'){this.water+=a.carried;this.waterDelivered+=a.carried;}else{this.food+=a.carried*.7;this.protein+=a.carried*.3;this.foodDelivered+=a.carried;}
        a.carried=0;a.trips++;a.experience++;a.skills.forage=clamp(a.skills.forage+.025);this.chooseJob(a);break;
      case 'toFood':case 'toWater':{
        const p=this.world.patches.find(p=>same(p.cell,a.cell)&&p.amount>=.5);
        if(p){a.carried=Math.min(2.5,p.amount);p.amount-=a.carried;this.learn(a,p.cell,p.kind);a.sourceAt=this.time;a.task=p.kind==='food'?'returningFood':'returningWater';a.decision='A locally discovered resource is being carried home, reinforcing its own scent signal.';this.send(a,this.world.nest);}
        else{
          for(const m of a.memories)if(same(m.cell,a.cell)){m.failures++;m.confidence*=.45;m.avoidUntil=this.time+90;}
          a.memories=a.memories.filter(m=>m.failures<3);a.decision='The remembered source was depleted. Its reliability was reduced; scouting resumes.';this.explore(a);
        }break;
      }
      case 'toDig':
        if(!a.target||!this.world.solid(a.target)||distance(a.target,a.cell)>1.01){this.chooseJob(a);break;}
        a.task='digging';a.busyUntil=this.time+this.world.digTime(a.target,a.skills.dig);a.decision='Excavating '+MATERIALS[this.world.material(a.target)].name.toLowerCase()+'. Moisture, compaction, and experience affect progress.';break;
      case 'digging':{
        const origin=a.target?this.world.material(a.target):'topsoil';
        if(a.target&&this.world.excavate(a.target)){a.carried=1;a.cargoMaterial=origin;a.task='haulingSoil';a.experience++;a.skills.dig=clamp(a.skills.dig+.02);this.send(a,this.world.depositSite());a.decision='Carrying one excavated pellet to a nearby stable deposition site outside the entrance.';}
        else this.chooseJob(a);break;
      }
      case 'haulingSoil':{
        if(a.cell[1]>0){this.send(a,[0,0]);break;}const site=this.world.depositSite();
        if(Math.abs(a.cell[0]-site[0])>1){this.send(a,site);break;}
        if(this.world.deposit(site,a.cargoMaterial)){a.carried=0;a.cargoMaterial=null;a.trips++;a.cell=[a.cell[0],this.world.surface(a.cell[0])-1];a.pos=[...a.cell];if(this.world.soilDeposited===1)this.record('The first loose-soil mound is forming.');this.chooseJob(a);}break;
      }
      case 'exploring':if(!this.discover(a))this.explore(a);break;
      case 'nursing':{
        const baby=this.brood.find(b=>b.id===a.broodID);
        if(!baby){this.chooseJob(a);break;}
        if(distance(a.cell,baby.cell)>1.5){this.send(a,baby.cell);break;}
        baby.lastCare=this.time;
        if(broodStage(baby)==='larva'&&this.protein>0){const food=Math.min(.3,1-baby.nutrition,this.protein/.12);baby.nutrition+=food;this.protein=Math.max(0,this.protein-food*.12);}
        a.skills.care=clamp(a.skills.care+.01);a.busyUntil=this.time+3;
        a.decision='In contact with brood: feeding larvae and maintaining care. Brood elsewhere receives no automatic nursing benefit.';
        if(this.time-(a.jobSince??0)>20&&this.rng.float()<.1)this.chooseJob(a);else this.assignCare(a);break;
      }
      case 'resting':case 'grooming':this.chooseJob(a);break;
      case 'patrolling':
        if(a.energy<.3||this.needsFor(a).forage>.7)this.chooseJob(a);
        else{const x=this.rng.int(-5,5);this.send(a,[x,this.world.surface(x)-1]);a.busyUntil=this.time+3;}break;
    }
  }
  chooseJob(a){
    a.target=null;a.route=[];
    if(a.carried){a.task='haulingSoil';this.send(a,this.world.depositSite());return;}
    if(a.energy<.28||a.hydration<.25){a.task='resting';a.busyUntil=this.time+10;this.send(a,this.world.nest);a.decision='Low individual energy or hydration takes priority over colony work.';return;}
    const n=this.needsFor(a),age=adultDays(a),t=a.traits;
    if(a.caste==='major'&&n.forage<.72&&n.water<.8){a.task='patrolling';this.send(a,[0,0]);a.decision='A major worker guards the entrance, but may switch to resource work during a shortage.';return;}
    const scores=[
      ['forage',n.forage*(.65+Math.min(age,20)/18)*(1+a.skills.forage*.3)/t.forage],
      ['water',n.water*(.7+Math.min(age,20)/20)/t.water],
      ['care',n.care*(age<7?1.5:.7)*(1+a.skills.care*.3)/t.care],
      ['dig',n.dig*2.5*(1+a.skills.dig*.3)/t.dig]
    ];
    if(n.forage>.9||n.water>.8){scores.find(s=>s[0]==='forage')[1]*=2.2;scores.find(s=>s[0]==='water')[1]*=2.2;scores.find(s=>s[0]==='care')[1]*=.5;}
    if(this.world.construction.length&&n.dig>.02)scores.find(s=>s[0]==='dig')[1]+=.20/(1+(this.ants.filter(b=>['toDig','digging','haulingSoil'].includes(b.task)).length));
    if(!this.brood.length)scores.find(s=>s[0]==='care')[1]=0;
    for(const score of scores)score[1]*=.75+this.rng.float()*.5;
    scores.sort((x,y)=>y[1]-x[1]);
    if(scores[0][1]<.35 && this.rng.float()>t.exploration*.04){
      a.task=this.rng.float()<.3?'grooming':'resting';a.busyUntil=this.time+this.rng.int(8,22);this.send(a,this.world.nest);a.decision='Current work signals are weak. Resting and grooming retain a reserve workforce.';return;
    }
    for(const [job] of scores){
      if(job==='dig'&&this.assignDig(a))return;
      if(job==='care'&&this.assignCare(a))return;
      if(job==='forage'||job==='water'){
        a.foragingKind=job==='water'?'water':'food';a.task='exploring';a.lastJob=job;a.jobSince=this.time;
        a.decision='Responding to '+(job==='water'?'water':'food and protein')+' demand remembered from nest contact, weighted by age, individual threshold, and experience.';
        if(!this.discover(a))this.explore(a);return;
      }
    }
    a.task='resting';a.busyUntil=this.time+8;this.send(a,this.world.nest);
  }
  assignCare(a){
    const targets=[...this.brood].sort((x,y)=>(x.lastCare-y.lastCare)+distance(a.cell,x.cell)*.5-distance(a.cell,y.cell)*.5);
    for(const b of targets){const route=this.world.path(a.cell,b.cell);if(route){if(a.lastJob!=='care')a.jobSince=this.time;a.task='nursing';a.route=route;a.target=[...b.cell];a.broodID=b.id;a.lastJob='care';return true;}}return false;
  }
  assignDig(a){
    const sites=this.world.frontier().filter(c=>!this.reserved.has(key(c))).sort((x,y)=>distance(x,a.cell)-distance(y,a.cell));
    for(const site of sites.slice(0,8))for(const neighbor of adjacent(site).filter(n=>this.world.walkable(n)).sort((x,y)=>distance(x,a.cell)-distance(y,a.cell))){
      const route=this.world.path(a.cell,neighbor);if(route){a.task='toDig';a.route=route;a.target=[...site];a.lastJob='dig';this.reserved.add(key(site));return true;}
    }return false;
  }
  discover(a){
    const kind=a.foragingKind??'food';
    // Only current sensory range exposes a patch's true availability.
    const sensed=a.cell[1]<=0?this.world.patches.filter(p=>p.amount>=.5&&distance(p.cell,a.cell)<=6):[];
    sensed.sort((x,y)=>(distance(x.cell,a.cell)+(x.kind===kind?0:12))-(distance(y.cell,a.cell)+(y.kind===kind?0:12))||x.id-y.id);
    let target=sensed.find(p=>p.kind===kind);
    if(target)this.learn(a,target.cell,target.kind);
    if(!target){
      const memories=a.memories.filter(m=>m.kind===kind&&m.confidence>.2&&(m.avoidUntil??0)<=this.time&&this.time-m.lastSeen<DAY*6).sort((x,y)=>y.confidence-x.confidence);
      if(memories[0])target={cell:memories[0].cell,kind:memories[0].kind};
      else if(sensed[0]){target=sensed[0];this.learn(a,target.cell,target.kind);}
    }
    if(!target)return false;
    a.task=target.kind==='food'?'toFood':'toWater';return this.send(a,target.cell);
  }
  explore(a){
    a.task='exploring';if(a.cell[1]>0){this.send(a,[0,0]);return;}if(this.discover(a))return;
    if(this.rng.float()<.06)a.heading*=-1;
    const kind=a.foragingKind??'food',trail=this.world.trails[kind];
    const choices=this.world.neighbors(a.cell).filter(c=>c[1]<=0).map(c=>{
      const forward=Math.sign(c[0]-a.cell[0])===a.heading?2.8:1,visited=a.recent.includes(key(c))?.25:1;
      return {c,weight:forward*visited*(1+(trail.get(key(c))??0)*5)*(0.8+this.rng.float()*.4)};
    });
    if(!choices.length){a.task='resting';a.busyUntil=this.time+2;return;}
    const total=choices.reduce((sum,v)=>sum+v.weight,0);let pick=this.rng.float()*total,selected=choices[0].c;
    for(const v of choices){pick-=v.weight;if(pick<=0){selected=v.c;break;}}
    a.recent.push(key(a.cell));if(a.recent.length>10)a.recent.shift();a.route=[[...selected]];a.target=[...selected];
  }
  updateBrood(dt){
    for(const b of this.brood){
      const stage=broodStage(b),condition=this.world.conditions(b.cell);
      if(stage==='larva')b.nutrition=clamp(b.nutrition-dt/(DAY*.8));
      const temperature=clamp(1-Math.abs(condition.temperature-25)*.045,.1,1),moisture=clamp(1-Math.abs(condition.humidity-.62)*1.8,0,1);
      const care=this.time-b.lastCare<15?1:.78,feeding=stage==='larva'?clamp((b.nutrition-.08)/.65):1;
      b.age+=dt*this.settings.broodRate*temperature*moisture*care*feeding;
      if((stage==='larva'&&b.nutrition<.05)||moisture<.2)b.vitality=clamp(b.vitality-dt/DAY*.5);
    }
    const bornIDs=new Set();
    for(const b of this.brood.filter(b=>b.age>=BROOD_DURATION&&b.vitality>0))if(this.ants.length<this.settings.populationCap){
      const major=this.ants.length>=35&&this.protein>2&&this.rng.float()<.08;
      const a=createAnt(b.id,major?'major':'worker',b.cell,this.world.seed);a.bornAt=this.time;this.ants.push(a);bornIDs.add(b.id);this.births++;this.record(antName(a)+' emerged as a '+casteLabel(a).toLowerCase()+'.');
    }
    this.broodLost+=this.brood.filter(b=>b.vitality<=0).length;
    this.brood=this.brood.filter(b=>!bornIDs.has(b.id)&&b.vitality>0);
    const workers=this.ants.length-1,interval=this.settings.eggRate>0?DAY/Math.max(1,Math.min(18,workers*.10))/this.settings.eggRate:Infinity;
    const capacity=Math.max(6,Math.min(50,Math.floor(workers*1.4)));
    if(this.alive&&this.food>.8&&this.water>.3&&this.protein>.1&&this.time-this.lastEgg>=interval&&this.brood.length<capacity&&this.ants.length+this.brood.length<this.settings.populationCap){
      const nursery=this.nursery,options=[nursery,...adjacent(nursery)].filter(c=>this.world.walkable(c)),position=options[this.rng.int(0,options.length-1)];
      this.brood.push({id:this.nextID++,age:0,cell:[...position],nutrition:1,vitality:1,lastCare:this.time});this.food-=.4;this.water-=.15;this.protein-=.1;this.lastEgg=this.time;this.eggsLaid++;
    }
  }
  place(kind,x){if(!['food','water'].includes(kind))return;this.world.place(kind,x);this.record(kind==='food'?'Mixed food placed: energy for adults and protein for larvae.':'A water source appeared on the surface.');}
  toJSON(){
    const {occupancy,reserved,...data}=this;return {...data,world:this.world.toJSON(),rng:{state:this.rng.state}};
  }
  static fromJSON(d){
    if(!d||!Number.isFinite(d.time)||d.time<0||!Number.isFinite(d.food)||!Number.isFinite(d.water)||!Array.isArray(d.ants)||d.ants.length>LIMIT)throw Error('Invalid colony save');
    if(new Set(d.ants.map(a=>a.id)).size!==d.ants.length||d.ants.some(a=>!Array.isArray(a.pos)||a.pos.some(n=>!Number.isFinite(n))))throw Error('Invalid ant data');
    const legacy=d.modelVersion!==2,c=new Colony(d.world.seed,d.settings);Object.assign(c,d);
    c.settings=settingsFrom(d.settings);c.world=World.fromJSON(d.world,legacy);c.rng=new Random(d.rng.state);c.modelVersion=2;
    c.ants=d.ants.map(a=>normalizeAnt(a,c.world.seed));c.protein=d.protein??Math.max(5,c.ants.length*.25);
    c.brood=d.brood.map(b=>({...b,age:legacy?b.age/150*BROOD_DURATION:b.age,nutrition:b.nutrition??1,vitality:b.vitality??1,lastCare:b.lastCare??c.time}));
    c.eggsLaid=d.eggsLaid??0;c.broodLost=d.broodLost??0;c.recruitments=d.recruitments??0;c.occupancy=new Map();c.reserved=new Set();
    if(legacy||!c.demand){c.lastDemand=-10;c.updateDemand();}
    if(legacy){
      for(const a of c.ants){if(!['queen','haulingSoil','returningFood','returningWater'].includes(a.task)){a.route=[];a.target=null;a.task=a.caste==='queen'?'queen':'resting';a.busyUntil=c.time;}a.knownNeeds=null;}
    }return c;
  }
}
