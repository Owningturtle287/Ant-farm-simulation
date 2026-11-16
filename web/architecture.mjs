import {Random} from './biology.mjs';
const key=c=>c.join(','),same=(a,b)=>key(a)===key(b);
export {curvedPassage as passage} from './geometry.mjs';
import {curvedPassage as passage} from './geometry.mjs';
export function founderNest(w){
  const rng=new Random(w.seed^0x192fa),side=rng.float()<.5?-1:1,mouthX=side*rng.int(8,13),depth=rng.int(2,4);
  w.rooms=[{kind:'queen',center:[0,11],rx:2,ry:1},{kind:'nursery',center:[-4,12],rx:2,ry:1},{kind:'storage',center:[4,10],rx:2,ry:1}];
  for(const room of w.rooms)w.carve(room.center,room.rx,room.ry);
  for(const room of w.rooms)for(const c of passage(w.nest,room.center,rng))w.excavated.add(key(c));
  const mouth=[mouthX,w.baseSurface(mouthX)-1],elbow=[mouthX,w.baseSurface(mouthX)+depth];
  const route=[...passage(w.nest,elbow,rng),...passage(elbow,mouth,rng)];
  for(const c of route)if(c[1]>=w.baseSurface(c[0]))w.excavated.add(key(c));
  w.entrances=[{mouth,state:'open',createdAt:0}];w.moundTunnels=new Set();w.soilRehandled=0;w.lastAccessPlan=0;w.lastMoundPlan=0;
}
export function queuePassage(w,route){
  const known=new Set(w.construction.map(key));
  for(const c of route)if(w.solid(c)&&!known.has(key(c))){w.construction.push(c);known.add(key(c));}
  w.frontierVersion=-1;
}
export function planPeripheralExit(w,rng,time){
  const candidates=[];
  for(let i=0;i<12;i++){
    const x=(rng.float()<.5?-1:1)*rng.int(8,22+Math.floor(w.soilDeposited/80));
    if(w.entrances.some(e=>Math.abs(e.mouth[0]-x)<7)||w.surface(x)<w.baseSurface(x))continue;
    const mouth=[x,w.baseSurface(x)-1],elbow=[x,w.baseSurface(x)+rng.int(2,4)];
    candidates.push({mouth,elbow,score:Math.abs(x)*.05+w.conditions(elbow).humidity});
  }
  candidates.sort((a,b)=>a.score-b.score);const best=candidates[0];if(!best)return false;
  const anchor=w.rooms.filter(r=>w.walkable(r.center)).sort((a,b)=>Math.abs(a.center[0]-best.mouth[0])-Math.abs(b.center[0]-best.mouth[0]))[0];
  queuePassage(w,[...passage(anchor?.center??w.nest,best.elbow,rng),...passage(best.elbow,best.mouth,rng)]);
  w.entrances.push({mouth:best.mouth,state:'planned',createdAt:time});w.lastAccessPlan=time;return true;
}
export function planMoundPassage(w,rng,time){
  // A gallery needs a real roof and lateral soil, and may use only a small share of the mound volume.
  const covered=[...w.moundTunnels].filter(id=>w.coveredMound(id.split(',').map(Number))),budget=Math.floor(w.deposits.size*.16);
  if(budget-covered.length<3)return false;
  const candidates=[...w.deposits].map(s=>s.split(',').map(Number)).filter(c=>c[1]<w.baseSurface(c[0])&&w.solid([c[0],c[1]-1])&&w.solid([c[0],c[1]-2])&&[-2,-1,1,2].every(dx=>w.solid([c[0]+dx,c[1]])));
  for(let attempt=0;attempt<Math.min(candidates.length,16);attempt++){
    const goal=candidates[rng.int(0,candidates.length-1)];if(covered.some(id=>{const [x,y]=id.split(',').map(Number);return Math.hypot(x-goal[0],y-goal[1])<4;}))continue;
    const foot=[goal[0],w.baseSurface(goal[0])+1],anchors=[...w.excavated].map(id=>id.split(',').map(Number)).filter(c=>w.walkable(c));anchors.sort((a,b)=>Math.hypot(a[0]-foot[0],a[1]-foot[1])-Math.hypot(b[0]-foot[0],b[1]-foot[1]));
    const anchor=anchors[0]??w.nest,route=[...passage(anchor,foot,rng),...passage(foot,goal,rng)],above=route.filter(c=>c[1]<w.baseSurface(c[0]));
    const removed=above.filter(c=>w.deposits.has(key(c)));
    if(!removed.length||covered.length+removed.length>budget||above.some(c=>!w.solid([c[0],c[1]-1])&&!w.moundTunnels.has(key(c))))continue;
    queuePassage(w,route);w.rooms.push({kind:'mound',center:goal,rx:1,ry:1});w.lastMoundPlan=time;return true;
  }return false;
}

export function planMoistureShaft(w,rng,time){
  const g=w.groundwater;if(!g||time-g.lastPlan<20)return false;
  if(w.waterDig&&w.solid(w.waterDig.tip)&&w.construction.some(c=>same(c,w.waterDig.tip)))return false;
  const known=[...w.excavated].map(s=>s.split(',').map(Number)).filter(c=>w.walkable(c)&&c[1]>w.baseSurface(c[0])+5);
  if(!known.length)return false;known.sort((a,b)=>b[1]-a[1]||Math.abs(a[0])-Math.abs(b[0]));const origin=known[0];
  if(w.conditions([origin[0],origin[1]+1]).humidity>.947)return false;
  // Short, locally sampled probes: no remote water coordinates are given to a worker.
  const options=[-1,0,1].map(dx=>[origin[0]+dx,origin[1]+3]);options.sort((a,b)=>w.conditions(b).humidity-w.conditions(a).humidity);
  const target=options[0],route=passage(origin,target,rng).filter(c=>w.conditions(c).humidity<.947);if(!route.some(c=>w.solid(c)))return false;
  queuePassage(w,route);g.lastPlan=time;w.waterDig={tip:[...route.at(-1)],startedAt:time};return true;
}
