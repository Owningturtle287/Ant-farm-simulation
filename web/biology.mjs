// Tunable, accelerated biological model. One colony day is ten simulation minutes.
export const DAY=600;
export const BROOD_DURATION=38*DAY;
export const LIMIT=500;
export const DEFAULT_SETTINGS=Object.freeze({startingWorkers:12,populationCap:120,eggRate:1,broodRate:1});
export const SPEEDS=Object.freeze([1,2,4,8,16,32,64,128]);
export const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
export class Random {
  constructor(seed=287){this.state=seed>>>0 || 287;}
  next(){let n=this.state;n^=n<<13;n^=n>>>17;n^=n<<5;this.state=n>>>0;return this.state;}
  int(min,max){return min+this.next()%(max-min+1);}
  float(){return this.next()/4294967296;}
}
export function settingsFrom(data={}) {
  const number=(name,min,max)=>Number.isFinite(Number(data[name]))?clamp(Number(data[name]),min,max):DEFAULT_SETTINGS[name];
  return {startingWorkers:Math.round(number('startingWorkers',4,40)),populationCap:Math.round(number('populationCap',20,LIMIT)),eggRate:number('eggRate',0,4),broodRate:number('broodRate',.1,8)};
}
export function traitsFor(id,seed){
  const r=new Random((Math.imul(id+1,2654435761)^(seed>>>0))>>>0);
  return {forage:.45+r.float()*.8,water:.45+r.float()*.8,care:.45+r.float()*.8,dig:.45+r.float()*.8,activity:.55+r.float()*.45,exploration:.3+r.float()*.7,lifeDays:90+r.float()*90};
}
export function createAnt(id,caste,c,seed=287,initialAgeDays=0){
  return {id,caste,cell:[...c],pos:[...c],route:[],target:null,memory:null,memories:[],task:caste==='queen'?'queen':'resting',energy:1,hydration:1,health:1,
    age:0,initialAgeDays,experience:0,carried:0,cargoMaterial:null,busyUntil:0,trips:0,bornAt:0,traits:traitsFor(id,seed),skills:{forage:0,care:0,dig:0},
    knownNeeds:null,needsAt:-100,perceptionAt:0,encounterAt:0,heading:id%2?1:-1,destination:null,cargoKind:null,routeFailures:0,lastProgressAt:0,lastProgressPos:[...c],carryingBrood:null,recent:[],lastJob:null,decision:'Settling into the colony.',sourceAt:0};
}
export const adultDays=ant=>(ant.initialAgeDays??0)+ant.age/DAY;
export function broodStage(b){return b.age<BROOD_DURATION*(8/38)?'egg':b.age<BROOD_DURATION*(27/38)?'larva':'pupa';}
export function normalizeAnt(a,seed){
  const caste=a.caste==='soldier'?'major':a.caste;
  const base=createAnt(a.id,caste,a.cell,seed,a.initialAgeDays??(caste==='queen'?60:1+(a.id*11)%18));
  const ant={...base,...a,caste,traits:{...base.traits,...a.traits},skills:{...base.skills,...a.skills}};
  if(!ant.memories.length && ant.memory)ant.memories=[{cell:[...ant.memory],kind:'food',confidence:.65,lastSeen:0,failures:0}];
  return ant;
}
