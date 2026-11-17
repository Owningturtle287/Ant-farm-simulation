import {foodSupport,beginTraffic,refreshItems,settleAdults,canOccupy,terrainFree,nearestStance,routeAroundItems,idlePlace,spaceForItem,broodRadius,unjam,reindexAdult} from './traffic.mjs';
import {initGroundwater,tableLevel,flooded,tickGroundwater,groundwaterJSON} from './hydrology.mjs';
import {initializeSupplies,setReserve,updateSupplyTotals,cropCapacity as socialCapacity,waterCapacity,foodFill,consumeSelf,fillFromCargo,shareCrops,takeCache,liftCache,nearestCache,cacheSlotFor,storeCargo,consumeNutrient,bedAvailable,bedOccupy,bedRelease,freeBedCount,initCrop,accountIntake,accountDeath,rebuildReservations,feedBroodCargo} from './provisions.mjs';
import {findBed,holdCell,releaseCell,freeCell,releaseSlot,initItemSpace,restorePieces} from './item-space.mjs';
import {DAY,BROOD_DURATION,LIMIT,DEFAULT_SETTINGS,Random,clamp,settingsFrom,createAnt,normalizeAnt,adultDays,broodStage} from './biology.mjs';
import {MATERIALS,materialAt,conditionsAt,digDuration,hashCell} from './materials.mjs';
import {terrainHeight,initHabitat,ensureHabitat,tickHabitat,harvest,restoreHabitat} from './ecology.mjs';
import {NUTRITION,addStock,removeStock} from './resources.mjs';
import {SPECIES,initializeBrain,lifespanFor,colonyOdor,contact,cropCapacity,developmentalRate,taskScores,rememberTask} from './fire-ant.mjs';
import {founderNest,planPeripheralExit,planMoundPassage,planMoistureShaft} from './architecture.mjs';
import {moveAnt,updateMotion,wrapAngle,recoverBody} from './locomotion.mjs';
import {chamberCells,curvedPassage} from './geometry.mjs';
import {initSignals,emit,senseSignal,decaySignals,signalsJSON,sampleField,resourceOdor} from './signals.mjs';
export {DAY,BROOD_DURATION,LIMIT,DEFAULT_SETTINGS,Random,createAnt,adultDays,broodStage};
export const key=([x,y])=>x+','+y;
export const cell=s=>s.split(',').map(Number);
export const same=(a,b)=>!!a && !!b && a[0]===b[0] && a[1]===b[1];
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const adjacent=([x,y])=>[[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
const names=['Amber','Clover','Fern','Hazel','Moss','Pip','Rowan','Sage'];
export const antName=a=>a.caste==='queen'?'Queen Aurelia':names[a.id%8]+' '+String(a.id).padStart(2,'0');
export const casteLabel=a=>a.caste==='queen'?'Queen':a.bodySize>.78?'Large worker':a.bodySize>.43?'Medium worker':'Small worker';
export const taskLabels={queen:'Preparing eggs',queenRest:'Resting between eggs',exploring:'Scouting the clearing',harvesting:'Collecting a finite portion',toFood:'Following a food source',toWater:'Collecting water',
  returningFood:'Bringing food home',returningWater:'Bringing water home',sharing:'Sharing food and water',toDig:'Heading to the dig',digging:'Excavating soil',
  storeFood:'Placing excess food in a cache',toCache:'Retrieving a stored food parcel',toQueenStore:'Collecting food for the queen',feedingQueen:'Feeding and hydrating the queen',haulingSoil:'Carrying an earth pellet',laying:'Laying an egg',queenMoving:'Choosing a sheltered nest position',toBrood:'Collecting brood',carryingBrood:'Moving brood to the nursery',nursing:'Feeding and tending brood',refueling:'Restoring energy and hydration',resting:'Resting in the nest',grooming:'Grooming',reserve:'Waiting for recruitment',investigating:'Responding to alarm',patrolling:'Reassessing the surroundings'};
export function reason(a){return a.decision || 'Responding to local conditions and colony needs.';}

export class World{
  constructor(seed=287){
    this.seed=seed;this.geometryVersion=2;this.terrainVersion=1;this.terrainCache=new Map();this.climateCache=new Map();this.climateEpoch=null;this.excavated=new Set();this.deposits=new Set();this.heights=new Map();this.spoilOrigins=new Map();
    this.construction=[];this.plannedRooms=0;this.revision=0;this.chunkRevisions=new Map();this.soilExcavated=0;this.soilDeposited=0;this.soilAbandoned=0;
    this.pheromones=new Map();this.trails={food:new Map(),water:new Map()};this.nest=[0,11];this.pathCache=new Map();this.neighborCache=new Map();
    this.runtime={pathCalls:0,pathMs:0,recoveries:0};this.frontierVersion=-1;this.frontierCache=[];
    founderNest(this);initSignals(this);
    initHabitat(this);initGroundwater(this);initItemSpace(this);restorePieces(this);this.rebuildNavigation();
  }
  carve(center,rx,ry){for(const c of chamberCells(center,rx,ry,this.seed))this.excavated.add(key(c));this.excavated.add(key(center));this.itemCellsRevision=-1;if(this.navigation)this.changed(center);}
  rebuildNavigation(){const bounds={minX:-12,maxX:12,maxY:15};for(const cells of [this.excavated,this.moundTunnels])for(const id of cells){const [x,y]=cell(id);bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.maxY=Math.max(bounds.maxY,y);}this.navigation=bounds;}
  baseSurface(x){if(this.terrainVersion===0)return 1;let height=this.terrainCache.get(x);if(height==null){height=terrainHeight(x,this.seed);if(this.terrainCache.size>5000)this.terrainCache.clear();this.terrainCache.set(x,height);}return height;}
  coveredMound(c){return !this.solid(c)&&c[1]<this.baseSurface(c[0])&&this.surface(c[0])<c[1];}
  onSurface(c){return c[1]<this.baseSurface(c[0])&&!this.coveredMound(c);}
  inForagingZone(c){return c[1]<this.baseSurface(c[0]);}
  entrance(from=this.nest){const exits=this.entrances.filter(e=>e.state==='open');return [...(exits.sort((a,b)=>distance(from,a.mouth)-distance(from,b.mouth))[0]?.mouth??[0,0])];}
  foragingExit(from=this.nest){
    const mouth=this.entrance(from),id=key(mouth);if(this.accessRevision!==this.revision){this.accessRevision=this.revision;this.accessCache=new Map();}
    if(this.accessCache.has(id))return this.accessCache.get(id);
    const queue=[mouth],seen=new Set([id]);let head=0;
    while(head<queue.length&&head<6000){const c=queue[head++],neighbors=this.neighbors(c);if(this.onSurface(c)&&neighbors.some(n=>this.onSurface(n))){this.accessCache.set(id,c);return [...c];}
      for(const n of neighbors)if(!seen.has(key(n))){seen.add(key(n));queue.push(n);}
    }return null;
  }
  solid(c){return this.deposits.has(key(c)) || (c[1]>=this.baseSurface(c[0]) && !this.excavated.has(key(c)));}
  surface(x){return Math.min(this.heights.get(x)??Infinity,this.baseSurface(x));}
  waterTable(x){return tableLevel(this,x);}
  walkable(c){return !this.solid(c) && (c[1]<this.baseSurface(c[0])+12||!flooded(this,c)) && (!this.onSurface(c) || c[1]===this.surface(c[0])-1 || adjacent(c).some(n=>this.solid(n))||foodSupport(this,c));}
  escapeCell(c){return [...this.neighbors(c)].sort((a,b)=>distance(a,c)-distance(b,c))[0]??[c[0],this.surface(c[0])-1];}
  material(c){return materialAt(this,c);}
  conditions(c){if(this.climateTime!==this.environmentAt||this.climateRevision!==this.revision){this.climateCache.clear();this.climateTime=this.environmentAt;this.climateRevision=this.revision;}const id=key(c);if(!this.climateCache.has(id))this.climateCache.set(id,conditionsAt(this,c));return this.climateCache.get(id);}
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
      const bounds=this.navigation??{minX:-12,maxX:12,maxY:15};
      let roof=-14;for(const y of this.heights.values())roof=Math.min(roof,y);
      const minX=Math.min(start[0],goal[0],bounds.minX)-8,maxX=Math.max(start[0],goal[0],bounds.maxX)+8,minY=Math.min(start[1],goal[1],roof)-3,maxY=Math.max(start[1],goal[1],bounds.maxY)+8;
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
  planRoom(rng=new Random(this.seed+this.plannedRooms),kind='nursery',origin=null){
    let anchors=this.rooms.filter(r=>this.excavated.has(key(r.center)));if(origin){anchors.sort((a,b)=>distance(origin,a.center)-distance(origin,b.center));anchors=anchors.slice(0,2);}let best=null;
    for(let i=0;i<12;i++){
      const anchor=anchors[rng.int(0,anchors.length-1)],side=rng.int(0,1)?1:-1;
      const center=[anchor.center[0]+side*rng.int(5,9),Math.max(7,anchor.center[1]+rng.int(-1,6))],rx=rng.int(2,4),ry=rng.int(1,2);
      const condition=this.conditions(center),ideal=kind==='nursery'?.62:.48;
      let score=Math.abs(condition.humidity-ideal)*14+Math.abs(center[0])*.015;
      for(const r of this.rooms)score+=Math.max(0,rx+r.rx+2-distance(center,r.center))*2;
      if(condition.humidity>.9)score+=100;
      if(center[1]-ry<this.baseSurface(center[0])+3)continue;
      const chamber=chamberCells(center,rx,ry,this.seed+this.plannedRooms);if(chamber.some(c=>c[1]<this.baseSurface(c[0])+3))continue;
      const plan=[...curvedPassage(anchor.center,center,rng),...chamber];
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
    if(!this.navigation)this.rebuildNavigation();this.navigation.minX=Math.min(this.navigation.minX,c[0]);this.navigation.maxX=Math.max(this.navigation.maxX,c[0]);this.navigation.maxY=Math.max(this.navigation.maxY,c[1]);
    this.revision++;this.pathCache.clear();this.neighborCache.clear();this.frontierVersion=-1;if(this.traffic){this.traffic.routes.clear();this.traffic.bodyNavigation=null;}
    for(const n of [c,...adjacent(c)])this.chunkRevisions.set(key([Math.floor(n[0]/16),Math.floor(n[1]/16)]),this.revision);
  }
  excavate(c){
    if(!this.solid(c)||!adjacent(c).some(n=>this.walkable(n)))return false;
    if(this.deposits.has(key(c))){this.deposits.delete(key(c));this.spoilOrigins.delete(key(c));this.moundTunnels.add(key(c));this.soilDeposited--;this.soilRehandled++;this.heights.delete(c[0]);for(const id of this.deposits){const [x,y]=cell(id);if(x===c[0]&&y<this.baseSurface(x))this.heights.set(x,Math.min(this.heights.get(x)??Infinity,y));}this.construction=this.construction.filter(n=>!same(n,c));this.changed(c);return true;}
    if(this.onSurface(c))return false;this.excavated.add(key(c));this.construction=this.construction.filter(n=>!same(n,c));this.soilExcavated++;this.changed(c);return true;
  }
  stableDeposit([x,y]){
    if(y<Math.max(this.surface(x-1),this.surface(x+1))-1)return false;
    const rise=this.baseSurface(x)-y;for(let d=1;d<=3;d++)if(rise>Math.min(this.baseSurface(x-d)-this.surface(x-d),this.baseSurface(x+d)-this.surface(x+d))+1)return false;return true;
  }
  depositSite(from=this.entrance(),ant=null){
    const radius=18+Math.ceil(Math.sqrt(this.soilDeposited+1)*2),bias=(hashCell([0,9],this.seed)%100)/100-.5;
    for(const margin of [0,16]){
      const candidates=[];
      for(let x=-radius-margin;x<=radius+margin;x++)if(!this.entrances.some(e=>e.mouth[0]===x)){
        const y=this.surface(x)-1,c=[x,y];if(ant&&!spaceForItem(this,c,.45))continue;if(this.moundTunnels.has(key(c))||!this.onSurface(c)||!this.walkable(c))continue;
        if(!this.stableDeposit(c))continue;
        const thickness=this.baseSurface(x)-y,score=thickness*.65+Math.abs(x)*.18+Math.sign(x)*bias*1.8+(hashCell([x,0],this.seed)%100)/180+distance(from,c)*.015;
        candidates.push({c,score});
      }
      candidates.sort((a,b)=>a.score-b.score);
      for(const candidate of candidates)if(this.path(from,candidate.c))return candidate.c;
    }return null;
  }

  deposit(c,origin='mixed'){
    if(c[1]!==this.surface(c[0])-1||!this.stableDeposit(c)||this.entrances.some(e=>e.mouth[0]===c[0])||this.moundTunnels.has(key(c)))return false;
    this.deposits.add(key(c));this.heights.set(c[0],c[1]);this.spoilOrigins.set(key(c),origin??'mixed');this.soilDeposited++;this.changed(c);
    for(const p of this.patches)if(p.cell[0]===c[0]){p.cell[1]=c[1]-1;if(p.kind==='food'){removeStock(this,p,p.amount,'buried');if(p.origin==='grass'){p.stage='dead';p.growth=0;}}if(p.origin==='puddle')removeStock(this,p,p.amount,'buried');}return true;
  }
  place(kind,x,quantity=null){
    x=Math.max(-2000,Math.min(2000,Math.round(x)))||0;
    if(kind==='food'){const candidates=[0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8,-8].map(offset=>x+offset),land=candidates.find(px=>this.surface(px)===this.baseSurface(px)&&this.solid([px,this.baseSurface(px)]));if(land==null)return;x=land;}
    const make=(origin,amount,px)=>{
      const p={id:this.nextPatchID++,kind,origin,cell:[px,this.surface(px)-1],amount:0,capacity:amount,renewable:false,regrowAt:1e12,decayAt:this.environmentAt+DAY*5,nutrition:NUTRITION[origin]??null};this.patches.push(p);addStock(this,p,amount);
    };
    if(kind==='food'){make('prey',24,x);make('nectar',16,x+2);}else make('placed',quantity??40,x);
  }

  repairMound(){
    if(this.geometryVersion>=2)return false;this.geometryVersion=2;
    const plugs=[...this.excavated].map(cell).filter(c=>{const depth=c[1]-this.baseSurface(c[0]);return depth>=0&&depth<3&&this.entrances.some(e=>Math.abs(c[0]-e.mouth[0])<=10)&&!this.entrances.some(e=>c[0]===e.mouth[0]);}).sort((a,b)=>(a[1]-this.baseSurface(a[0]))-(b[1]-this.baseSurface(b[0])));
    const wideMouth=plugs.some(c=>c[1]===this.baseSurface(c[0]));
    const malformed=wideMouth||[...this.heights].some(([x,y])=>y<Math.max(this.surface(x-1),this.surface(x+1))-2)||this.moundTunnels.size>this.deposits.size*.3;
    if(!malformed)return false;
    for(const id of this.deposits)this.changed(cell(id));for(const id of this.moundTunnels)this.changed(cell(id));
    const soil=[...this.deposits].map(id=>this.spoilOrigins.get(id)??'mixed');this.deposits.clear();this.heights.clear();this.spoilOrigins.clear();this.moundTunnels.clear();this.soilDeposited=0;this.construction=this.construction.filter(c=>c[1]>=this.baseSurface(c[0]));this.rooms=this.rooms.filter(r=>r.kind!=='mound');
    this.pathCache.clear();this.neighborCache.clear();
    // Same pellets, broader stable pile. No soil, ants, stores or underground excavation are removed.
    for(const c of plugs){if(!soil.length)break;const origin=soil.pop();this.deposits.add(key(c));this.spoilOrigins.set(key(c),origin);this.soilDeposited++;this.changed(c);}
    for(const origin of soil){const site=this.depositSite();if(!site)throw Error('Unable to settle saved mound');this.deposit(site,origin);}
    this.repairedMound=true;return true;
  }
  toJSON(){return {seed:this.seed,groundwater:groundwaterJSON(this),waterDig:this.waterDig,geometryVersion:this.geometryVersion,entrances:this.entrances,moundTunnels:[...this.moundTunnels],soilRehandled:this.soilRehandled,lastAccessPlan:this.lastAccessPlan,lastMoundPlan:this.lastMoundPlan,resourceLedger:this.resourceLedger,nextPrey:[...this.nextPrey],moistureSources:this.moistureSources,signals:signalsJSON(this),terrainVersion:this.terrainVersion,habitatRegions:[...this.habitatRegions],weather:this.weather,ecologyRng:{state:this.ecologyRng.state},environmentAt:this.environmentAt,nextPatchID:this.nextPatchID,excavated:[...this.excavated],deposits:[...this.deposits],spoilOrigins:[...this.spoilOrigins],construction:this.construction,rooms:this.rooms,plannedRooms:this.plannedRooms,
    revision:this.revision,chunkRevisions:[...this.chunkRevisions],soilExcavated:this.soilExcavated,soilDeposited:this.soilDeposited,soilAbandoned:this.soilAbandoned,
    pheromones:[...this.pheromones],trails:{food:[...this.trails.food],water:[...this.trails.water]},patches:this.patches};}
  static fromJSON(d,legacy=false){
    const w=new World(d.seed);w.spaceReady=false;Object.assign(w,d);w.terrainVersion=d.terrainVersion??0;w.entrances=d.entrances??[{mouth:[0,0],state:'open',createdAt:0}];w.moundTunnels=new Set(d.moundTunnels??[]);w.soilRehandled=d.soilRehandled??0;w.lastAccessPlan=d.lastAccessPlan??0;w.lastMoundPlan=d.lastMoundPlan??0;
    for(const f of ['excavated','deposits'])w[f]=new Set(d[f]);
    for(const f of ['chunkRevisions','pheromones','spoilOrigins'])w[f]=new Map(d[f]??[]);
    w.trails={food:new Map(d.trails?.food??d.pheromones??[]),water:new Map(d.trails?.water??[])};
    w.heights=new Map();for(const id of w.deposits){const [x,y]=cell(id);if(y<w.baseSurface(x))w.heights.set(x,Math.min(w.heights.get(x)??Infinity,y));if(!w.spoilOrigins.has(id))w.spoilOrigins.set(id,'mixed');}
    if(legacy){w.construction=[];w.rooms=[{kind:'queen',center:[0,11],rx:6,ry:3},{kind:'nursery',center:[-10,10],rx:4,ry:2},{kind:'storage',center:[10,10],rx:4,ry:2}];}
    w.geometryVersion=d.geometryVersion??1;w.pathCache=new Map();w.neighborCache=new Map();w.runtime={pathCalls:0,pathMs:0,recoveries:0};w.frontierVersion=-1;w.frontierCache=[];restoreHabitat(w,d);initGroundwater(w,56,d.groundwater);initSignals(w,d);w.rebuildNavigation();w.repairMound();return w;
  }
}

export class Colony{
  constructor(seed=287,settings={}){
    this.modelVersion=4;this.species=SPECIES.scientific;this.socialForm='monogyne';this.socialTransfers=0;this.recognitions=0;this.alarmEvents=0;this.settings=settingsFrom(settings);this.world=new World(seed);this.world.carve(this.world.nest,3,2);this.world.carve([-4,12],2,2);this.world.rooms[0].rx=3;this.world.rooms[0].ry=2;this.world.rooms[1].ry=2;this.rng=new Random(seed);this.time=0;
    const n=Math.min(this.settings.startingWorkers,this.settings.populationCap-1);
    this.food=Math.max(12,n*.7);this.protein=Math.max(5,n*.3);this.water=Math.max(8,n*.5);
    this.ants=[initializeBrain(createAnt(0,'queen',this.world.nest,seed,60),seed)];this.brood=[];this.events=[];this.nextID=n+1;
    this.foodDelivered=0;this.waterDelivered=0;this.births=0;this.deaths=0;this.eggsLaid=0;this.broodLost=0;this.recruitments=0;this.broodMoved=0;this.broodClaims=new Set();this.lastEgg=0;this.lastPlan=0;this.lastDecay=0;this.lastDemand=-10;this.demand=null;
    this.occupancy=new Map();this.reserved=new Set();
    const open=[...this.world.excavated].map(cell).filter(c=>c[1]>=9);
    for(let id=1;id<=n;id++){const x=this.world.entrance()[0]+(id-2)*3,c=id<=3?[x,this.world.surface(x)-1]:open[this.rng.int(0,open.length-1)];const worker=initializeBrain(createAnt(id,'worker',c,seed,1+this.rng.int(0,17)),seed);worker.bodySize=Math.min(.55,worker.bodySize);worker.caste='worker';worker.traits.lifeDays=lifespanFor(worker,seed);this.ants.push(worker);}
    for(const fraction of [.10,.40,.998])this.brood.push({id:this.nextID++,age:BROOD_DURATION*fraction,cell:[-4+this.brood.length%3-1,12],nutrition:1,vitality:1,lastCare:0,needsTransport:false,carriedBy:null,home:[-4,12],lastMoved:0});
    this.world.groundwater.depth=this.world.groundwater.targetDepth=this.settings.waterTableDepth;initializeSupplies(this,{food:this._energy,protein:this._protein,water:this._water});delete this._energy;delete this._protein;delete this._water;
    for(const b of this.brood)bedRelease(this,b);for(const b of this.brood){const bed=findBed(this.world,b.home);if(bed)bedOccupy(this,b,bed);}settleAdults(this);this.record('A single-queen fire ant colony begins its life in the clearing.');this.updateDemand();
  }
  get food(){return this.nutrition?.energy??this._energy??0;}
  set food(n){setReserve(this,'energy',n);}
  get protein(){return this.nutrition?.protein??this._protein??0;}
  set protein(n){setReserve(this,'protein',n);}
  get water(){return this.nutrition?.water??this._water??0;}
  set water(n){setReserve(this,'water',n);}
  get day(){return Math.floor(this.time/DAY)+1;}
  get alive(){return this.ants.some(a=>a.caste==='queen');}
  get nursery(){
    const rooms=this.world.rooms.filter(r=>['nursery','mound'].includes(r.kind)&&this.world.walkable(r.center));
    const scores=new Map();for(const r of rooms){let count=0;for(const b of this.brood)if(distance(b.cell,r.center)<4)count++;scores.set(r,Math.abs(this.world.conditions(r.center).humidity-.62)+count*.012);}
    rooms.sort((a,b)=>scores.get(a)-scores.get(b));return rooms[0]?.center??[-5,10];
  }
  setSettings(changes){this.settings=settingsFrom({...this.settings,...changes});this.world.groundwater.targetDepth=this.settings.waterTableDepth;}
  record(text){this.events.unshift({time:this.time,text});this.events=this.events.slice(0,6);}
  updateDemand(){
    const broodIDs=new Set(this.brood.map(b=>b.id));
    this.broodClaims=new Set(this.ants.filter(a=>a.carryingBrood!=null||a.task==='toBrood').map(a=>a.carryingBrood??a.broodID).filter(id=>broodIDs.has(id)));
    if(this.careClaims?.size){const ants=new Map(this.ants.map(a=>[a.id,a]));for(const [id,owner] of this.careClaims){const a=ants.get(owner);if(!broodIDs.has(id)||!a||a.task!=='nursing'||a.broodID!==id)this.careClaims.delete(id);}}
    rebuildReservations(this);updateSupplyTotals(this);const count=this.ants.length,nurses=this.ants.filter(a=>a.task==='nursing').length,diggers=this.ants.filter(a=>['toDig','digging','haulingSoil'].includes(a.task)).length;
    const larvae=this.brood.filter(b=>broodStage(b)==='larva'),hungry=larvae.filter(b=>b.nutrition<.4).length,untended=this.brood.filter(b=>this.time-b.lastCare>20).length;
    const foodTarget=count*.65+4,proteinTarget=larvae.length*.75+count*.10+2,waterTarget=count*.4+this.brood.length*.08,desiredSpace=35+count*2.2+this.brood.length*1.4+this.foodItems.length/5;this.freeBeds=freeBedCount(this);
    const surfaceWater=this.world.patches.filter(p=>p.kind==='water'&&p.origin!=='seep').reduce((n,p)=>n+p.amount,0),dryTime=this.time-(this.world.weather.lastRainAt??0);this.waterPressure=!this.world.weather.raining&&dryTime>DAY*.8&&surfaceWater<8&&!this.world.patches.some(p=>p.origin==='seep'&&p.amount>.05)?.55:0;
    const energyNeed=clamp((foodTarget-this.food)/foodTarget),proteinNeed=clamp((proteinTarget-this.protein)/proteinTarget);
    this.demand={forage:.05+Math.max(energyNeed,proteinNeed*1.25),protein:proteinNeed,energy:energyNeed,
      water:.03+clamp((waterTarget-this.water)/waterTarget),care:this.brood.length?(.05+hungry/Math.max(1,larvae.length)*.9+untended/this.brood.length*.9)/(1+nurses*.18):0,
      dig:Math.max(this.waterPressure,this.time<(this.congestionUntil??0)?.6:0,this.freeBeds<Math.max(3,this.brood.length*.15)?.65:0,clamp((desiredSpace-this.world.excavated.size-this.world.moundTunnels.size)/Math.max(12,desiredSpace)))/(1+diggers*.2),desiredSpace};
    this.lastDemand=this.time;
  }
  step(dt=.1){for(const _ of this.tick(dt)){} }
  *tick(dt=.1){
    if(!Number.isFinite(dt)||dt<=0||dt>1)return;
    this.time+=dt;tickHabitat(this.world,this.time);tickGroundwater(this.world,this.time);
    if(this.time-this.lastDemand>=1||!this.demand)this.updateDemand();
    if(this.time-this.lastDecay>=2){
      decaySignals(this.world,this.time-this.lastDecay);
      const queen=this.ants.find(a=>a.caste==='queen');if(queen)emit(this.world,'queen',queen.cell,1);
      let cueCount=0;for(const baby of this.brood){emit(this.world,'brood',baby.cell,.3+(broodStage(baby)==='larva'?(1-baby.nutrition)*.6:0));if(++cueCount%128===0)yield;}
      for(const e of this.world.entrances.filter(e=>e.state==='open'))emit(this.world,'home',e.mouth,1);
      this.lastDecay=this.time;
    }
    if(this.time-this.lastPlan>12){
      // Abandon unreachable construction instead of retrying a blocked dig forever.
      if(this.world.construction.length && !this.world.frontier().length){this.world.construction=[];this.world.frontierVersion=-1;}
      for(const e of this.world.entrances)if(e.state==='planned'&&this.world.path(this.world.nest,e.mouth))e.state='open';
      this.lastPlan=this.time;
    }
    beginTraffic(this);this.occupancy=new Map();this.reserved=new Set();this.broodClaims=new Set(this.ants.filter(a=>['toBrood','carryingBrood'].includes(a.task)).map(a=>a.broodID));this.careClaims=new Map();for(const a of this.ants)if(a.task==='nursing'&&a.broodID!=null&&!this.careClaims.has(a.broodID))this.careClaims.set(a.broodID,a.id);
    let indexed=0;for(const a of this.ants){const id=key(a.cell);if(!this.occupancy.has(id))this.occupancy.set(id,[]);this.occupancy.get(id).push(a);if(a.target&&['toDig','digging'].includes(a.task))this.reserved.add(key(a.target));if(++indexed%128===0)yield;}
    this.broodByID=new Map();this.localBrood=new Map();this.indexedBrood=this.brood;let babies=0;for(const b of this.brood){this.broodByID.set(b.id,b);const id=key(b.cell);if(!this.localBrood.has(id))this.localBrood.set(id,[]);this.localBrood.get(id).push(b);if(++babies%128===0)yield;}
    if(this.broodSource!==this.brood||this.broodIDs?.size!==this.brood.length){this.broodIDs=new Set(this.brood.map(b=>b.id));this.broodSource=this.brood;}
    let updated=0;for(const a of this.ants){this.updateAnt(a,dt);this.auditProgress(a);if(this.world.onSurface(a.cell))ensureHabitat(this.world,a.cell[0]);if(++updated%24===0)yield;}
    for(const a of this.ants)if(!this.world.walkable(a.cell)){const actual=a.pos.map(Math.round);a.cell=this.world.walkable(actual)?actual:this.world.escapeCell(actual);a.route=[];}
    const lost=this.ants.filter(a=>a.health<=0);for(const a of lost){this.world.motionRevisions?.delete(a.id);accountDeath(this,a);if(a.cargoKind==='soil')this.world.soilAbandoned+=a.carried;this.releaseBrood(a);}
    this.deaths+=lost.length;if(lost.some(a=>a.caste==='queen'))this.record('The queen has died. A new colony can begin when you are ready.');
    if(lost.length){this.ants=this.ants.filter(a=>a.health>0);updateSupplyTotals(this);}yield* this.broodTick(dt);
  }
  needsFor(a){
    if(!this.demand)this.updateDemand();
    if(!a.knownNeeds || ((!this.world.onSurface(a.cell)||distance(a.cell,this.world.nest)<3) && this.time-a.needsAt>3)){a.knownNeeds={...this.demand};a.needsAt=this.time;}
    return a.knownNeeds;
  }
  send(a,target){
    if(!target)return false;if(a.motion){a.motion.yieldingRoute=false;a.motion.resumeGoal=null;a.motion.yieldTarget=null;}a.target=[...target];a.destination=[...target];
    const stance=this.world.traffic?(canOccupy(this.world,a,target)?target:nearestStance(this.world,a,target)):target;
    const route=stance?routeAroundItems(this.world,a,stance):null;
    if(route){a.route=route;a.routeFailures=0;return true;}
    a.route=[];a.routeFailures++;a.busyUntil=this.time+Math.min(5,1+a.routeFailures);
    if(!a.carried&&!a.carryingBrood&&a.caste!=='queen'){
      for(const m of a.memories)if(same(m.cell,target))m.avoidUntil=this.time+60;
      a.task='resting';a.decision='The route changed. Reassessing the task from a safe position.';
    }return false;
  }
  auditProgress(a){
    const moved=distance(a.pos,a.lastProgressPos??a.pos)>.15;
    if(moved){a.lastProgressAt=this.time;a.lastProgressPos=[...a.pos];}
    const working=['toFood','toWater','returningFood','returningWater','toDig','haulingSoil','exploring','toBrood','nursing','carryingBrood','queenMoving','toQueenStore','feedingQueen','refueling','storeFood','toCache'].includes(a.task);
    const waypointStalled=a.route.length&&this.time-(a.motion.progressAt??this.time)>12;
    if(!working||this.time<a.busyUntil||!waypointStalled&&this.time-(a.lastProgressAt??0)<18)return;
    this.world.runtime.recoveries++;a.lastProgressAt=this.time;this.world.pathCache.clear();a.route=[];
    if(a.caste!=='queen'&&!a.carried&&!a.carryingBrood){const item=this.foodItems.filter(p=>distance(p.pos,a.pos)<.8).sort((p,q)=>distance(p.pos,a.pos)-distance(q.pos,a.pos))[0];if(liftCache(this,a,item)){if(this.careClaims?.get(a.broodID)===a.id)this.careClaims.delete(a.broodID);a.broodID=null;refreshItems(this);this.assignFoodStorage(a);return;}}
    if(a.task==='refueling'){this.send(a,this.world.nest);return;}
    if(a.caste==='queen'){a.task='queenRest';a.destination=null;a.queenCheckAt=0;return;}
    if(a.task==='toBrood'){this.releaseBrood(a);this.chooseJob(a);return;}
    if(a.task==='nursing'){if(a.broodID!=null){a.careAvoid={id:a.broodID,until:this.time+30};if(this.careClaims?.get(a.broodID)===a.id)this.careClaims.delete(a.broodID);}a.broodID=null;this.chooseJob(a);return;}
    if(a.task==='carryingBrood'){if(a.broodDestination)releaseCell(this.world,a.broodDestination,'b:'+a.carryingBrood);a.broodDestination=null;this.carryBrood(a);return;}
    if(a.cargoKind==='queenMeal'){this.feedQueen(a);return;}
    if(a.carried){if(a.cargoKind==='soil'){this.headOut(a);}else{a.task=a.cargoKind==='water'?'returningWater':'returningFood';this.send(a,this.world.nest);}return;}
    a.decision='Replanning after a blocked or unproductive route.';this.chooseJob(a);
  }
  releaseBrood(a){
    if(a.broodID!=null)this.broodClaims.delete(a.broodID);
    if(a.broodDestination)releaseCell(this.world,a.broodDestination,'b:'+(a.carryingBrood??a.broodID));
    const b=this.broodItem(a.carryingBrood);
    if(b){if(a.broodDestination)releaseCell(this.world,a.broodDestination,'b:'+b.id);const bed=bedAvailable(this,b,a.cell);b.carriedBy=null;if(bed)bedOccupy(this,b,bed);delete b.pos;b.needsTransport=true;}
    a.carryingBrood=null;a.broodID=null;a.broodDestination=null;
  }

  learn(a,source,kind,confidence=.85){
    const old=a.memories.find(m=>same(m.cell,source)&&m.kind===kind);
    const observed=this.world.patches.find(p=>p.kind===kind&&same(p.cell,source)&&distance(a.cell,p.cell)<=4.5);
    if(old)Object.assign(old,{confidence:Math.max(old.confidence,confidence),lastSeen:this.time,failures:0,avoidUntil:0,nutrition:observed?.nutrition??old.nutrition});
    else a.memories.push({cell:[...source],kind,confidence,lastSeen:this.time,failures:0,avoidUntil:0,nutrition:observed?.nutrition??null});
    a.memories.sort((x,y)=>y.confidence-x.confidence||y.lastSeen-x.lastSeen);a.memories=a.memories.slice(0,3);a.memory=[...source];
  }
  broodItem(id){return this.indexedBrood===this.brood&&this.broodByID?.size===this.brood.length?this.broodByID.get(id):this.brood.find(b=>b.id===id);}
  nearbyBrood(c){if(this.indexedBrood!==this.brood||!this.localBrood)return this.brood.filter(b=>distance(b.cell,c)<3.1);const out=[];for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)for(const b of this.localBrood.get(key([c[0]+x,c[1]+y]))??[])if(distance(b.cell,c)<3.1)out.push(b);return out;}
  careCandidates(a){return a.knownBrood.map(id=>this.broodItem(id)).filter(Boolean);}
  sense(a){
    const brain=a.brain;
    if(this.time<(a.senseAt??0))return;const elapsed=this.time-(a.sensedAt??this.time);a.sensedAt=this.time;a.senseAt=this.time+1;
    brain.arousal=Math.max(0,brain.arousal-elapsed*.08);
    brain.senses={food:senseSignal(this.world,'food',a.cell),water:senseSignal(this.world,'water',a.cell),alarm:senseSignal(this.world,'alarm',a.cell),brood:senseSignal(this.world,'brood',a.cell),queen:senseSignal(this.world,'queen',a.cell),construction:this.world.frontier().some(c=>distance(c,a.cell)<3)?1:0};
    for(const p of this.world.patches)if(p.origin==='seep'&&p.amount>.001&&distance(a.pos,p.cell)<3.2)this.learn(a,p.cell,'water');
    const known=new Set(a.knownBrood);for(const baby of this.nearbyBrood(a.cell))if(baby.carriedBy==null&&!known.has(baby.id)){known.add(baby.id);a.knownBrood.push(baby.id);}
    const ids=this.broodIDs??new Set(this.brood.map(b=>b.id));a.knownBrood=a.knownBrood.filter(id=>ids.has(id)).slice(-96);
  }
  encounter(a){
    if(this.time<a.encounterAt)return;a.encounterAt=this.time+2;
    let checked=0;
    for(const c of [a.cell,...adjacent(a.cell)])for(const other of this.occupancy.get(key(c))??[]){
      if(other.id===a.id||distance(a.pos,other.pos)>1.4)continue;if(checked++>=8)return;
      if(!other.brain)initializeBrain(other,this.world.seed);
      if(!contact(a,other,this.time)){emit(this.world,'alarm',a.cell,1);this.alarmEvents++;continue;}
      this.recognitions++;a.motion.contactUntil=this.time+.45;
      if(other.needsAt>a.needsAt&&other.knownNeeds){a.knownNeeds={...other.knownNeeds};a.needsAt=other.needsAt;}
      shareCrops(this,other,a);
      if(other.task.startsWith('returning')&&other.carried>0){
        const kind=other.task==='returningWater'?'water':'food';
        a.brain.recruitedKind=kind;a.brain.recruitUntil=this.time+45;a.brain.arousal=Math.max(.5,a.brain.arousal);this.recruitments++;
        // Contact activates search. A chemical signal does not transmit remote coordinates.
        if(['reserve','resting','grooming'].includes(a.task)&&a.energy>.4&&a.hydration>.4&&((kind==='food'?(a.knownNeeds?.forage??1):(a.knownNeeds?.water??1))>.15)){a.busyUntil=this.time;a.jobSince=this.time-60;}
      }
    }
  }
  disturb(c){let responders=0;for(const a of this.ants)if(a.caste!=='queen'&&distance(a.pos,c)<5){emit(this.world,'alarm',a.cell,1.5);a.brain.arousal=1;a.senseAt=0;if(!a.carried&&!a.carryingBrood){a.busyUntil=this.time;a.route=[];this.sense(a);this.chooseJob(a);}responders++;}if(responders){this.alarmEvents++;this.record('Nearby workers released alarm after a local disturbance.');}else this.record('The ground was disturbed, with no workers nearby.');return responders;}

  updateAnt(a,dt){
    if(!a.brain)initializeBrain(a,this.world.seed);this.sense(a);updateMotion(a,this.world,this.time,dt,this.occupancy);
    a.age+=dt;const active=a.route.length?1.5:a.task==='digging'?1.8:.65;
    a.energy=clamp(a.energy-dt*active/(DAY*5),.01,1);a.hydration=clamp(a.hydration-dt*active/(DAY*4));
    consumeSelf(this,a,dt);
    const lifespan=a.traits.lifeDays,aged=adultDays(a)>lifespan;
    a.health=clamp(a.health+(a.energy<.08||a.hydration<.1?-dt/DAY*.8:aged?-dt/DAY*.4:dt/DAY*.12));
    if(!this.world.walkable(a.cell)){const actual=a.pos.map(Math.round);a.cell=this.world.walkable(actual)?actual:this.world.escapeCell(actual);a.route=[];}
    if(a.motion.recovering){recoverBody(a,this.world,dt);if(a.carryingBrood){const b=this.broodItem(a.carryingBrood);if(b)b.pos=[...a.pos];}if(a.motion.recovering)return;}
    if(a.caste!=='queen'){
      this.encounter(a);
      if(this.time>=(a.selfCheckAt??0)){
        a.selfCheckAt=this.time+6;
        if(((a.energy<.28&&foodFill(a)<.01&&this.food+this.protein>0)||(a.hydration<.25&&a.socialWater<.01&&this.water>0))&&!['refueling','toCache','toFood','toWater','harvesting','exploring'].includes(a.task)){
          a.task='refueling';a.route=[];a.busyUntil=this.time;this.send(a,this.world.nest);a.decision='Temporarily returning for nutrition while retaining the current load.';
        }
      }
    }
    if(a.motion.yieldingRoute&&(a.motion.trafficBlocked??0)>5){a.motion.yieldingRoute=false;a.route=[];a.motion.resumeGoal=null;a.motion.yieldTarget=null;this.chooseJob(a);return;}
    if(a.motion.yieldingRoute&&!a.route.length){if(this.time<a.motion.yieldEnd)return;const goal=a.motion.resumeGoal;a.motion.yieldingRoute=false;a.motion.yieldTarget=null;a.motion.resumeGoal=null;if(goal)this.send(a,goal);return;}
    if(a.route.length&&!a.motion.yieldingRoute){
      const target=a.task==='toCache'?this.foodItems.find(p=>p.id===a.cacheID)?.pos:a.task==='storeFood'?a.cacheSlot:a.task==='toBrood'||a.task==='nursing'?this.broodItem(a.broodID)?.cell:a.task==='carryingBrood'?a.broodDestination:a.task==='feedingQueen'?this.ants.find(b=>b.caste==='queen')?.pos:null;
      if(target&&distance(a.pos,target)<=1.25){a.route=[];a.cell=a.pos.map(Math.round);}
      if(a.task.startsWith('returning')&&distance(a.pos,this.world.nest)<3){a.route=[];a.cell=a.pos.map(Math.round);}
      if((a.task==='toFood'||a.task==='toWater')&&this.harvestSource(a,a.task==='toWater'?'water':'food')){a.route=[];a.cell=a.pos.map(Math.round);}
    }
    if(a.route.length){
      const next=a.route[0];
      if(!terrainFree(this.world,next)){a.route=[];const goal=a.motion.yieldTarget??a.destination;if(goal){const stance=canOccupy(this.world,a,goal)?goal:nearestStance(this.world,a,goal);if(stance)a.route=routeAroundItems(this.world,a,stance)??[];}return;}
      const waypointCell=next.slice(0,2).map(Math.round),traffic=Math.max(0,(this.occupancy.get(key(waypointCell))?.length??0)-1),arrived=moveAnt(a,this.world,this.time,dt,traffic);if(!arrived)unjam(this,a);
      const actual=a.pos.map(Math.round);if(a.route[0]?.[3]==null&&distance(a.pos,a.cell)>.9){const anchors=[];for(let y=actual[1]-1;y<=actual[1]+1;y++)for(let x=actual[0]-1;x<=actual[0]+1;x++)if(this.world.walkable([x,y]))anchors.push([x,y]);anchors.sort((p,q)=>distance(p,a.pos)-distance(q,a.pos));if(anchors[0]&&!same(anchors[0],a.cell)){a.cell=anchors[0];const goal=a.motion.yieldTarget??a.destination;if(goal)a.route=routeAroundItems(this.world,a,goal)??[];}}
      if(a.task==='haulingSoil'&&!a.depositTarget&&!a.motion.yieldingRoute&&this.world.onSurface(actual)){a.cell=actual;a.route=[];}
      if(arrived&&a.task.startsWith('returning')){
        const kind=a.task==='returningWater'?'water':'food',trail=this.world.trails[kind],strength=(.12+.20*Math.exp(-(this.time-a.sourceAt)/50))*(a.deliveryAmount??a.carried)/2.5;
        emit(this.world,kind,next,strength);const id=key(waypointCell);if(!this.world.solid(waypointCell))this.world.pheromones.set(id,Math.max(trail.get(id)??0,this.world.pheromones.get(id)??0));
      }
      if(a.carryingBrood){const b=this.broodItem(a.carryingBrood);if(b){b.cell=[...a.cell];b.pos=[...a.pos];}}
      if(a.task==='exploring'&&this.time>=a.perceptionAt){a.perceptionAt=this.time+.8;this.discover(a);}if(a.task==='exploring'&&!a.route.length)this.explore(a);return;
    }
    if(this.time<a.busyUntil)return;
    if(a.caste==='queen'){this.updateQueen(a);return;}
    switch(a.task){
      case 'returningFood':case 'returningWater':
        if(distance(a.pos,this.world.nest)>3){this.send(a,this.world.nest);break;}
        a.returnKind=a.task==='returningWater'?'water':'food';a.task='sharing';a.busyUntil=this.time+1.5;a.decision='Offering a crop load to nearby nestmates before putting solid excess into an individual cache space.';break;
      case 'sharing':{
        if(a.deliveryAmount==null&&a.carried&&a.cargoKind==='water')a.deliveryAmount=a.carried;
        if(a.cargoKind==='water'&&a.carried){const n=Math.min(a.carried,waterCapacity(a)-a.socialWater);a.socialWater+=n;a.carried-=n;if(a.carried<=1e-9){a.carried=0;a.cargoKind=null;}}
        fillFromCargo(a);consumeSelf(this,a,.1);fillFromCargo(a);
        for(const other of this.occupancy.get(key(a.cell))??[])if(other.id!==a.id)shareCrops(this,a,other);
        if(a.returnKind==='water')this.waterDelivered+=a.deliveryAmount??0;else this.foodDelivered+=a.deliveryAmount??a.carried;
        a.deliveryAmount=0;a.deliveryKind=null;updateSupplyTotals(this);
        if(a.cargoKind==='food'&&a.carried>0){this.assignFoodStorage(a);break;}
        a.trips++;a.experience++;a.skills.forage=clamp(a.skills.forage+.025);this.chooseJob(a);break;
      }
      case 'storeFood':{
        fillFromCargo(a);consumeSelf(this,a,.1);fillFromCargo(a);
        if(!a.carried){if(a.cacheSlot)releaseSlot(this.world,a.cacheSlot,'a:'+a.id);a.cacheSlot=null;this.chooseJob(a);break;}
        if(!a.cacheSlot||!this.world.walkable(a.cacheSlot.map(Math.round))){this.assignFoodStorage(a);break;}
        if(distance(a.pos,a.cacheSlot)>1.4){this.send(a,a.cacheSlot.map(Math.round));break;}
        if(a.energy<.999||foodFill(a)<socialCapacity(a)-.005){a.busyUntil=this.time+.3;break;}if(!spaceForItem(this.world,a.cacheSlot,.115)){this.assignFoodStorage(a);break;}storeCargo(this,a);refreshItems(this);if(a.carried)this.assignFoodStorage(a);else{a.trips++;this.chooseJob(a);}break;
      }
      case 'toCache':{
        const item=this.foodItems.find(p=>p.id===a.cacheID);if(item&&distance(a.pos,item.pos)>1.4){this.send(a,item.pos.map(Math.round));break;}
        if(item)takeCache(this,a,item);a.cacheID=null;consumeSelf(this,a,1);
        if(a.cachePurpose==='queen'){a.task='feedingQueen';this.feedQueen(a);}else if(a.cachePurpose==='care'){if(!this.assignCare(a))this.chooseJob(a);}else this.chooseJob(a);break;
      }
      case 'toFood':case 'toWater':{
        a.collectKind=a.task==='toWater'?'water':'food';
        const p=this.harvestSource(a,a.collectKind);
        if(p){a.task='harvesting';a.busyUntil=this.time+(p.origin==='prey'?3:2);a.decision='Handling a finite portion; the source is reduced only when it is collected.';break;}
        a.task=a.collectKind==='water'?'toWater':'toFood';this.finishHarvest(a);break;
      }
      case 'harvesting':this.finishHarvest(a);break;
      case 'toDig':
        if(!a.target||!this.world.solid(a.target)||distance(a.target,a.cell)>1.01){this.chooseJob(a);break;}
        a.task='digging';a.busyUntil=this.time+this.world.digTime(a.target,a.skills.dig);a.decision='Excavating '+MATERIALS[this.world.material(a.target)].name.toLowerCase()+'. All earth is diggable; experience improves handling.';break;
      case 'digging':{
        const origin=a.target?(this.world.spoilOrigins.get(key(a.target))??this.world.material(a.target)):'topsoil';
        if(a.target&&this.world.excavate(a.target)){a.carried=1;a.cargoKind='soil';a.cargoMaterial=origin;a.task='haulingSoil';a.experience++;a.skills.dig=clamp(a.skills.dig+.02);this.headOut(a);a.decision='Carrying one excavated pellet to a nearby stable deposition site outside the entrance.';}
        else this.chooseJob(a);break;
      }
      case 'haulingSoil':{
        if(!this.world.onSurface(a.cell)){const exit=this.exitFor(a);if(exit){a.route=exit.route;a.destination=exit.point;}else{a.motion.trafficBlocked=2;unjam(this,a);}break;}
        if(!a.depositTarget||this.world.solid(a.depositTarget)||!spaceForItem(this.world,a.depositTarget,.45)){
          a.depositTarget=this.world.depositSite(a.cell,a);
        }
        const site=a.depositTarget;if(!site){a.busyUntil=this.time+.5;a.motion.trafficBlocked=2;unjam(this,a);break;}
        if(distance(a.pos,site)>1.45||distance(a.pos,site)<.8){
          const stance=this.world.neighbors(site).filter(p=>distance(p,site)>=.9&&canOccupy(this.world,a,p)).sort((p,q)=>distance(p,a.pos)-distance(q,a.pos))[0];
          if(stance)this.send(a,stance);else{a.motion.trafficBlocked=2;unjam(this,a);}break;
        }
        if(this.world.deposit(site,a.cargoMaterial)){a.carried=0;a.cargoKind=null;a.cargoMaterial=null;a.depositTarget=null;a.trips++;a.cell=a.pos.map(Math.round);if(this.world.soilDeposited===1)this.record('The first loose-soil mound is forming.');this.chooseJob(a);}else a.depositTarget=null;break;
      }
      case 'exploring':if(!this.discover(a))this.explore(a);break;
      case 'toQueenStore':if(!this.assignCache(a,'queen',true))this.chooseJob(a);break;
      case 'feedingQueen':this.feedQueen(a);break;
      case 'toBrood':this.collectBrood(a);break;
      case 'carryingBrood':this.carryBrood(a);break;
      case 'nursing':{
        const baby=this.broodItem(a.broodID);
        if(!baby||baby.carriedBy!=null||(this.careClaims?.has(baby.id)&&this.careClaims.get(baby.id)!==a.id)){if(!this.assignCare(a))this.chooseJob(a);break;}
        if(distance(a.pos,baby.cell)>1.4){this.send(a,baby.cell);break;}
        baby.lastCare=this.time;
        if(broodStage(baby)==='larva'){const wanted=Math.min(.054,(1-baby.nutrition)*.12),held=consumeNutrient(this,a,'protein',wanted),protein=held+feedBroodCargo(this,a,wanted-held);baby.nutrition+=protein/.12;baby.fed=(baby.fed??0)+protein/.12;if(a.socialProtein<.015&&!(a.cargoKind==='broodMeal'&&a.carried)&&this.assignCache(a,'care',true))break;}
        a.skills.care=clamp(a.skills.care+.01);a.busyUntil=this.time+3;
        a.decision='In contact with brood: feeding larvae and maintaining care. Brood elsewhere receives no automatic nursing benefit.';
        if(this.time-(a.jobSince??0)>12&&this.rng.float()<.25)this.chooseJob(a);else this.assignCare(a);break;
      }
      case 'refueling':{
        consumeSelf(this,a,1);if(a.energy<.75&&foodFill(a)<.01&&this.assignCache(a,'self'))break;
        if(a.hydration<.5&&a.socialWater<.01){a.foragingKind='water';if(this.discover(a))break;this.explore(a);break;}
        this.chooseJob(a);break;
      }
      case 'resting':case 'grooming':case 'reserve':case 'patrolling':this.chooseJob(a);break;
      case 'investigating':{
        const alarm=senseSignal(this.world,'alarm',a.cell);
        if(this.time>=a.guardUntil||alarm<.10){a.brain.arousal=0;this.chooseJob(a);break;}
        const choices=[...this.world.neighbors(a.cell)].sort((x,y)=>senseSignal(this.world,'alarm',y)-senseSignal(this.world,'alarm',x));
        if(choices[0])this.send(a,choices[0]);a.busyUntil=this.time+1;break;
      }

    }
  }
  headOut(a){a.task='haulingSoil';if(this.world.onSurface(a.cell)){a.route=[];return;}const exit=this.exitFor(a);if(exit){a.route=exit.route;a.destination=exit.point;}else{a.route=[];a.busyUntil=this.time+.5;}}
  exitFor(a){
    const w=this.world,exit=w.foragingExit(a.cell)??w.entrance(a.cell),candidates=[];
    for(let dx=-4;dx<=4;dx++)for(let up=1;up<=2;up++){const x=exit[0]+dx,p=[x,w.surface(x)-up];if(w.onSurface(p)&&(canOccupy(w,a,p)||canOccupy(w,a,p,0)||canOccupy(w,a,p,Math.PI/2)))candidates.push(p);}
    candidates.sort((p,q)=>distance(p,exit)-distance(q,exit)||distance(p,a.pos)-distance(q,a.pos));
    for(const p of candidates){const route=routeAroundItems(w,a,p);if(route)return {point:p,route};}return null;
  }
  harvestSource(a,kind){return this.world.patches.filter(p=>(same(p.cell,a.cell)||p.pieces?.some(i=>distance(i.pos,a.pos)<1.25))&&p.kind===kind&&p.amount>.001&&(kind!=='food'||!a.wantProtein||(p.nutrition?.protein??0)>.4)).sort((p,q)=>Number(q.id===a.sourceID)-Number(p.id===a.sourceID)||q.amount-p.amount)[0];}
  finishHarvest(a){
    const kind=a.collectKind??(a.task==='toWater'?'water':'food'),p=this.harvestSource(a,kind);
    if(p){
      const free=kind==='water'?Math.max(0,waterCapacity(a)-a.socialWater):Math.max(0,socialCapacity(a)-foodFill(a))+(a.carried||a.carryingBrood?0:socialCapacity(a));
      const n=harvest(this.world,p,Math.min(free,p.amount),this.time);accountIntake(this,kind,n,p.nutrition??NUTRITION.mixed);this.learn(a,p.cell,p.kind);a.sourceAt=this.time;a.deliveryKind=kind;a.deliveryAmount=(a.deliveryAmount??0)+n;
      if(kind==='water'){a.socialWater+=n;consumeSelf(this,a,1);if(a.carried){this.chooseJob(a);return;}a.task='returningWater';}
      else{const mix=p.nutrition??NUTRITION.mixed;if(a.carried&&a.cargoKind!=='food'||a.carryingBrood){a.socialFood+=n*mix.energy;a.socialProtein+=n*mix.protein;a.deliveryKind=null;a.deliveryAmount=0;consumeSelf(this,a,1);updateSupplyTotals(this);this.chooseJob(a);return;}a.carried+=n;a.cargoKind='food';a.cargoNutrition=mix;fillFromCargo(a);consumeSelf(this,a,1);a.task='returningFood';}
      updateSupplyTotals(this);a.decision='Collected a finite portion at this source. Personal reserves are filled first; liquid water remains in crops.';this.send(a,this.world.nest);return;
    }
    for(const m of a.memories)if(same(m.cell,a.cell)){m.failures++;m.confidence*=.45;m.avoidUntil=this.time+90;}a.memories=a.memories.filter(m=>m.failures<3);this.explore(a);
  }
  assignCache(a,purpose='self',protein=false){
    const item=nearestCache(this,a,protein);if(!item)return false;if(!this.send(a,item.pos.map(Math.round)))return false;a.cacheID=item.id;a.cachePurpose=purpose;a.task='toCache';if(purpose==='care'||purpose==='queen')a.lastJob='care';a.decision='Walking to a specific stored food parcel before taking it into the crop.';return true;
  }
  assignFoodStorage(a){
    a.task='storeFood';if(a.cacheSlot)releaseSlot(this.world,a.cacheSlot,'a:'+a.id);a.cacheSlot=cacheSlotFor(this,a);
    if(a.cacheSlot){this.send(a,a.cacheSlot.map(Math.round));a.task='storeFood';a.decision='Full personal reserves: carrying excess solid food to its own empty cache space.';}
    else{a.busyUntil=this.time+2;this.storageBlocked=true;this.proposeConstruction(a,{...this.needsFor(a),dig:1});a.decision='Holding excess food while workers make more storage space.';}return true;
  }
  chooseJob(a){
    if(a.task==='toBrood'&&!a.carryingBrood)this.releaseBrood(a);
    if(a.cacheSlot){releaseSlot(this.world,a.cacheSlot,'a:'+a.id);a.cacheSlot=null;}
    if(a.motion){a.motion.yieldingRoute=false;a.motion.resumeGoal=null;a.motion.yieldTarget=null;}
    if(this.careClaims?.get(a.broodID)===a.id)this.careClaims.delete(a.broodID);
    a.lastProgressAt=this.time;a.lastProgressPos=[...a.pos];a.target=null;a.route=[];
    if((a.energy<.28&&foodFill(a)<.01)||(a.hydration<.25&&a.socialWater<.01)){
      if(a.energy<.28&&foodFill(a)<.01&&this.assignCache(a,'self'))return;a.foragingKind=a.hydration<.25&&a.socialWater<.01?'water':'food';a.task='exploring';if(!this.discover(a))this.explore(a);return;
    }
    if(a.deliveryKind){a.task=a.deliveryKind==='water'?'returningWater':'returningFood';this.send(a,this.world.nest);return;}
    if(a.cargoKind==='broodMeal'&&a.carried){if(this.assignCare(a))return;a.cargoKind='food';this.assignFoodStorage(a);return;}
    if(a.cargoKind==='food'&&a.carried){this.assignFoodStorage(a);return;}
    if(a.energy<.8&&foodFill(a)<.01&&this.assignCache(a,'self'))return;
    if(a.cargoKind==='queenMeal'){a.task='feedingQueen';this.feedQueen(a);return;}
    if(a.carryingBrood){a.task='carryingBrood';this.carryBrood(a);return;}
    if(a.carried){a.task=a.cargoKind==='soil'?'haulingSoil':a.cargoKind==='water'?'returningWater':'returningFood';if(a.cargoKind==='soil')this.headOut(a);else this.send(a,this.world.nest);return;}
    if((a.energy<.28&&this.food>0)||(a.hydration<.25&&this.water>0)){a.task='resting';a.busyUntil=this.time+10;this.send(a,idlePlace(this.world,a)??a.cell);a.decision='Low individual energy or hydration takes priority over colony work.';return;}
    if((a.energy<.28&&this.food<=0)||(a.hydration<.25&&this.water<=0)){a.foragingKind=a.hydration<.25&&this.water<=0?'water':'food';a.lastJob=a.foragingKind==='water'?'water':'forage';a.task='exploring';a.decision='Reserves are exhausted. Searching for the resource needed for survival.';if(!this.discover(a))this.explore(a);return;}
    if(this.assignQueenCare(a))return;
    this.sense(a);const n=this.needsFor(a),local={...a.brain.senses};
    this.proposeConstruction(a,n);
    if(this.world.construction.length&&a.skills.dig>0)local.construction=(local.construction??0)+.4;
    const scores=taskScores(a,n,{brood:local.brood??0,alarm:local.alarm??0,construction:local.construction??0},this.time,this.brood.length>0);
    if(!this.world.construction.length)scores.find(s=>s[0]==='dig')[1]=0;
    if(n.forage>1||n.water>.85){scores.find(s=>s[0]==='forage')[1]*=1.7;scores.find(s=>s[0]==='water')[1]*=1.7;}
    for(const score of scores)score[1]*=.65+this.rng.float()*.7;
    scores.sort((x,y)=>y[1]-x[1]);
    if(scores[0][1]<.24&&this.rng.float()>.08+a.traits.exploration*.06&&!(a.brain.recruitUntil>this.time&&(n.forage>.15||n.water>.15))){
      a.task=adultDays(a)>7?'reserve':this.rng.float()<.3?'grooming':'resting';a.busyUntil=this.time+this.rng.int(4,12);
      const waiting=idlePlace(this.world,a);if(waiting)this.send(a,waiting);
      a.decision='Low work stimuli: waiting as a recruitable reserve. Antennal contact or new needs can reactivate work.';rememberTask(a,'reserve',this.time);return;
    }
    for(const [job,score] of scores){
      if(score<=0)continue;
      if(job==='defend'){
        a.task='investigating';a.guardUntil=this.time+8;a.busyUntil=this.time+1;a.decision='A nearby alarm cue triggered a short investigation. It expires rather than becoming a permanent guard role.';rememberTask(a,job,this.time);return;
      }
      if(job==='dig'&&this.assignDig(a)){rememberTask(a,job,this.time);return;}
      if(job==='care'&&this.assignCare(a)){rememberTask(a,job,this.time);return;}
      if(job==='forage'||job==='water'){
        if(job==='forage'&&n.forage<.15||job==='water'&&n.water<.15)continue;
        a.foragingKind=job==='water'?'water':'food';a.wantProtein=job==='forage'&&(n.protein??0)>(n.energy??0);a.task='exploring';a.lastJob=job;a.jobSince=this.time;
        a.decision='Integrating remembered nutritional need, local chemical cues, body size, age, and successful experience.';rememberTask(a,job,this.time);
        if(!this.discover(a))this.explore(a);return;
      }
    }
    a.task='resting';a.busyUntil=this.time+6;const resting=idlePlace(this.world,a);if(resting)this.send(a,resting);
  }
  proposeConstruction(a,needs){
    const w=this.world;if(this.time<(this.proposalAt??0)||a.caste==='queen')return;
    const drought=(this.waterPressure??0)>.3||needs.water>.65&&!w.weather.raining;
    if(drought&&planMoistureShaft(w,this.rng,this.time)){this.record(antName(a)+' initiated a short downward moisture probe.');this.proposalAt=this.time+5;return;}
    if(w.construction.length)return;
    this.proposalAt=this.time+3;
    let proposed=false,cause='';
    if(a.skills.dig>0&&w.soilDeposited>=16&&this.time-w.lastMoundPlan>DAY*.3){proposed=planMoundPassage(w,this.rng,this.time);cause='a sheltered passage inside accumulated mound soil';}
    if(!proposed&&this.ants.length>22&&w.entrances.length<Math.min(4,1+Math.floor(this.ants.length/35))&&this.time-w.lastAccessPlan>DAY){proposed=planPeripheralExit(w,this.rng,this.time);cause='an additional narrow peripheral foraging mouth';}
    if(!proposed&&needs.dig>.05){proposed=w.planRoom(this.rng,this.storageBlocked?'storage':(this.freeBeds??10)<6||(a.brain.senses.brood??0)>.12?'nursery':'storage',a.cell);cause='additional chamber space near a used passage';}
    if(proposed){this.storageBlocked=false;this.proposalAt=this.time+12;a.brain.lastProposal=cause;this.record(antName(a)+' initiated '+cause+'.');}
  }
  assignCare(a){
    this.careClaims??=new Map();if(this.careClaims.get(a.broodID)===a.id)this.careClaims.delete(a.broodID);
    this.sense(a);const meal=a.cargoKind==='broodMeal'&&a.carried;if(!meal&&a.socialProtein<.025&&this.brood.some(b=>broodStage(b)==='larva'&&b.nutrition<.7)&&this.assignCache(a,'care',true))return true;
    if(!meal&&this.assignQueenCare(a))return true;
    if(!meal&&this.assignBroodTransport(a))return true;
    const targets=this.careCandidates(a).filter(b=>b.carriedBy==null&&!this.broodClaims.has(b.id)&&!this.careClaims.has(b.id)&&!(a.careAvoid?.id===b.id&&this.time<a.careAvoid.until)&&(!meal||broodStage(b)==='larva'&&b.nutrition<.95)&&(a.knownBrood.includes(b.id)||distance(a.cell,b.cell)<3.1)).map(b=>({b,priority:distance(a.cell,b.cell)*2-Math.min(20,Math.max(0,this.time-b.lastCare)*.05)-(broodStage(b)==='larva'?(1-b.nutrition)*40:0)})).sort((x,y)=>x.priority-y.priority).map(item=>item.b);
    for(const b of targets.slice(0,6)){const stance=nearestStance(this.world,a,b.cell);const route=stance?routeAroundItems(this.world,a,stance):null;if(route){if(a.lastJob!=='care')a.jobSince=this.time;a.task='nursing';a.route=route;a.target=[...b.cell];a.destination=[...b.cell];a.broodID=b.id;this.careClaims.set(b.id,a.id);a.lastJob='care';return true;}}
    if(meal)return false;
    const gradient=this.world.neighbors(a.cell).filter(c=>!this.world.onSurface(c)).sort((x,y)=>senseSignal(this.world,'brood',y)-senseSignal(this.world,'brood',x));
    if(gradient[0]&&senseSignal(this.world,'brood',gradient[0])>.04){a.task='nursing';a.broodID=null;this.send(a,gradient[0]);return true;}return false;
  }
  assignDig(a){
    const sites=this.world.frontier().filter(c=>!this.reserved.has(key(c))).sort((x,y)=>distance(x,a.cell)-distance(y,a.cell));
    for(const site of sites.slice(0,8))for(const neighbor of adjacent(site).filter(n=>this.world.walkable(n)).sort((x,y)=>distance(x,a.cell)-distance(y,a.cell))){
      const route=routeAroundItems(this.world,a,neighbor);if(route){a.task='toDig';a.route=route;a.destination=[...neighbor];a.target=[...site];a.lastJob='dig';this.reserved.add(key(site));return true;}
    }return false;
  }
  discover(a){
    const kind=a.foragingKind??'food';
    // Only current sensory range exposes a patch's true availability.
    const sensed=this.world.patches.filter(p=>p.amount>.001&&distance(p.cell,a.cell)<=4.5&&(this.world.onSurface(a.cell)||p.origin==='seep')); 
    const preference=p=>p.kind!==kind?-10:p.kind==='water'?1:a.wantProtein?(p.nutrition?.protein??.3)*3:(p.nutrition?.energy??.7)*2;
    sensed.sort((x,y)=>(distance(x.cell,a.cell)*.12-preference(x))-(distance(y.cell,a.cell)*.12-preference(y))||x.id-y.id);
    let target=sensed.find(p=>p.kind===kind&&(kind!=='food'||!a.wantProtein||(p.nutrition?.protein??0)>.4));
    if(target){a.sourceID=target.id;this.learn(a,target.cell,target.kind);}
    if(target?.kind==='food')a.sourceQuality=preference(target);
    if(!target){
      const memories=a.memories.filter(m=>m.kind===kind&&(kind!=='food'||!a.wantProtein||(m.nutrition?.protein??0)>.4)&&m.confidence>.2&&(m.avoidUntil??0)<=this.time&&this.time-m.lastSeen<DAY*6).sort((x,y)=>y.confidence-x.confidence);
      if(memories[0])target={cell:memories[0].cell,kind:memories[0].kind};

    }
    if(!target)return false;
    a.task=target.kind==='food'?'toFood':'toWater';const piece=target.pieces?.slice().sort((p,q)=>distance(p.pos,a.pos)-distance(q.pos,a.pos))[0];return this.send(a,(piece?.pos??target.cell).map(Math.round));
  }
  explore(a){
    a.task='exploring';
    if((a.foragingKind==='water')&&(this.waterPressure??0)>.3&&!this.world.inForagingZone(a.cell)){
      if(this.discover(a))return;const choices=this.world.neighbors(a.cell).filter(c=>!this.world.onSurface(c)).map(c=>({c,weight:(c[1]>a.cell[1]?1.8:.7)*Math.exp((this.world.conditions(c).humidity-this.world.conditions(a.cell).humidity)*8)*Math.pow(.22,a.recent.filter(k=>k===key(c)).length)}));
      if(choices.length){let pick=this.rng.float()*choices.reduce((s,p)=>s+p.weight,0),chosen=choices[0].c;for(const p of choices){pick-=p.weight;if(pick<=0){chosen=p.c;break;}}a.recent.push(key(a.cell));a.recent=a.recent.slice(-20);this.send(a,chosen);a.decision='Searching accessible lower passages for local moisture while surface pools are scarce.';return;}
    }
    if(!this.world.inForagingZone(a.cell)){const exit=this.exitFor(a);if(exit){a.route=exit.route;a.target=exit.point;a.destination=exit.point;}else{a.busyUntil=this.time+2;a.decision='No exterior passage is currently accessible. Rechecking the nest routes.';}return;}if(this.discover(a))return;
    if(this.rng.float()<.025)a.heading*=-1;
    const kind=a.foragingKind??'food',trail=this.world.trails[kind],current=trail.get(key(a.cell))??0;
    const choices=this.world.neighbors(a.cell).filter(c=>this.world.inForagingZone(c)).map(c=>{
      const angle=Math.atan2(c[1]-a.pos[1],c[0]-a.pos[0]),forward=Math.exp(Math.cos(wrapAngle(angle-a.motion.angle))*.85),visits=a.recent.filter(id=>id===key(c)).length;
      const concentration=sampleField(trail,c,this.world),gradient=Math.max(0,concentration-current),avoidance=Math.pow(.24,visits),odor=resourceOdor(this.world,c),scent=kind==='food'?odor.food:odor.water,antennaBias=1+Math.sin(wrapAngle(angle-a.motion.angle))*(a.brain.antennae?.contrast??0)*.6;
      return {c,weight:forward*avoidance*antennaBias*(1+gradient*9+concentration*.6+scent*4)*(.85+this.rng.float()*.3)};
    });
    if(!choices.length){a.task='resting';a.busyUntil=this.time+2;return;}
    const total=choices.reduce((sum,v)=>sum+v.weight,0);let pick=this.rng.float()*total,selected=choices[0].c;
    for(const v of choices){pick-=v.weight;if(pick<=0){selected=v.c;break;}}
    a.recent.push(key(a.cell));if(a.recent.length>20)a.recent.shift();a.route=[[...selected]];a.target=[...selected];a.destination=[...selected];
  }
  updateBrood(dt){for(const _ of this.broodTick(dt)){} }
  *broodTick(dt){
    let updated=0;for(const b of this.brood){
      const stage=broodStage(b),condition=this.world.conditions(b.cell);
      if(stage==='larva')b.nutrition=clamp(b.nutrition-dt/(DAY*2));
      const temperature=developmentalRate(condition.temperature),moisture=clamp(1-Math.abs(condition.humidity-.62)*1.8,0,1);
      const care=this.time-b.lastCare<15?1:.78,feeding=stage==='larva'?clamp((b.nutrition-.03)/.22):1;
      b.age+=dt*this.settings.broodRate*temperature*moisture*care*feeding;
      if(broodStage(b)!==stage){b.previousStage=stage;b.stageChangedAt=this.time;}
      if((stage==='larva'&&b.nutrition<.05)||moisture<.2)b.vitality=clamp(b.vitality-dt/DAY*.5);if(++updated%64===0)yield;
    }
    const bornIDs=new Set();let emerged=0;
    for(const b of this.brood.filter(b=>b.age>=BROOD_DURATION&&b.vitality>0))if(this.ants.length<this.settings.populationCap&&b.carriedBy==null){
      const a=initializeBrain(createAnt(b.id,'worker',b.cell,this.world.seed),this.world.seed);
      const quality=clamp((b.fed??2)/3,.35,1);a.bodySize=clamp(a.bodySize*quality,.18,.95);a.caste=a.bodySize>.78?'major':'worker';a.traits.lifeDays=lifespanFor(a,this.world.seed);a.bornAt=this.time;if(!canOccupy(this.world,a,b.cell,a.motion.angle,b.id)){if(canOccupy(this.world,a,b.cell,Math.PI/2,b.id))a.motion.angle=Math.PI/2;else continue;}this.ants.push(a);reindexAdult(this.world,a,a.pos);bedRelease(this,b);bornIDs.add(b.id);this.births++;this.record(antName(a)+' emerged as a '+casteLabel(a).toLowerCase()+'.');if(++emerged%24===0)yield;
    }
    for(const b of this.brood)if(b.vitality<=0)bedRelease(this,b);const lostBrood=this.brood.filter(b=>b.vitality<=0).length;this.broodLost+=lostBrood;
    if(bornIDs.size||lostBrood){this.brood=this.brood.filter(b=>!bornIDs.has(b.id)&&b.vitality>0);refreshItems(this);}
  }
  get eggInterval(){return this.settings.eggRate>0?DAY/(Math.max(3,Math.min(1500,(this.ants.length-1)*.75))*this.settings.eggRate):Infinity;}
  canLay(){const q=this.ants.find(a=>a.caste==='queen');return !!q&&(q.socialFood+Math.max(0,q.socialProtein-.06)*.7)>.2&&q.socialWater>.08&&q.socialProtein>.06&&this.brood.length<Math.max(8,Math.min(Math.ceil(this.settings.populationCap*.9),(this.ants.length-1)*3));}
  layEgg(queen){
    if(!this.canLay()||!this.settings.eggRate)return false;
    const bed=findBed(this.world,queen.cell);if(!bed||distance(bed,queen.cell)>1.6||!spaceForItem(this.world,bed,.17))return false;
    const egg={id:this.nextID++,age:0,cell:[...bed],nutrition:1,vitality:1,lastCare:this.time,laidAt:this.time,needsTransport:true,carriedBy:null,lastMoved:0};this.brood.push(egg);bedOccupy(this,egg,bed);refreshItems(this);
    const used=consumeNutrient(this,queen,'energy',.2);if(used<.2)consumeNutrient(this,queen,'protein',(.2-used)/.7);consumeNutrient(this,queen,'water',.08);consumeNutrient(this,queen,'protein',.06);this.lastEgg=this.time;this.eggsLaid++;queen.laidAt=this.time;
    this.record('The queen laid an egg. A nurse will collect it for the nursery.');return true;
  }
  queenComfort(c){const env=this.world.conditions(c);return Math.abs(env.humidity-.64)*3+Math.abs(env.temperature-27.5)*.08+(this.occupancy.get(key(c))?.length??0)*.025;}
  updateQueen(a){
    if(a.task==='laying'){
      if(this.time>=a.layUntil){const laid=this.layEgg(a);a.task='queenRest';a.queenCheckAt=laid?this.time+8:this.time;}return;
    }
    if(this.canLay()&&this.time-this.lastEgg>=this.eggInterval&&a.health>.4&&(()=>{const bed=findBed(this.world,a.cell);return bed&&distance(bed,a.cell)<=1.6&&spaceForItem(this.world,bed,.17);})()){a.task='laying';a.layUntil=this.time+4;a.decision='Settled in the chamber, laying one egg. Nurses collect it here and carry it to sheltered brood space.';return;}
    if(this.time>=(a.queenCheckAt??0)){
      a.queenCheckAt=this.time+this.rng.int(35,80);
      const candidates=[...this.world.neighbors(a.cell),...this.world.rooms.filter(r=>['queen','nursery'].includes(r.kind)&&this.world.walkable(r.center)).flatMap(r=>[r.center,...adjacent(r.center)])].filter(c=>distance(c,a.cell)<=3.2&&this.world.walkable(c)&&c[1]>this.world.baseSurface(c[0])+4&&canOccupy(this.world,a,c));
      candidates.sort((x,y)=>{const room=p=>{const b=findBed(this.world,p);return b&&distance(b,p)<=1.6&&spaceForItem(this.world,b,.17)?0:3;};return this.queenComfort(x)+room(x)+distance(x,a.cell)*.2-this.queenComfort(y)-room(y)-distance(y,a.cell)*.2;});
      const target=candidates[0];
      if(target&&(this.queenComfort(a.cell)-this.queenComfort(target)>.12||!(()=>{const b=findBed(this.world,a.cell);return b&&distance(b,a.cell)<=1.6&&spaceForItem(this.world,b,.17);})()||this.rng.float()<.3)){
        const choice=target;
        if(choice&&this.send(a,choice)){a.task='queenMoving';a.lastProgressAt=this.time;a.decision='Walking within sheltered chambers, favoring suitable moisture and less crowding.';return;}
      }
    }
    a.task='queenRest';a.decision=this.canLay()?`Resting between eggs. Current laying target: ${(DAY/this.eggInterval).toFixed(1)} eggs per colony day.`:'Conserving resources; egg production waits for food, water, and available brood capacity.';
  }
  assignQueenCare(a){
    if((a.brain?.senses?.alarm??0)>.2&&(a.brain?.arousal??0)>.6)return false;
    const queen=this.ants.find(b=>b.caste==='queen');if(!queen||a.id===queen.id)return false;
    const needFood=foodFill(queen)<socialCapacity(queen)*.8&&(queen.socialFood<.45||queen.socialProtein<.15||queen.energy<.65),needWater=queen.socialWater<.2||(queen.hydration<.65&&queen.socialWater<.1);
    if(!needFood&&!needWater||this.ants.some(b=>b.id!==a.id&&((b.task==='toCache'&&b.cachePurpose==='queen')||b.task==='feedingQueen')&&distance(b.pos,queen.pos)<Math.max(1.4,distance(a.pos,queen.pos))&&this.time-(b.lastProgressAt??0)<20))return false;
    if((foodFill(a)>.35&&needFood)||(a.socialWater>.12&&needWater)){if(this.send(a,queen.cell)){a.task='feedingQueen';a.lastJob='care';return true;}}
    if(needFood)return this.assignCache(a,'queen',queen.socialProtein<.15);return false;
  }
  feedQueen(a){
    const queen=this.ants.find(b=>b.caste==='queen');if(!queen){this.chooseJob(a);return;}
    if(distance(a.pos,queen.pos)>1.4){this.send(a,queen.cell);a.task='feedingQueen';return;}
    shareCrops(this,a,queen,true);consumeSelf(this,queen,1);a.task='grooming';a.busyUntil=this.time+2;a.decision='Shared crop-held food and water directly with the queen.';
  }
  broodComfort(b,c){const env=this.world.conditions(c),stage=typeof b==='string'?b:broodStage(b),idealHumidity=stage==='pupa'?.55:.65,idealTemperature=stage==='egg'?28:stage==='larva'?27.5:29;return Math.abs(env.humidity-idealHumidity)*2+Math.abs(env.temperature-idealTemperature)*.1;}
  broodSite(b){return bedAvailable(this,b,this.nursery);}
  assignBroodTransport(a){
    for(const b of this.careCandidates(a).filter(b=>b.carriedBy==null&&!this.broodClaims.has(b.id)).sort((x,y)=>Number(y.needsTransport)-Number(x.needsTransport)||distance(a.cell,x.cell)-distance(a.cell,y.cell))){
      if(!a.knownBrood.includes(b.id)&&distance(a.cell,b.cell)>3.1)continue;
      if(!b.needsTransport&&this.time-(b.lastMoved??0)<DAY*.5)continue;
      const destination=this.broodSite(b);if(!destination)continue;const ideal=broodStage(b)==='pupa'?.55:.65;
      const improvement=this.broodComfort(b,b.cell)-this.broodComfort(b,destination);
      if(distance(b.cell,destination)<1.5||(!b.needsTransport&&improvement<.10))continue;
      const stance=nearestStance(this.world,a,b.cell);const route=stance?routeAroundItems(this.world,a,stance):null;if(!route)continue;
      holdCell(this.world,destination,'b:'+b.id);this.broodClaims.add(b.id);a.broodID=b.id;a.broodDestination=[...destination];a.task='toBrood';a.route=route;a.target=[...b.cell];a.destination=[...b.cell];a.lastJob='care';a.jobSince=this.time;
      a.decision='Collecting a brood item at its actual location before carrying it to a suitable nursery.';return true;
    }return false;
  }
  collectBrood(a){
    const b=this.broodItem(a.broodID);
    if(!b||b.carriedBy!=null){this.releaseBrood(a);this.chooseJob(a);return;}
    if(distance(a.pos,b.cell)>1.25){this.send(a,b.cell);return;}
    bedRelease(this,b);b.carriedBy=a.id;refreshItems(this);a.carryingBrood=b.id;b.pos=[...a.pos];a.task='carryingBrood';this.carryBrood(a);
  }
  carryBrood(a){
    const b=this.broodItem(a.carryingBrood);
    if(!b){this.releaseBrood(a);this.chooseJob(a);return;}
    if(!a.broodDestination||!this.world.walkable(a.broodDestination)||!freeCell(this.world,a.broodDestination,'b:'+b.id)){if(a.broodDestination)releaseCell(this.world,a.broodDestination,'b:'+b.id);a.broodDestination=this.broodSite(b);if(a.broodDestination&&!holdCell(this.world,a.broodDestination,'b:'+b.id))a.broodDestination=null;}if(!a.broodDestination){a.busyUntil=this.time+1;this.proposeConstruction(a,{...this.needsFor(a),dig:1});return;}
    if(distance(a.pos,a.broodDestination)>1.4){this.send(a,a.broodDestination);return;}
    if(!spaceForItem(this.world,a.broodDestination,Math.max(.31,broodRadius(b)))){releaseCell(this.world,a.broodDestination,'b:'+b.id);a.broodDestination=null;a.busyUntil=this.time+.5;return;}
    if(!bedOccupy(this,b,a.broodDestination)){a.broodDestination=null;return;}delete b.pos;b.home=[...b.cell];b.carriedBy=null;refreshItems(this);b.needsTransport=false;b.lastMoved=this.time;b.lastCare=this.time;
    a.carryingBrood=null;this.broodClaims.delete(b.id);a.task='nursing';a.busyUntil=this.time+2;this.broodMoved++;
    a.decision='Placed brood in the nursery. Now grooming and tending it.';
  }

  place(kind,x){if(!['food','water'].includes(kind))return;this.world.place(kind,x);this.record(kind==='food'?'Finite insect pieces and nectar placed. Ants must discover and carry them.':'A water source appeared on the surface.');}
  toJSON(){
    const {occupancy,reserved,broodClaims,careClaims,broodIDs,broodSource,broodByID,localBrood,indexedBrood,...data}=this;return {...data,food:this.food,protein:this.protein,water:this.water,world:this.world.toJSON(),rng:{state:this.rng.state}};
  }
  static fromJSON(d){
    if(!d||!Number.isFinite(d.time)||d.time<0||!Number.isFinite(d.food)||!Number.isFinite(d.water)||!Array.isArray(d.ants)||d.ants.length>LIMIT)throw Error('Invalid colony save');
    if(new Set(d.ants.map(a=>a.id)).size!==d.ants.length||d.ants.some(a=>!Array.isArray(a.pos)||a.pos.some(n=>!Number.isFinite(n))))throw Error('Invalid ant data');
    const legacy=![2,3,4].includes(d.modelVersion),preV3=![3,4].includes(d.modelVersion),preV4=d.modelVersion!==4,c=new Colony(d.world.seed,d.settings);const {food,protein,water,...saved}=d;Object.assign(c,saved);
    c.settings=settingsFrom(d.settings);c.world=World.fromJSON(d.world,legacy);c.rng=new Random(d.rng.state);c.modelVersion=4;c.species=SPECIES.scientific;
    c.ants=d.ants.map(a=>{const ant=normalizeAnt(a,c.world.seed),life=ant.traits.lifeDays*(ant.caste==='queen'?35:ant.caste==='major'?1.4:1);initializeBrain(ant,c.world.seed);if(preV4)ant.traits.lifeDays=Math.max(life,adultDays(ant)+10);return ant;});
    c.brood=d.brood.map(b=>({...b,age:migrateBroodAge(b.age,d.modelVersion),carriedBy:b.carriedBy??null,needsTransport:b.needsTransport??false,nutrition:b.nutrition??1,vitality:b.vitality??1,lastCare:b.lastCare??c.time}));
    c.eggsLaid=d.eggsLaid??0;c.broodLost=d.broodLost??0;c.recruitments=d.recruitments??0;c.occupancy=new Map();c.reserved=new Set();c.broodClaims=new Set();c.careClaims=new Map();c.broodMoved=d.broodMoved??0;
    if(preV3)for(const a of c.ants){a.cargoKind=a.carried?(a.task==='haulingSoil'?'soil':a.task==='returningWater'?'water':'food'):null;a.destination=a.route.at(-1)??null;a.lastProgressAt=c.time;a.lastProgressPos=[...a.pos];}
    if(preV4)for(const a of c.ants){a.knownNeeds=null;a.needsAt=-100;if(a.task==='patrolling'){a.task='reserve';a.route=[];a.busyUntil=c.time;}a.cargoNutrition??=NUTRITION.mixed;}
    if(preV4||!c.demand)c.lastDemand=-10;
    if(legacy){
      for(const a of c.ants){if(!['queen','haulingSoil','returningFood','returningWater'].includes(a.task)){a.route=[];a.target=null;a.task=a.caste==='queen'?'queen':'resting';a.busyUntil=c.time;}a.knownNeeds=null;}
    }
    if(c.world.repairedMound){
      for(const a of c.ants){if(c.world.inForagingZone(a.cell)){a.cell=[a.cell[0],c.world.surface(a.cell[0])-1];a.pos=[...a.cell];}if(!c.world.walkable(a.cell)){const safe=[...c.world.excavated].map(cell).filter(p=>c.world.walkable(p)).sort((p,q)=>distance(p,a.cell)-distance(q,a.cell))[0]??c.world.nest;a.cell=[...safe];a.pos=[...safe];}a.route=[];a.destination=null;a.lastProgressAt=c.time;}
      for(const b of c.brood){const carrier=c.ants.find(a=>a.id===b.carriedBy);if(carrier){b.cell=[...carrier.cell];b.pos=[...carrier.pos];}else if(!c.world.walkable(b.cell)||c.world.inForagingZone(b.cell)){b.cell=[...c.nursery];b.home=[...b.cell];delete b.pos;b.needsTransport=false;}}
      c.broodSites=null;c.record('The old unstable mound settled into a lower slope. Its soil and colony were retained.');
    }c.foodItems=d.foodItems??[];c.nextFoodID=d.nextFoodID??0;initializeSupplies(c,d.supplyVersion?null:{food:d.food,protein:d.protein??Math.max(5,c.ants.length*.25),water:d.water});if(d.supplyVersion&&d.nutrition){for(const k of ['energy','protein','water'])if(!Number.isFinite(d.nutrition[k])||Math.abs(c.nutrition[k]-d.nutrition[k])>1e-5)throw Error('Saved supplies do not match their physical items');c.nutrition={...d.nutrition};}c.world.groundwater.targetDepth=c.settings.waterTableDepth;if(preV4||!c.demand)c.updateDemand();settleAdults(c);if(!d.trafficVersion)for(const b of c.brood)if(c.world.neighbors(b.cell).length<=2)b.needsTransport=true;return c;
  }
}

function migrateBroodAge(age,version){
  if(version===4)return age;const oldDuration=version===3?38*DAY:version===2?28*DAY:150;
  const boundaries=version===3?[0,8/38,27/38,1]:[0,.22,.65,1],target=[0,8*DAY,18*DAY,30*DAY],progress=age/oldDuration;
  for(let i=0;i<3;i++)if(progress<boundaries[i+1])return target[i]+(progress-boundaries[i])/(boundaries[i+1]-boundaries[i])*(target[i+1]-target[i]);
  return BROOD_DURATION+Math.max(0,progress-1)*BROOD_DURATION;
}
