import {Random} from './biology.mjs';
const key=c=>c.join(','),same=(a,b)=>key(a)===key(b);
export function passage(start,end,rng){
  const c=[...start],route=[];let guard=0;
  while(!same(c,end)&&guard++<1000){
    const axis=c[0]===end[0]?1:c[1]===end[1]?0:rng.float()<.67?1:0;
    c[axis]+=Math.sign(end[axis]-c[axis]);route.push([...c]);
  }return route;
}
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
  const candidates=[...w.deposits].map(s=>s.split(',').map(Number)).filter(c=>w.solid([c[0],c[1]-1])&&w.solid([c[0],c[1]+1])&&c[1]<w.baseSurface(c[0]));
  if(!candidates.length)return false;const goal=candidates[rng.int(0,candidates.length-1)],foot=[goal[0],w.baseSurface(goal[0])+1];
  queuePassage(w,[...passage(w.nest,foot,rng),...passage(foot,goal,rng)]);
  if(!w.rooms.some(r=>r.kind==='mound'&&Math.abs(r.center[0]-goal[0])<3))w.rooms.push({kind:'mound',center:goal,rx:1,ry:1});
  w.lastMoundPlan=time;return true;
}
