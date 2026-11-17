// Physical cutaway occupancy: antennae may touch; bodies and grounded items may not overlap.
import {densityAt} from './geometry.mjs';
import {broodStage} from './biology.mjs';
import {bodyRoute} from './body-routing.mjs';
const key=p=>p.join(','),bin=p=>Math.floor(p[0])+','+Math.floor(p[1]);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const bodyShape=a=>a.caste==='queen'?{half:.30,radius:.15}:{half:.18+.04*(a.bodySize??.4),radius:.09+.015*(a.bodySize??.4)};
export const broodRadius=b=>broodStage(b)==='egg'?.16:broodStage(b)==='larva'?.27:.30;
function axis(a,p=a.pos,angle=a.motion?.angle??0){const s=bodyShape(a),dx=Math.cos(angle)*s.half,dy=Math.sin(angle)*s.half;return [[p[0]-dx,p[1]-dy],[p[0]+dx,p[1]+dy]];}
function pointSegment(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));return Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-y*t);}
export function bodyGap(a,b,p=a.pos,angle=a.motion?.angle??0){if(!bodyShape(a).half&&!bodyShape(b).half)return dist(p,b.pos)-bodyShape(a).radius-bodyShape(b).radius;const [u,v]=axis(a,p,angle),[s,t]=axis(b),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const crossing=cross(u,v,s)*cross(u,v,t)<0&&cross(s,t,u)*cross(s,t,v)<0;return (crossing?0:Math.min(pointSegment(u,s,t),pointSegment(v,s,t),pointSegment(s,u,v),pointSegment(t,u,v)))-bodyShape(a).radius-bodyShape(b).radius;}
function insert(map,o,p){const k=bin(p);if(!map.has(k))map.set(k,new Set());map.get(k).add(o);}
function around(map,p,r=2){const out=[];for(let y=Math.floor(p[1])-r;y<=Math.floor(p[1])+r;y++)for(let x=Math.floor(p[0])-r;x<=Math.floor(p[0])+r;x++)for(const o of map.get(x+','+y)??[])out.push(o);return out;}
export function refreshItems(c,force=true){const t=c.world.traffic;if(!t||(!force&&!t.itemDirty))return;t.itemDirty=false;const list=[];for(const b of c.brood)if(b.carriedBy==null)list.push({pos:b.cell,radius:.31,kind:'brood',id:b.id});for(const p of c.foodItems)list.push({pos:p.pos,radius:.115,kind:'food',id:p.id});for(const p of c.world.patches)for(const q of p.pieces??[])list.push({pos:q.pos,radius:.10,kind:p.kind,id:p.id});
  let hash=2166136261;for(const o of list){hash=Math.imul(hash^Math.round(o.pos[0]*300),16777619);hash=Math.imul(hash^Math.round(o.pos[1]*300+o.radius*1000),16777619);}hash^=list.length;
  if(t.itemHash!==hash){t.itemHash=hash;t.items=new Map();for(const o of list)insert(t.items,o,o.pos);t.routes.clear();t.bodyNavigation=null;c.world.neighborCache.clear();c.world.pathCache.clear();}
}
export function beginTraffic(c){const w=c.world,old=w.traffic,changed=!old||old.broodRef!==c.brood||old.foodRef!==c.foodItems||old.patchRef!==w.patches||old.broodCount!==c.brood.length||old.foodCount!==c.foodItems.length||old.patchCount!==w.patches.length;w.traffic={adults:new Map(),items:old?.items??new Map(),routes:old?.geometry===w.revision?old.routes:new Map(),bodyNavigation:old?.geometry===w.revision?old.bodyNavigation:null,itemHash:old?.itemHash,itemDirty:changed||old?.itemDirty,broodRef:c.brood,foodRef:c.foodItems,patchRef:w.patches,broodCount:c.brood.length,foodCount:c.foodItems.length,patchCount:w.patches.length,geometry:w.revision,colony:c};refreshItems(c,false);for(const a of c.ants)insert(w.traffic.adults,a,a.pos);}
export function reindexAdult(w,a,old){if(!w.traffic)return;w.traffic.adults.get(bin(old))?.delete(a);insert(w.traffic.adults,a,a.pos);}
export function foodSupport(w,p){return !!w.traffic&&around(w.traffic.items,p,1).some(o=>o.kind==='food'&&Math.abs(o.pos[0]-p[0])<1.05&&Math.abs(o.pos[1]-p[1])<1.15);}
export function terrainFree(w,p){
  p=[p[0],p[1]];if(densityAt(...p,(x,y)=>w.solid([x,y]))>=.49)return false;
  if(!w.walkable(p.map(Math.round))){const x=Math.floor(p[0]),y=Math.floor(p[1]);let supported=false;for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)if(Math.hypot(p[0]-x-dx,p[1]-y-dy)<.81&&w.walkable([x+dx,y+dy]))supported=true;if(!supported)return false;}return true;
}
export function canOccupy(w,a,p,angle=a.motion?.angle??0,ignoreBrood=null,ignoreAdults=false,escaping=false){
  p=[p[0],p[1]];if(!escaping&&!terrainFree(w,p))return false;
  const [u,v]=axis(a,p,angle),r=bodyShape(a).radius,nx=-Math.sin(angle)*r,ny=Math.cos(angle)*r;

  const t=w.traffic;if(!t)return true;
  for(const o of around(t.items,p,1))if(!(o.kind==='brood'&&o.id===ignoreBrood)&&pointSegment(o.pos,u,v)<r+o.radius-.001)return false;
  if(!ignoreAdults)for(const b of around(t.adults,p,a.caste==='queen'?2:1))if(b.id!==a.id&&dist(b.pos,p)<1.4&&bodyGap(a,b,p,angle)<-.001)return false;
  const queen=t.colony.ants[0];if(queen?.caste==='queen'&&queen.id!==a.id&&dist(queen.pos,p)<1.4&&bodyGap(a,queen,p,angle)<-.001)return false;
  return true;
}
export function sweptFree(w,a,from,to,angle,oldAngle=a.motion?.angle??angle,escaping=false,ignoreAdults=false){const n=Math.max(1,Math.ceil(dist(from,to)/.09),bodyShape(a).half?Math.ceil(Math.abs(Math.atan2(Math.sin(angle-oldAngle),Math.cos(angle-oldAngle)))/.15):1);for(let i=1;i<=n;i++){const t=i/n,delta=Math.atan2(Math.sin(angle-oldAngle),Math.cos(angle-oldAngle));if(!canOccupy(w,a,[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t],oldAngle+delta*t,null,ignoreAdults,escaping))return false;}return true;}
export function nearestStance(w,a,target,range=1.2){
  const candidates=[];if(dist(a.pos,target)<=range&&canOccupy(w,a,a.pos))candidates.push([...a.pos]);for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const p=[target[0]+x*.5,target[1]+y*.5];if(dist(p,target)<=range+.001&&(canOccupy(w,a,p)||canOccupy(w,a,p,0)||canOccupy(w,a,p,Math.PI/2)))candidates.push(p);}
  candidates.sort((x,y)=>dist(x,a.pos)-dist(y,a.pos)||dist(x,target)-dist(y,target));return candidates[0]??null;
}
function cacheRoute(w,id,route){const m=w.traffic.routes;if(m.size>=256)m.delete(m.keys().next().value);m.set(id,route);}
export function routeAroundItems(w,a,target,dynamic=false){
  if(!w.traffic)return w.path(a.cell,target.slice(0,2));let probe={id:a.id,caste:a.caste,bodySize:Math.ceil((a.bodySize??.4)*5)/5,pos:a.pos,motion:a.motion};
  const headings=[a.motion?.angle??0,0,Math.PI/2,Math.PI,-Math.PI/2];if(!canOccupy(w,probe,a.pos,headings[0],null,!dynamic)||!headings.some(angle=>canOccupy(w,probe,target,angle,null,!dynamic)))probe=a;
  const queen=w.traffic.colony.ants.find(b=>b.caste==='queen'),id=key(a.pos)+'@'+a.motion?.angle+'>'+key(target.slice(0,2))+':'+probe.caste+':'+probe.bodySize+':'+(queen?key(queen.pos)+'@'+queen.motion?.angle:'none');
  if(!dynamic&&w.traffic.routes.has(id))return w.traffic.routes.get(id)?.map(p=>[...p])??null;
  const route=bodyRoute(w,probe,target,{canOccupy,sweptFree},dynamic);if(!dynamic)cacheRoute(w,id,route);return route;
}
export function idlePlace(w,a){const queue=[a.cell],seen=new Set([key(a.cell)]);let head=0,best=null,score=-Infinity;const claims=new Set((w.traffic?.colony.ants??[]).filter(b=>b.id!==a.id&&['resting','reserve','grooming'].includes(b.task)&&b.destination).map(b=>key(b.motion?.yieldTarget??b.destination)));while(head<queue.length&&head<90){const p=queue[head++],degree=w.neighbors(p).length;if(canOccupy(w,a,p)&&!claims.has(key(p))&&[[1,0],[-1,0],[0,1],[0,-1]].filter(d=>w.walkable([p[0]+d[0],p[1]+d[1]])).length>=3){const neighbors=around(w.traffic?.adults??new Map(),p,1).length,n=degree-neighbors*3-dist(a.cell,p)*.4+(a.id*17+p[0]*7+p[1]*11)%13*.05;if(n>score){score=n;best=p;}}for(const n of w.neighbors(p))if(!seen.has(key(n))){seen.add(key(n));queue.push(n);}}return best;}
export function spaceForItem(w,pos,radius,ignoreAnt=null){if(!w.traffic)return true;for(const a of around(w.traffic.adults,pos,1))if(a.id!==ignoreAnt){const [u,v]=axis(a);if(pointSegment(pos,u,v)<bodyShape(a).radius+radius+.025)return false;}return true;}
export function settleAdults(c){
  beginTraffic(c);const w=c.world;w.traffic.adults.clear();let annex=0,cursor=0;
  const pool=[...w.excavated,...w.moundTunnels].map(k=>k.split(',').map(Number));
  for(const a of [...c.ants].sort((a,b)=>Number(b.caste==='queen')-Number(a.caste==='queen')||a.id-b.id)){
    if(!canOccupy(w,a,a.pos)){let spot=null;while(cursor<pool.length&&!spot){const p=pool[cursor++];for(const angle of [a.motion?.angle??0,Math.PI/2])if(canOccupy(w,a,p,angle)){spot=p;if(a.motion)a.motion.angle=angle;break;}}
      while(!spot){const x=18+Math.floor(annex/12),y=10+annex%12;annex++;
        const carve=p=>{if(w.solid(p)){w.excavated.add(key(p));w.soilExcavated++;w.soilAbandoned++;w.changed(p);}};
        if(annex===1){let q=[...w.nest];while(q[0]!==x||q[1]!==y){if(q[0]!==x)q[0]+=Math.sign(x-q[0]);else q[1]+=Math.sign(y-q[1]);carve(q);}}
        for(const p of [[x,y],[x,y-1],[x-1,y],[x+1,y],[x,y+1]])carve(p);if(canOccupy(w,a,[x,y]))spot=[x,y];
      }
      a.cell=[...spot];a.pos=[...spot];a.route=[];a.lastProgressPos=[...spot];if(a.motion){a.motion.speed=0;a.motion.recovering=false;}
    }insert(w.traffic.adults,a,a.pos);
  }c.trafficVersion=1;
}
export function unjam(c,a){
  const w=c.world,m=a.motion;if((m.trafficBlocked??0)<1.2||m.yieldingRoute)return;
  if(c.time<(m.nextTrafficPlanAt??0))return;m.nextTrafficPlanAt=c.time+2;
  // Old or invalidated routes may have clear endpoints with blocked connecting edges.
  // Repair the static route once before considering temporary adult traffic.
  if(a.route.length&&a.route[0][3]==null){const goal=a.destination,stance=goal&&(canOccupy(w,a,goal)?goal:nearestStance(w,a,goal));const repair=stance?routeAroundItems(w,a,stance):null;if(repair?.length&&JSON.stringify(repair[0])!==JSON.stringify(a.route[0])){a.route=repair;m.trafficBlocked=0;return;}}
  const goal=a.motion.yieldTarget??a.destination;if(goal){const stance=canOccupy(w,a,goal)?goal:nearestStance(w,a,goal);const detour=stance?routeAroundItems(w,a,stance,true):null;if(detour?.length&&JSON.stringify(detour[0])!==JSON.stringify(a.route[0])){a.route=detour;m.trafficBlocked=0;return;}}
  const near=around(w.traffic.adults,a.pos,1).filter(b=>b.id!==a.id&&dist(b.pos,a.pos)<1.5),rank=b=>(b.caste==='queen'?1e6:0)+(b.carryingBrood?100000:0)+(b.carried?10000:0)-b.id;
  for(const b of near)if(rank(a)>rank(b)&&!b.motion?.yieldingRoute&&(!b.route.length||(b.motion.trafficBlocked??0)>1)){
    const spot=idlePlace(w,b),route=spot?routeAroundItems(w,b,spot):null;
    if(route?.length){b.motion.resumeGoal=b.destination?[...b.destination]:null;b.motion.yieldingRoute=true;b.motion.yieldTarget=spot;b.motion.yieldEnd=c.time+3+route.length;b.route=route;}
  }
  if(near.some(b=>rank(b)>rank(a))){const spot=idlePlace(w,a);if(spot&&dist(spot,a.cell)>0){const route=routeAroundItems(w,a,spot);if(route?.length){m.resumeGoal=a.destination?[...a.destination]:null;m.yieldingRoute=true;m.yieldTarget=spot;m.yieldEnd=c.time+3+route.length;a.route=route;}}}
  if(m.trafficBlocked>8&&w.neighbors(a.cell).length<=3){c.congestionUntil=c.time+15;m.trafficBlocked=0;
    if(a.cell[1]>w.baseSurface(a.cell[0])+3){for(const dx of [-1,1]){const p=[a.cell[0]+dx,a.cell[1]];if(w.solid(p)&&!w.construction.some(q=>key(q)===key(p))){w.construction.push(p,[p[0],p[1]+1]);w.frontierVersion=-1;break;}}}}
}
