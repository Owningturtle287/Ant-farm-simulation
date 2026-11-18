// Only adult body segments and surface portions obstruct adult movement.
import {densityAt} from './geometry.mjs';
import {broodStage} from './biology.mjs';
import {bodyRoute} from './body-routing.mjs';
import {bodyDiscs,bodyPixel} from './body-pose.mjs';
const key=p=>p.join(','),bin=p=>Math.floor(p[0])+','+Math.floor(p[1]);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const CONTACT_SLACK=.002; // Subpixel outline contact; central body space stays protected.
export const bodyShape=a=>({half:15*bodyPixel(a),radius:5.4*bodyPixel(a)});
export const broodRadius=b=>broodStage(b)==='egg'?.16:broodStage(b)==='larva'?.27:.30;
function cross(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function pointSegment(p,a,b){
  const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));
  return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t);
}
function segmentGap(a,b,c,d){
  const intersects=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))
    &&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))
    &&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
  const distance=intersects?0:Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
  return distance-Math.min(a.radius,b.radius)-Math.min(c.radius,d.radius);
}
function poseGap(first,second){
  let gap=Infinity;
  for(const a of first)for(const b of second)gap=Math.min(gap,Math.hypot(a.x-b.x,a.y-b.y)-a.radius-b.radius);
  // The neck and waist close the gaps between the three contact discs.
  for(let i=1;i<3;i++)for(let j=1;j<3;j++)gap=Math.min(gap,segmentGap(first[0],first[i],second[0],second[j]));
  return gap;
}
export function bodyGap(a,b,p=a.pos,angle=a.motion?.angle??0,joints=a.motion){
  const bound=(bodyPixel(a)+bodyPixel(b))*21,distance=dist(p,b.pos);
  return distance>bound?distance-bound:poseGap(bodyDiscs(a,p,angle,joints),bodyDiscs(b));
}
function insert(map,o,p){const k=bin(p);if(!map.has(k))map.set(k,new Set());map.get(k).add(o);}
function around(map,p,r=2){
  const out=[],cx=Math.floor(p[0]),cy=Math.floor(p[1]);
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
    const bucket=map.get(x+','+y);
    if(bucket)for(const o of bucket)out.push(o);
  }
  return out;
}
export function nearbyAdults(w,a,range=1.3){return w.traffic?around(w.traffic.adults,a.pos,1).filter(b=>b.id!==a.id&&dist(a.pos,b.pos)<range):[];}
export function beginTraffic(c){
  const w=c.world,old=w.traffic,sameTerrain=old?.geometry===w.revision;
  w.traffic={adults:new Map(),routes:sameTerrain?old.routes:new Map(),bodyNavigation:sameTerrain?old.bodyNavigation:null,geometry:w.revision,colony:c};
  for(const a of c.ants)insert(w.traffic.adults,a,a.pos);
}
export function reindexAdult(w,a,old){if(!w.traffic)return;w.traffic.adults.get(bin(old))?.delete(a);insert(w.traffic.adults,a,a.pos);}
export function terrainFree(w,p){
  if(densityAt(p[0],p[1],(x,y)=>w.solid([x,y]))>=.49)return false;
  if(!w.walkable(p.map(n=>Math.round(n)||0))){const x=Math.floor(p[0]),y=Math.floor(p[1]);let supported=false;for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)if(Math.hypot(p[0]-x-dx,p[1]-y-dy)<.81&&w.walkable([x+dx,y+dy]))supported=true;if(!supported)return false;}return true;
}
export function canOccupy(w,a,p,angle=a.motion?.angle??0,ignoreBrood=null,ignoreAdults=false,escaping=false,joints=a.motion){
  if(!escaping&&!terrainFree(w,p))return false;
  const t=w.traffic;if(!t||ignoreAdults)return true;
  const cx=Math.floor(p[0]),cy=Math.floor(p[1]),radius=bodyPixel(a);
  const r=a.caste==='queen'?2:1;
  let pose;
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
    const bucket=t.adults.get(x+','+y);
    if(!bucket)continue;
    for(const b of bucket){
      if(b.id===a.id)continue;
      const dx=p[0]-b.pos[0],dy=p[1]-b.pos[1],bound=(radius+bodyPixel(b))*21;
      if(dx*dx+dy*dy>bound*bound)continue;
      pose??=bodyDiscs(a,p,angle,joints);
      if(poseGap(pose,bodyDiscs(b))<-CONTACT_SLACK)return false;
    }
  }
  return true;
}
export function sweptFree(w,a,from,to,angle,oldAngle=a.motion?.angle??angle,escaping=false,ignoreAdults=false){
  const delta=Math.atan2(Math.sin(angle-oldAngle),Math.cos(angle-oldAngle));
  const dx=to[0]-from[0],dy=to[1]-from[1],n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.09),Math.ceil(Math.abs(delta)/.15));
  for(let i=1;i<=n;i++){
    const t=i/n;
    if(!canOccupy(w,a,[from[0]+dx*t,from[1]+dy*t],oldAngle+delta*t,null,ignoreAdults,escaping))return false;
  }
  return true;
}
export function nearbyStances(w,a,target,range=1.2){
  const candidates=[];if(dist(a.pos,target)<=range&&canOccupy(w,a,a.pos))candidates.push([...a.pos]);for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const p=[target[0]+x*.5,target[1]+y*.5];if(dist(p,target)<=range+.001&&(canOccupy(w,a,p)||canOccupy(w,a,p,0)||canOccupy(w,a,p,Math.PI/2)))candidates.push(p);}
  candidates.sort((x,y)=>dist(x,a.pos)-dist(y,a.pos)||dist(x,target)-dist(y,target));return candidates;
}
export function nearestStance(w,a,target,range=1.2){return nearbyStances(w,a,target,range)[0]??null;}
function cacheRoute(w,id,route){const m=w.traffic.routes;if(m.size>=256)m.delete(m.keys().next().value);m.set(id,route);}
export function routeAroundItems(w,a,target,dynamic=false){
  if(!w.traffic)return w.path(a.cell,target.slice(0,2));let probe={id:a.id,caste:a.caste,bodySize:Math.ceil((a.bodySize??.4)*5)/5,pos:a.pos,motion:dynamic?a.motion:{...a.motion,neck:0,waist:0}};
  const headings=[a.motion?.angle??0,0,Math.PI/2,Math.PI,-Math.PI/2];if(!canOccupy(w,probe,a.pos,headings[0],null,!dynamic)||!headings.some(angle=>canOccupy(w,probe,target,angle,null,!dynamic)))probe=a;
  const id=key(a.pos)+'@'+a.motion?.angle+'>'+key(target.slice(0,2))+':'+probe.caste+':'+probe.bodySize+':'+(probe.motion.neck??0)+':'+(probe.motion.waist??0);
  if(!dynamic&&w.traffic.routes.has(id))return w.traffic.routes.get(id)?.map(p=>[...p])??null;
  const planned=bodyRoute(w,probe,target,{canOccupy,sweptFree},dynamic),route=planned?.map(p=>p[3]!=null?[p[0],p[1],null,.04]:p.slice(0,2)).filter((p,i,all)=>i?dist(p,all[i-1])>.03:dist(p,a.pos)>.03)??null;if(!dynamic)cacheRoute(w,id,route);return route;
}
export function idlePlace(w,a){const queue=[a.cell],seen=new Set([key(a.cell)]);let head=0,best=null,score=-Infinity;const claims=new Set((w.traffic?.colony.ants??[]).filter(b=>b.id!==a.id&&['resting','reserve','grooming'].includes(b.task)&&b.destination).map(b=>key(b.motion?.yieldTarget??b.destination)));while(head<queue.length&&head<90){const p=queue[head++],degree=w.neighbors(p).length;if(canOccupy(w,a,p)&&!claims.has(key(p))&&[[1,0],[-1,0],[0,1],[0,-1]].filter(d=>w.walkable([p[0]+d[0],p[1]+d[1]])).length>=3){const neighbors=around(w.traffic?.adults??new Map(),p,1).length,n=degree-neighbors*3-dist(a.cell,p)*.4+(a.id*17+p[0]*7+p[1]*11)%13*.05;if(n>score){score=n;best=p;}}for(const n of w.neighbors(p))if(!seen.has(key(n))){seen.add(key(n));queue.push(n);}}return best;}
export function spaceForItem(w,pos,radius,ignoreAnt=null,kind='resource'){if(kind==='brood'||kind==='cache'||!w.traffic)return true;for(const a of around(w.traffic.adults,pos,1))if(a.id!==ignoreAnt&&bodyDiscs(a).some(d=>Math.hypot(pos[0]-d.x,pos[1]-d.y)<d.radius+radius+.012))return false;return true;}
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
function passagePriority(a,time){return (a.caste==='queen'?10000:a.carryingBrood?40:a.carried?12:0)+Math.max(0,time-(a.motion.waitingSince??time))*6-a.id*.0001;}
function passingPlace(w,a,other){
  const angle=a.motion.angle,co=Math.cos(angle),si=Math.sin(angle),candidates=[];
  // These are walking destinations, never lateral position corrections.
  for(const side of[1,-1])for(const [forward,lateral] of[[.45,.28],[.2,.38],[.7,.35],[0,.5]])candidates.push([a.pos[0]+co*forward-si*lateral*side,a.pos[1]+si*forward+co*lateral*side]);
  for(const step of[.24,.12])candidates.push([a.pos[0]+co*step,a.pos[1]+si*step]);
  for(const n of w.neighbors(a.cell))if(dist(n,other.pos)>.7)candidates.push(n);
  for(const p of candidates){if(!terrainFree(w,p)||dist(p,a.pos)<.07||!canOccupy(w,a,p,Math.atan2(p[1]-a.pos[1],p[0]-a.pos[0])))continue;const route=routeAroundItems(w,a,p,true);if(route?.length)return {point:p,route};}return null;
}
function backingPlace(w,a,time){if(time<(a.motion.lastBacking??-10)+3)return null;for(const distance of[.22,.15,.09,.05]){const p=[a.pos[0]-Math.cos(a.motion.angle)*distance,a.pos[1]-Math.sin(a.motion.angle)*distance];if(terrainFree(w,p)&&sweptFree(w,a,a.pos,p,a.motion.angle,a.motion.angle))return {point:p,route:[p],backing:true};}return null;}
function clearancePlace(w,a,time){
  if(time<(a.motion.lastClearance??-10)+1.5)return null;
  const goal=a.route[0]??a.destination;if(!goal)return null;
  const angle=a.motion.angle,desired=Math.atan2(goal[1]-a.pos[1],goal[0]-a.pos[0]),turn=angle+Math.max(-.25,Math.min(.25,Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle))));
  const near=nearbyAdults(w,a,.9),gap=p=>Math.min(.16,...near.map(b=>bodyGap(a,b,p,angle))),initial=gap(a.pos);let best=null,quality=-Infinity;
  for(const distance of[.18,.12,.06])for(let i=0;i<12;i++){
    const direction=angle+i*Math.PI/6,p=[a.pos[0]+Math.cos(direction)*distance,a.pos[1]+Math.sin(direction)*distance];
    if(!terrainFree(w,p)||!sweptFree(w,a,a.pos,p,angle,angle))continue;
    // Validate the same short footfalls the recovery motor will actually take.
    const count=Math.max(1,Math.ceil(distance/.02));let clear=true;for(let j=1;j<=count;j++)if(!canOccupy(w,a,[a.pos[0]+(p[0]-a.pos[0])*j/count,a.pos[1]+(p[1]-a.pos[1])*j/count],angle)){clear=false;break;}if(!clear)continue;
    const opensTurn=sweptFree(w,a,p,p,turn,angle),clearance=gap(p)-initial;
    const score=(opensTurn?1:0)+clearance*4+(dist(a.pos,goal)-dist(p,goal))*.15-distance*.05;
    if(score>quality&&(opensTurn||clearance>.004)){quality=score;best={point:p,route:[p],clearance:true};}
  }return best;
}
function yieldTo(c,a,winner,bay){const m=a.motion;m.resumeGoal=['resting','grooming','reserve'].includes(a.task)?null:a.destination?[...a.destination]:null;m.yieldingRoute=true;m.yieldTarget=bay.point;m.yieldFor=winner.id;m.yieldStarted=c.time;m.yieldEnd=c.time+.3;m.yieldDeadline=c.time+3;a.route=bay.route;m.trafficBlocked=0;winner.motion.waitUntil=c.time+.3;
  if(bay.clearance){m.clearanceGoal=bay.point;m.clearanceLeft=.22;m.clearanceUntil=c.time+.9;m.lastClearance=c.time;winner.motion.waitUntil=c.time+.7;}
  if(bay.backing){m.backingGoal=bay.point;m.backingLeft=.22;m.backingUntil=c.time+.85;m.lastBacking=c.time;winner.motion.waitUntil=c.time+.65;}
}
export function unjam(c,a){
  const w=c.world,m=a.motion;if((m.trafficBlocked??0)<.45||m.yieldingRoute||c.time<(m.nextTrafficPlanAt??0))return;m.nextTrafficPlanAt=c.time+.65;m.waitingSince??=c.time;
  const near=nearbyAdults(w,a,1.2).sort((b,d)=>dist(b.pos,a.pos)-dist(d.pos,a.pos));
  for(const b of near.slice(0,3)){
    const trusted=a.recognitionTemplate&&b.odor&&Math.hypot(...a.recognitionTemplate.map((v,i)=>v-b.odor[i]))<.2;if(!trusted)continue;
    const winner=passagePriority(a,c.time)>=passagePriority(b,c.time)?a:b,yielder=winner===a?b:a;
    a.brain.traffic={partner:b.id,signal:winner===a?'Requesting passage':'Making room',at:c.time,until:c.time+3};b.brain.traffic={partner:a.id,signal:winner===b?'Requesting passage':'Making room',at:c.time,until:c.time+3};
    a.motion.examineAngle=Math.atan2(b.pos[1]-a.pos[1],b.pos[0]-a.pos[0]);a.motion.examineUntil=c.time+.6;b.motion.examineAngle=Math.atan2(a.pos[1]-b.pos[1],a.pos[0]-b.pos[0]);b.motion.examineUntil=c.time+.6;
    if(yielder.caste==='queen'||yielder.motion.yieldingRoute)continue;
    const bay=clearancePlace(w,yielder,c.time)??passingPlace(w,yielder,winner)??backingPlace(w,yielder,c.time);if(!bay){yielder.motion.trafficBlocked=Math.max(.5,yielder.motion.trafficBlocked??0);continue;}
    yieldTo(c,yielder,winner,bay);
    yielder.decision='Antennal contact: making room for a nearby nestmate, then resuming the same task.';winner.decision='A nearby nestmate is making room. Pausing briefly before continuing.';return;
  }
  const retreat=clearancePlace(w,a,c.time)??(near.length?backingPlace(w,a,c.time):null);if(retreat){yieldTo(c,a,near[0]??a,retreat);a.brain.traffic={partner:near[0]?.id??null,signal:'Taking a short step clear to turn',at:c.time,until:c.time+1};return;}
  const goal=m.yieldTarget??a.destination;if(goal){const stance=canOccupy(w,a,goal)?goal:nearestStance(w,a,goal),detour=stance?routeAroundItems(w,a,stance,true):null;if(detour?.length&&JSON.stringify(detour)!==JSON.stringify(a.route)){a.route=detour;m.trafficBlocked=0;return;}}
  if(c.time-(m.waitingSince??c.time)>6&&w.neighbors(a.cell).length<=3){c.congestionUntil=c.time+15;if(a.cell[1]>w.baseSurface(a.cell[0])+3)for(const dx of[-1,1]){const p=[a.cell[0]+dx,a.cell[1]];if(w.solid(p)&&!w.construction.some(q=>key(q)===key(p))){w.construction.push(p,[p[0],p[1]+1]);w.frontierVersion=-1;break;}}}
}
