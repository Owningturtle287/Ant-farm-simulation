export const LIMIT = 120;
export const key = ([x,y]) => `${x},${y}`;
export const cell = s => s.split(',').map(Number);
export const same = (a,b) => !!a && !!b && a[0]===b[0] && a[1]===b[1];
export const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const adjacent = ([x,y]) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
const names = ['Amber','Clover','Fern','Hazel','Moss','Pip','Rowan','Sage'];
export const antName = ant => ant.caste==='queen' ? 'Queen Aurelia' : `${names[ant.id%8]} ${String(ant.id).padStart(2,'0')}`;
export const taskLabels = {
  queen:'Laying eggs', exploring:'Exploring the clearing', toFood:'Following a food trail', toWater:'Collecting water',
  returningFood:'Bringing food home', returningWater:'Bringing water home', toDig:'Heading to the dig', digging:'Excavating',
  haulingSoil:'Carrying soil', nursing:'Tending brood', resting:'Resting', patrolling:'Guarding the entrance'
};
export function reason(ant) {
  if (['toDig','digging'].includes(ant.task)) return 'The growing colony needs more space. This worker is opening a new passage.';
  if (ant.task==='haulingSoil') return 'Every bit of excavated earth is carried up to the mound.';
  if (ant.task.startsWith('returning')) return 'Bringing a resource back to the colony’s shared stores, leaving a scent trail along the way.';
  if (['toFood','toWater'].includes(ant.task)) return 'Following a nearby resource or a remembered source.';
  if (ant.task==='queen') return 'A fed, hydrated colony can support new eggs.';
  if (ant.task==='nursing') return 'Staying close to the queen and developing brood.';
  if (ant.task==='patrolling') return 'Checking the entrance and nearby ground.';
  if (ant.task==='resting') return 'Recovering energy near the shared stores.';
  return 'Searching for resources using local senses, source memory, and scent signals.';
}
export class Random {
  constructor(seed=287) { this.state=seed>>>0 || 287; }
  next() { let n=this.state; n^=n<<13; n^=n>>>17; n^=n<<5; this.state=n>>>0; return this.state; }
  int(min,max) { return min+this.next()%(max-min+1); }
}
export class World {
  constructor(seed=287) {
    this.seed=seed; this.excavated=new Set(); this.deposits=new Set(); this.heights=new Map();
    this.construction=[]; this.plannedRooms=0; this.revision=0; this.chunkRevisions=new Map();
    this.soilExcavated=0; this.soilDeposited=0; this.soilAbandoned=0; this.pheromones=new Map(); this.nest=[0,11];
    for(let y=1;y<=12;y++) for(let x=-1;x<=1;x++) this.excavated.add(key([x,y]));
    this.carve([0,11],6,3);
    for(let x=-11;x<=11;x++) for(let y=8;y<=9;y++) this.excavated.add(key([x,y]));
    this.carve([-10,10],4,2); this.carve([10,10],4,2);
    this.patches=[{id:0,cell:[-19,0],kind:'food',amount:140},{id:1,cell:[25,0],kind:'food',amount:180},
      {id:2,cell:[13,0],kind:'water',amount:180},{id:3,cell:[-36,0],kind:'water',amount:120}];
    this.planRoom();
  }
  carve([cx,cy],rx,ry) { for(let y=-ry;y<=ry;y++) for(let x=-rx;x<=rx;x++) if(x*x/(rx*rx)+y*y/(ry*ry)<=1.12) this.excavated.add(key([cx+x,cy+y])); }
  solid(c) { return this.deposits.has(key(c)) || (c[1]>=1 && !this.excavated.has(key(c))); }
  surface(x) { return this.heights.get(x) ?? 1; }
  walkable(c) { return !this.solid(c) && (c[1]>0 || c[1]===this.surface(c[0])-1 || adjacent(c).some(n=>this.solid(n))); }
  neighbors(c) {
    const [x,y]=c, candidates=adjacent(c);
    for(const dx of [-1,1]) for(const dy of [-1,1]) if(!this.solid([x+dx,y]) || !this.solid([x,y+dy])) candidates.push([x+dx,y+dy]);
    return candidates.filter(n=>this.walkable(n));
  }
  path(start,goal) {
    if(!this.walkable(start) || !this.walkable(goal)) return null;
    if(same(start,goal)) return [];
    const minX=Math.min(start[0],goal[0],-20)-8, maxX=Math.max(start[0],goal[0],20)+8;
    const minY=Math.min(start[1],goal[1],-6)-3, maxY=Math.max(start[1],goal[1],18)+8;
    const queue=[start], previous=new Map([[key(start),null]]); let head=0;
    while(head<queue.length && head<12000) {
      const current=queue[head++];
      for(const next of this.neighbors(current)) {
        const id=key(next);
        if(previous.has(id) || next[0]<minX || next[0]>maxX || next[1]<minY || next[1]>maxY) continue;
        previous.set(id,current);
        if(same(next,goal)) {
          const route=[next]; let cursor=current;
          while(!same(cursor,start)) { route.push(cursor); cursor=previous.get(key(cursor)); }
          return route.reverse();
        }
        queue.push(next);
      }
    }
    return null;
  }
  planRoom() {
    const depth=20+Math.floor(this.plannedRooms/2)*10, side=this.plannedRooms%2===0?-1:1, plan=[];
    for(let y=12;y<=depth;y++) for(let x=-1;x<=1;x++) plan.push([x,y]);
    for(let x=0;x<=10;x++) for(let dy=0;dy<=1;dy++) plan.push([side*x||0,depth+dy]);
    for(let y=-3;y<=3;y++) for(let x=-5;x<=5;x++) if(x*x/25+y*y/9<=1.1) plan.push([side*10+x,depth+y]);
    const known=new Set(this.construction.map(key));
    for(const c of plan) if(this.solid(c) && !known.has(key(c))) { this.construction.push(c); known.add(key(c)); }
    this.plannedRooms++;
  }
  changed(c) { this.revision++; for(const n of [c,...adjacent(c)]) this.chunkRevisions.set(key([Math.floor(n[0]/16),Math.floor(n[1]/16)]),this.revision); }
  excavate(c) {
    if(c[1]<=0 || !this.solid(c) || !adjacent(c).some(n=>this.walkable(n))) return false;
    this.excavated.add(key(c)); this.construction=this.construction.filter(n=>!same(n,c)); this.soilExcavated++; this.changed(c); return true;
  }
  depositSite() {
    let best=null, score=Infinity;
    for(let x=-12;x<=12;x++) if(Math.abs(x)>=3) {
      const y=this.surface(x)-1, candidate=-y+Math.abs(x)*0.24;
      if(candidate<score) { best=[x,y]; score=candidate; }
    }
    return best;
  }
  deposit(c) {
    if(c[1]!==this.surface(c[0])-1 || Math.abs(c[0])<3) return false;
    this.deposits.add(key(c)); this.heights.set(c[0],c[1]); this.soilDeposited++; this.changed(c);
    for(const patch of this.patches) if(patch.cell[0]===c[0]) patch.cell[1]=c[1]-1;
    return true;
  }
  place(kind,x) {
    x=Math.max(-2000,Math.min(2000,Math.round(x)))||0;
    const existing=this.patches.find(p=>p.cell[0]===x && p.kind===kind);
    if(existing) existing.amount+=80;
    else this.patches.push({id:Math.max(...this.patches.map(p=>p.id),0)+1,cell:[x,this.surface(x)-1],kind,amount:80});
  }
  toJSON() {
    return {seed:this.seed,excavated:[...this.excavated],deposits:[...this.deposits],construction:this.construction,plannedRooms:this.plannedRooms,
      revision:this.revision,chunkRevisions:[...this.chunkRevisions],soilExcavated:this.soilExcavated,soilDeposited:this.soilDeposited,
      soilAbandoned:this.soilAbandoned,pheromones:[...this.pheromones],patches:this.patches};
  }
  static fromJSON(data) {
    const w=new World(data.seed); Object.assign(w,data);
    for(const field of ['excavated','deposits']) w[field]=new Set(data[field]);
    for(const field of ['chunkRevisions','pheromones']) w[field]=new Map(data[field]);
    w.heights=new Map(); for(const id of w.deposits) { const [x,y]=cell(id); w.heights.set(x,Math.min(w.heights.get(x)??1,y)); }
    return w;
  }
}
function makeAnt(id,caste,c) {
  return {id,caste,cell:[...c],pos:[...c],route:[],target:null,memory:null,task:caste==='queen'?'queen':'resting',energy:1,health:1,age:0,experience:0,carried:0,busyUntil:0,trips:0,bornAt:0};
}
export class Colony {
  constructor(seed=287) {
    this.world=new World(seed); this.rng=new Random(seed); this.time=0; this.food=65; this.water=55;
    this.ants=[makeAnt(0,'queen',this.world.nest)]; this.brood=[]; this.events=[]; this.nextID=29;
    this.foodDelivered=0; this.waterDelivered=0; this.births=0; this.deaths=0; this.lastEgg=0; this.lastPlan=0; this.lastDecay=0;
    for(let id=1;id<=28;id++) this.ants.push(makeAnt(id,id>26?'soldier':'worker',id<=12?[(id-6)*2,0]:[id%9-4,10]));
    for(let i=0;i<6;i++) this.brood.push({id:this.nextID++,age:i*22,cell:[-10+i%4,10+Math.floor(i/4)]});
    this.record('A new colony takes root.');
  }
  get day() { return Math.floor(this.time/600)+1; }
  get alive() { return this.ants.some(a=>a.caste==='queen'); }
  record(text) { this.events.unshift({time:this.time,text}); this.events=this.events.slice(0,6); }
  step(dt=.1) {
    if(!Number.isFinite(dt) || dt<=0 || dt>1) return;
    this.time+=dt; this.food=Math.max(0,this.food-this.ants.length*dt*.0035); this.water=Math.max(0,this.water-this.ants.length*dt*.0022);
    if(this.time-this.lastDecay>=2) {
      for(const [id,value] of this.world.pheromones) { const next=value*.91; if(next<.035) this.world.pheromones.delete(id); else this.world.pheromones.set(id,next); }
      this.lastDecay=this.time;
    }
    if(this.time-this.lastPlan>12) {
      if(this.world.excavated.size+this.world.construction.length<180+this.ants.length*5+this.brood.length*3) this.world.planRoom();
      this.lastPlan=this.time;
    }
    for(const ant of this.ants) this.updateAnt(ant,dt);
    for(const ant of this.ants) if(!this.world.walkable(ant.cell)) { ant.cell=[ant.cell[0],this.world.surface(ant.cell[0])-1]; ant.pos=[...ant.cell]; ant.route=[]; }
    const lost=this.ants.filter(a=>a.health<=0);
    for(const ant of lost) if(ant.task==='haulingSoil') this.world.soilAbandoned+=ant.carried;
    this.deaths+=lost.length;
    if(lost.some(a=>a.caste==='queen')) this.record('The queen has died. A new colony can begin when you’re ready.');
    this.ants=this.ants.filter(a=>a.health>0);
    this.updateBrood(dt);
  }
  send(ant,target) {
    ant.target=[...target]; const route=this.world.path(ant.cell,target);
    if(route) ant.route=route;
    else { ant.route=[]; if(!ant.carried) ant.task='resting'; ant.busyUntil=this.time+2; }
  }
  updateAnt(a,dt) {
    a.age+=dt; a.energy=Math.max(.03,a.energy-dt*.0008);
    a.health=this.food<.1 || this.water<.1 ? Math.max(0,a.health-dt*.0015) : Math.min(1,a.health+dt*.0008);
    if(a.caste==='queen') { if(this.food>0 && this.water>0) a.energy=Math.min(1,a.energy+dt*.002); return; }
    if(!this.world.walkable(a.cell)) { a.cell=[a.cell[0],this.world.surface(a.cell[0])-1]; a.pos=[...a.cell]; a.route=[]; }
    if(a.route.length) {
      const next=a.route[0];
      if(!this.world.walkable(next)) { a.route=[]; if(a.target) a.route=this.world.path(a.cell,a.target)??[]; return; }
      const dx=next[0]-a.pos[0], dy=next[1]-a.pos[1], d=Math.hypot(dx,dy);
      const travel=(a.caste==='soldier'?2.7:3)*(a.carried ? .76 : 1)*(.8+a.energy*.2)*dt;
      if(d<=travel) {
        a.cell=[...next]; a.pos=[...next]; a.route.shift();
        if(a.task.startsWith('returning')) this.world.pheromones.set(key(next),Math.min(4,(this.world.pheromones.get(key(next))??0)+.25));
      } else { a.pos[0]+=dx/d*travel; a.pos[1]+=dy/d*travel; }
      return;
    }
    if(this.time<a.busyUntil) return;
    switch(a.task) {
      case 'returningFood': case 'returningWater':
        if(distance(a.cell,this.world.nest)>=3) { this.send(a,this.world.nest); break; }
        if(a.task==='returningFood') { this.food+=a.carried; this.foodDelivered+=a.carried; }
        else { this.water+=a.carried; this.waterDelivered+=a.carried; }
        a.carried=0; a.trips++; a.experience++; a.energy=Math.min(1,a.energy+.12); this.chooseJob(a); break;
      case 'toFood': case 'toWater': {
        const patch=this.world.patches.find(p=>same(p.cell,a.cell) && p.amount>=.5);
        if(patch) { a.carried=Math.min(2.5,patch.amount); patch.amount-=a.carried; a.memory=[...a.cell]; a.task=patch.kind==='food'?'returningFood':'returningWater'; this.send(a,this.world.nest); }
        else { a.memory=null; this.explore(a); }
        break;
      }
      case 'toDig':
        if(!a.target || !this.world.solid(a.target) || distance(a.target,a.cell)>1.01) { this.chooseJob(a); break; }
        a.task='digging'; a.busyUntil=this.time+1.8+Math.max(0,a.target[1]-25)*.025; break;
      case 'digging':
        if(a.target && this.world.excavate(a.target)) {
          a.carried=1; a.task='haulingSoil'; a.experience++; this.send(a,this.world.depositSite());
        } else this.chooseJob(a);
        break;
      case 'haulingSoil': {
        if(a.cell[1]>0) { this.send(a,[0,0]); break; }
        const site=this.world.depositSite();
        if(Math.abs(a.cell[0]-site[0])>1) { this.send(a,site); break; }
        if(this.world.deposit(site)) { a.carried=0; a.trips++; a.cell=[a.cell[0],this.world.surface(a.cell[0])-1]; a.pos=[...a.cell]; this.chooseJob(a); }
        break;
      }
      case 'exploring': if(!this.discover(a)) this.explore(a); break;
      case 'resting': if(distance(a.cell,this.world.nest)<7) a.energy=Math.min(1,a.energy+.35); this.chooseJob(a); break;
      case 'nursing':
        a.energy=Math.min(1,a.energy+.03); a.busyUntil=this.time+3;
        if(this.rng.int(0,4)===0) this.chooseJob(a); else this.send(a,[this.rng.int(-12,-8),this.rng.int(9,10)]);
        break;
      case 'patrolling':
        if(a.energy<.30) this.chooseJob(a); else { this.send(a,[this.rng.int(-10,10),0]); a.busyUntil=this.time+2; }
        break;
    }
  }
  chooseJob(a) {
    a.target=null; a.route=[];
    if(a.energy<.30) { a.task='resting'; a.busyUntil=this.time+8; this.send(a,this.world.nest); return; }
    if(a.caste==='soldier') { a.task='patrolling'; this.send(a,[0,0]); return; }
    const specialization=a.id%7;
    if(this.food<22 || this.water<15 || specialization<=2) { a.task='exploring'; if(!this.discover(a)) this.explore(a); }
    else if(specialization<=5 && this.assignDig(a)) return;
    else { a.task='nursing'; this.send(a,[-10,10]); a.busyUntil=this.time+2; }
  }
  assignDig(a) {
    const reserved=new Set(this.ants.filter(other=>other.id!==a.id && ['toDig','digging'].includes(other.task) && other.target).map(other=>key(other.target)));
    for(const site of this.world.construction.slice(0,120)) if(this.world.solid(site) && !reserved.has(key(site))) {
      const neighbors=adjacent(site).filter(n=>this.world.walkable(n)).sort((x,y)=>distance(x,a.cell)-distance(y,a.cell));
      for(const neighbor of neighbors) { const route=this.world.path(a.cell,neighbor); if(route) { a.task='toDig'; a.route=route; a.target=[...site]; return true; } }
    }
    return false;
  }
  discover(a) {
    const preferred=this.water<Math.min(25,this.food*.65)?'water':'food';
    const sensed=this.world.patches.filter(p=>p.amount>=.5 && (distance(p.cell,a.cell)<=7 || same(p.cell,a.memory)));
    sensed.sort((x,y)=>(distance(x.cell,a.cell)+(x.kind===preferred?0:20))-(distance(y.cell,a.cell)+(y.kind===preferred?0:20)) || x.id-y.id);
    if(!sensed.length) return false;
    const patch=sensed[0]; a.task=patch.kind==='food'?'toFood':'toWater'; this.send(a,patch.cell); return a.route.length>0 || same(a.cell,patch.cell);
  }
  explore(a) {
    a.task='exploring';
    if(a.cell[1]>0) { this.send(a,[0,0]); return; }
    if(this.discover(a)) return;
    const nearby=this.world.neighbors(a.cell).filter(n=>n[1]<=0).sort((x,y)=>(this.world.pheromones.get(key(y))??0)-(this.world.pheromones.get(key(x))??0));
    if(nearby.length && (this.world.pheromones.get(key(nearby[0]))??0)>.1 && this.rng.int(0,3)!==0) { a.route=[nearby[0]]; a.busyUntil=this.time+.1; }
    else { const range=38+Math.min(120,Math.floor(this.time/90)*4), x=this.rng.int(4,range)*(a.id%2===0?1:-1); this.send(a,[x,this.world.surface(x)-1]); }
  }
  updateBrood(dt) {
    const nurses=this.ants.filter(a=>a.task==='nursing').length, healthy=this.food>1 && this.water>1;
    if(healthy) for(const b of this.brood) b.age+=dt*(nurses?1:.25);
    for(const b of this.brood.filter(b=>b.age>=150)) if(this.ants.length<LIMIT) {
      const ant=makeAnt(b.id,'worker',b.cell); ant.bornAt=this.time; this.ants.push(ant); this.births++; this.record(`${antName(ant)} emerged. The colony is growing.`);
    }
    const ids=new Set(this.ants.map(a=>a.id)); this.brood=this.brood.filter(b=>!ids.has(b.id));
    if(this.alive && healthy && this.time-this.lastEgg>=24 && this.brood.length<18 && this.ants.length+this.brood.length<LIMIT) {
      this.brood.push({id:this.nextID,age:0,cell:[-11+this.nextID%4,9+this.nextID%2]}); this.nextID++; this.food-=1.8; this.water-=.8; this.lastEgg=this.time;
    }
  }
  place(kind,x) { if(!['food','water'].includes(kind)) return; this.world.place(kind,x); this.record(kind==='food'?'Fresh food placed on the surface.':'A water source appeared on the surface.'); }
  toJSON() { return {...this,world:this.world.toJSON(),rng:{state:this.rng.state}}; }
  static fromJSON(data) {
    if(!data || !Number.isFinite(data.time) || data.time<0 || !Number.isFinite(data.food) || !Number.isFinite(data.water) || !Array.isArray(data.ants) || data.ants.length>LIMIT) throw Error('Invalid colony save');
    if(new Set(data.ants.map(a=>a.id)).size!==data.ants.length || data.ants.some(a=>!Array.isArray(a.pos) || a.pos.some(n=>!Number.isFinite(n)))) throw Error('Invalid ant data');
    const colony=new Colony(data.world.seed); Object.assign(colony,data);
    colony.world=World.fromJSON(data.world); colony.rng=new Random(data.rng.state); return colony;
  }
}
