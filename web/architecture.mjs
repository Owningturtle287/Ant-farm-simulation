import {Random} from './biology.mjs';
const key=c=>c.join(','),same=(a,b)=>key(a)===key(b);
export {curvedPassage as passage} from './geometry.mjs';
import {curvedPassage as passage} from './geometry.mjs';
function entrancePassage(w,anchor,elbow,mouth,rng){
  const sheltered=[];
  let previous=anchor;
  for(const [x,y] of passage(anchor,elbow,rng)){
    const point=[x,Math.max(y,w.baseSurface(x)+2)];
    if(x!==previous[0]){
      // Cross between columns at the deeper endpoint to preserve the roof.
      const depth=Math.max(previous[1],point[1]);
      for(let by=previous[1]+1;by<=depth;by++)sheltered.push([previous[0],by]);
      for(let by=depth;by>point[1];by--)sheltered.push([x,by]);
    }else{
      for(let by=Math.min(point[1],previous[1])+1;by<Math.max(point[1],previous[1]);by++)sheltered.push([x,by]);
    }
    sheltered.push(point);previous=point;
  }
  // Only the mouth column breaks the exterior.
  for(let y=previous[1]-1;y>=mouth[1];y--)sheltered.push([mouth[0],y]);
  return sheltered;
}
export function founderNest(w){
  const rng=new Random(w.seed^0x192fa),side=rng.float()<.5?-1:1,mouthX=side*rng.int(8,13),depth=rng.int(2,4);
  w.rooms=[{kind:'queen',center:[0,11],rx:2,ry:1},{kind:'nursery',center:[-4,12],rx:2,ry:1},{kind:'storage',center:[4,10],rx:2,ry:1}];
  for(const room of w.rooms)w.carve(room.center,room.rx,room.ry);
  for(const room of w.rooms)for(const c of passage(w.nest,room.center,rng))w.excavated.add(key(c));
  const mouth=[mouthX,w.baseSurface(mouthX)-1],elbow=[mouthX,w.baseSurface(mouthX)+depth];
  const route=entrancePassage(w,w.nest,elbow,mouth,rng);
  for(const c of route)if(c[1]>=w.baseSurface(c[0]))w.excavated.add(key(c));
  w.entrances=[{mouth,state:'open',createdAt:0}];w.moundTunnels=new Set();w.soilRehandled=0;w.lastAccessPlan=0;w.lastMoundPlan=0;
}
export function closedFounderNest(w){
  w.rooms=[{kind:'queen',center:[...w.nest],rx:5.8,ry:3.2}];
  w.carve(w.nest,5.8,3.2);
  w.entrances=[];w.moundTunnels=new Set();w.soilRehandled=0;w.lastAccessPlan=0;w.lastMoundPlan=0;
  w.founding={tip:null,target:null,stockpile:[w.nest[0],w.nest[1]+1],pellets:[]};
}

export function planFirstExit(w,worker){
  const founding=w.founding;
  if(founding.target&&w.solid(founding.target)){
    queuePassage(w,[founding.target]);return true;
  }
  // The first worker chooses a reachable ceiling. Later workers extend its work face.
  const roof=founding.tip?[founding.tip]:[...w.excavated].map(id=>id.split(',').map(Number));
  let target=null,score=Infinity;
  for(const [x,y] of roof){
    const above=[x,y-1];
    if(!w.solid(above)||!w.path(worker.cell,[x,y]))continue;
    const effort=Math.hypot(x-worker.cell[0],y-worker.cell[1])*.24+w.digTime(above,worker.skills.dig);
    const cost=y*2+effort+w.conditions(above).humidity*.35;
    if(cost<score){target=above;score=cost;}
  }
  if(!target)return false;
  if(!founding.tip){
    const stock=[...w.excavated].map(id=>id.split(',').map(Number))
      .filter(([x,y])=>Math.abs(x-target[0])>=1&&y>=target[1]+2&&w.neighbors([x,y]).length>=5)
      .sort((a,b)=>Math.hypot(a[0]-target[0],a[1]-target[1])-Math.hypot(b[0]-target[0],b[1]-target[1]));
    if(stock[0])founding.stockpile=stock[0];
  }
  founding.target=target;worker.brain.lastProposal='an upward step at the shared digging face';
  queuePassage(w,[target]);return true;
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
  queuePassage(w,entrancePassage(w,anchor?.center??w.nest,best.elbow,best.mouth,rng));
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

export function planMoistureShaft(w,time){
  const g=w.groundwater;if(!g||time-g.lastPlan<20)return false;
  if(w.waterDig&&w.solid(w.waterDig.tip)&&w.construction.some(c=>same(c,w.waterDig.tip)))return false;
  const known=[...w.excavated].map(s=>s.split(',').map(Number)).filter(c=>w.walkable(c)&&c[1]>w.baseSurface(c[0])+5);
  const previous=w.waterDig?.tip;
  const priority=([x,y])=>y+Math.min(4,Math.abs(x-w.nest[0]))*.75;
  known.sort((a,b)=>Number(!!previous&&same(b,previous))-Number(!!previous&&same(a,previous))||priority(b)-priority(a));
  // A new probe follows a reachable, moist working face. The last cut opens the saturated soil.
  const origin=known.find(([x,y])=>w.solid([x,y+1])&&w.path(w.nest,[x,y]));
  if(!origin)return false;
  const [x,y]=origin,route=[];
  if(!w.surfaceWater&&!w.waterSpoil){
    const storage=known.filter(c=>Math.abs(c[0]-x)>1&&Math.abs(c[0]-w.nest[0])>1&&w.neighbors(c).length>=5)
      .sort((a,b)=>Math.hypot(a[0]-x,a[1]-y)-Math.hypot(b[0]-x,b[1]-y))[0];
    w.waterSpoil={stockpile:storage??[...w.nest],pellets:[]};
  }
  for(let step=1;step<=3;step++){
    const c=[x,y+step];route.push(c);
    if(c[1]>=w.waterTable(x)-.25)break;
  }
  queuePassage(w,route);g.lastPlan=time;w.waterDig={tip:route.at(-1),cells:route,startedAt:time};return true;
}
