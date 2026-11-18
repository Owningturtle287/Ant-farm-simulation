import {sweptFree,reindexAdult,canOccupy,terrainFree,nearbyAdults,bodyGap,CLIMB_HEIGHT} from './traffic.mjs';
// Local sensorimotor approximation, not a reconstruction of an ant nervous system.
import {clamp} from './biology.mjs';
import {densityAt,surfaceFooting} from './geometry.mjs';
import {sampleChemicals,resourceOdor} from './signals.mjs';
import {bodyPixel,bodyDiscs,NECK_LIMIT,WAIST_LIMIT} from './body-pose.mjs';
export const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function random(m){let n=m.rng;n^=n<<13;n^=n>>>17;n^=n<<5;m.rng=n>>>0;return m.rng/4294967296;}
export function initializeMotion(a,seed){
  if(a.motion){const m=a.motion;if(m.version!==2){m.version=2;m.neck=0;m.waist=0;m.speed=0;m.turnVelocity=0;m.trafficBlocked=0;}return m;}
  const next=a.route?.[0],angle=next?Math.atan2(next[1]-a.pos[1],next[0]-a.pos[0]):a.heading<0?Math.PI:0;
  return a.motion={version:2,angle,neck:0,waist:0,turnVelocity:0,speed:0,travel:0,phase:(a.id*2.399963)%6.283185,rng:((seed^Math.imul(a.id+31,1597334677))>>>0)||1,wander:0,pace:1,nextVariation:0,nextSense:0,pauseUntil:0,nextPause:4+(a.id%17),blocked:0,mode:'settling',turn:0};
}
export function antennaShape(phase,mode='searching',arousal=0){
  const broad=mode==='sampling'||mode==='searching'||mode==='resting',spread=broad?.63:.38,sweep=Math.sin(phase)*(broad?.30:.16);
  // Independent elbow flexion, with oppositely biased sweeps; both still point ahead.
  return {left:-spread+sweep,right:spread+sweep*.78,leftBend:-.24-Math.sin(phase*.83)*.13,rightBend:.24+Math.sin(phase*.83+.8)*.13,head:sweep*.22+arousal*.025};
}
export function antennaTips(a){
  const m=a.motion,s=antennaShape(m.phase,m.mode,a.brain?.arousal??0),u=bodyPixel(a),head=m.angle+(m.neck??0),co=Math.cos(head),si=Math.sin(head),root=[a.pos[0]+Math.cos(m.angle)*4*u,a.pos[1]+Math.sin(m.angle)*4*u];
  const tip=(side,angle,bend)=>{const x=(5+Math.cos(angle)*6.5+Math.cos(angle+bend)*7.4)*u,y=(side*2+Math.sin(angle)*6.5+Math.sin(angle+bend)*7.4)*u;return [root[0]+co*x-si*y,root[1]+si*x+co*y];};
  return {left:tip(-1,s.left,s.leftBend),right:tip(1,s.right,s.rightBend)};
}
export function senseAntennae(a,w,time,occupancy){
  const m=a.motion;if(time<m.nextSense)return;
  m.nextSense=time+.38+(a.id%5)*.025;
  const tips=antennaTips(a),read=p=>{const out=sampleChemicals(w,p);const odor=resourceOdor(w,p);out.foodOdor=odor.food;out.moisture=odor.water;out.touch=w.solid(p.map(n=>Math.round(n)||0))?1:0;return out;};
  const left=read(tips.left),right=read(tips.right),kind=a.foragingKind??'food',odor=kind==='food'?'foodOdor':'moisture';
  const l=left[kind]+left[odor]*.8,r=right[kind]+right[odor]*.8,sum=l+r,previous=a.brain.antennae?.strength??0;
  const tracking=['exploring','toFood','toWater'].includes(a.task),alarm=(left.alarm+right.alarm)*.5;
  m.turn=tracking?clamp((r-l)/(.12+sum),-1,1)*.42:0;
  if(a.task==='investigating')m.turn=clamp((right.alarm-left.alarm)/(.12+alarm*2),-1,1)*.5;
  m.touchTurn=(left.touch-right.touch)*.25;m.separation=0;m.yielding=1;
  const others=w.traffic?nearbyAdults(w,a):[...new Set([...(occupancy?.get(a.cell.join(','))??[]),...(occupancy?.get(tips.left.map(n=>Math.round(n)||0).join(','))??[]),...(occupancy?.get(tips.right.map(n=>Math.round(n)||0).join(','))??[])])].filter(b=>b.id!==a.id);
  const co=Math.cos(m.angle),si=Math.sin(m.angle);
  for(const other of others.slice(0,8)){const dx=other.pos[0]-a.pos[0],dy=other.pos[1]-a.pos[1],d=Math.hypot(dx,dy),forward=co*dx+si*dy;
    for(const side of ['left','right'])if(bodyDiscs(other).some(o=>Math.hypot(o.x-tips[side][0],o.y-tips[side][1])<o.radius+.06))({left,right}[side]).touch=1;
    if(d<.9){m.examineAngle=Math.atan2(dy,dx);m.examineUntil=time+.55;}
    if(d>.1&&d<1.05&&forward>.05){const side=co*dy-si*dx;m.separation+=Math.abs(side)<.08?.18:-Math.sign(side)*.14;m.yielding=Math.min(m.yielding,.72+d*.2);if(Math.cos((other.motion?.angle??0)-m.angle)<-.25&&other.route?.length){m.passUntil=time+1;m.passAngle=Math.atan2(dy,dx);}}
  }m.separation=clamp(m.separation,-.28,.28);

  a.brain.antennae={left,right,tips,kind,strength:sum*.5,contrast:(r-l)/(.12+sum),sampledAt:time};
  if(tracking&&!a.carried&&!a.carryingBrood&&a.energy>.35&&a.hydration>.35){
    if(time>=m.nextPause&&(sum<.07||sum>previous*2+.4)){
      m.pauseUntil=time+.12+random(m)*.30;m.nextPause=time+6+random(m)*12;
    }
    m.mode=time<m.pauseUntil?'sampling':sum>.12?'tracking':'searching';
  }else m.mode=a.carried||a.carryingBrood?'carrying':a.task==='investigating'?'alert':a.route.length?'travelling':'resting';
}
export function updateMotion(a,w,time,dt,occupancy){
  const m=a.motion;w.motionRevisions??=new Map();const revision=w.revision;if(w.motionRevisions.get(a.id)!==revision){w.motionRevisions.set(a.id,revision);if(!terrainFree(w,a.pos))m.recovering=true;}m.phase=wrapAngle(m.phase+dt*(m.mode==='sampling'?11:6.5)+(a.brain.arousal??0)*dt*2);
  if(m.climbHeight>0&&time>=(m.climbUntil??0)&&canOccupy(w,a,a.pos,m.angle,null,false,false,m,0)){
    m.climbHeight=Math.max(0,m.climbHeight-dt*.75);
  }

  if(time>=m.nextVariation){m.wander=m.wander*.6+(random(m)-.5)*.32;m.pace=.87+random(m)*.26;m.nextVariation=time+.45+random(m)*.7;}
  senseAntennae(a,w,time,occupancy);
  updateArticulation(a,w,time,dt);
  if(!a.route.length){m.speed*=Math.exp(-dt*12);if(m.speed<.01)m.speed=0;}
}
export function updateArticulation(a,w,time,dt){
  const m=a.motion,next=a.route[0],direction=next?Math.atan2(next[1]-a.pos[1],next[0]-a.pos[0]):m.angle;
  const examining=time<(m.examineUntil??0)?wrapAngle((m.examineAngle??m.angle)-m.angle):0,scan=['sampling','resting','searching'].includes(m.mode)?Math.sin(m.phase*.75)*.12:0;
  const squeezing=(m.trafficBlocked??0)>.2;const neckTarget=squeezing?0:clamp(examining||wrapAngle(direction-m.angle)*.65+(m.turn??0)*.3+scan,-NECK_LIMIT,NECK_LIMIT),waistTarget=squeezing?0:clamp(-(m.turnVelocity??0)*.075,-WAIST_LIMIT,WAIST_LIMIT),blend=1-Math.exp(-dt*8),old={neck:m.neck??0,waist:m.waist??0};
  const pose={neck:old.neck+(neckTarget-old.neck)*blend,waist:old.waist+(waistTarget-old.waist)*blend};
  let clear=true;for(const t of [.5,1])if(!canOccupy(w,a,a.pos,m.angle,null,false,!!m.recovering,{neck:old.neck+(pose.neck-old.neck)*t,waist:old.waist+(pose.waist-old.waist)*t}))clear=false;
  if(clear){m.neck=pose.neck;m.waist=pose.waist;}
  if((m.trafficBlocked??0)>.5&&time>=(m.nextJointChoice??0)){
    m.nextJointChoice=time+.3;const turn=m.angle+clamp(wrapAngle(direction-m.angle),-.22,.22),near=nearbyAdults(w,a,.85).slice(0,5),score=pose=>(canOccupy(w,a,a.pos,turn,null,false,false,pose)?2:0)+Math.min(.2,...near.map(b=>bodyGap(a,b,a.pos,m.angle,pose)))*2;
    let best={neck:m.neck??0,waist:m.waist??0},quality=score(best);
    for(const dn of[-.1,0,.1])for(const dw of[-.08,0,.08]){const p={neck:clamp((m.neck??0)+dn,-NECK_LIMIT,NECK_LIMIT),waist:clamp((m.waist??0)+dw,-WAIST_LIMIT,WAIST_LIMIT)},mid={neck:((m.neck??0)+p.neck)/2,waist:((m.waist??0)+p.waist)/2};if(!canOccupy(w,a,a.pos,m.angle,null,false,false,p)||!canOccupy(w,a,a.pos,m.angle,null,false,false,mid))continue;const q=score(p);if(q>quality+.001){quality=q;best=p;}}
    m.neck=best.neck;m.waist=best.waist;
  }
}
export function clearSegment(w,from,to,escaping=false){
  let previous=escaping?densityAt(...from,(x,y)=>w.solid([x,y])):0;
  const length=Math.hypot(to[0]-from[0],to[1]-from[1]),steps=Math.max(1,Math.ceil(length/.16));
  for(let i=1;i<=steps;i++){const t=i/steps,x=from[0]+(to[0]-from[0])*t,y=from[1]+(to[1]-from[1])*t;const density=densityAt(x,y,(sx,sy)=>w.solid([sx,sy]));if(density>=.49&&(!escaping||previous<.49||density>previous+.001))return false;previous=density;
    const rounded=[Math.round(x),Math.round(y)];if(!escaping&&!w.walkable(rounded)){let supported=false;const ix=Math.floor(x),iy=Math.floor(y);for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)if(Math.hypot(x-ix-dx,y-iy-dy)<.81&&w.walkable([ix+dx,iy+dy]))supported=true;if(!supported)return false;}}return true;
}
export function recoverBody(a,w,dt){
  const m=a.motion,density=densityAt(...a.pos,(x,y)=>w.solid([x,y]));
  if(terrainFree(w,a.pos)){
    m.recovering=false;
    if(Math.hypot(a.pos[0]-a.cell[0],a.pos[1]-a.cell[1])>.9){let nearest=null,best=Infinity;const cx=Math.round(a.pos[0]),cy=Math.round(a.pos[1]);for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){const d=Math.hypot(x-a.pos[0],y-a.pos[1]);if(d<best&&w.walkable([x,y])){nearest=[x,y];best=d;}}if(nearest){a.cell=nearest;const goal=a.route.at(-1)??a.destination;if(goal&&w.path)a.route=w.path(a.cell,goal)??[];}}
    return;
  }
  const dx=a.cell[0]-a.pos[0],dy=a.cell[1]-a.pos[1],length=Math.hypot(dx,dy),step=Math.min(length,1.6*dt),toward=[a.pos[0]+dx/Math.max(length,.0001)*step,a.pos[1]+dy/Math.max(length,.0001)*step];
  let next=clearSegment(w,a.pos,toward,true)?toward:null,best=density;
  if(!next)for(let i=0;i<8;i++){const angle=i*Math.PI/4,p=[a.pos[0]+Math.cos(angle)*step,a.pos[1]+Math.sin(angle)*step],value=densityAt(...p,(x,y)=>w.solid([x,y]));if(value<best&&clearSegment(w,a.pos,p,true)){best=value;next=p;}}
  let angle=m.angle;if(next){const turn=wrapAngle(m.angle+clamp(wrapAngle(Math.atan2(next[1]-a.pos[1],next[0]-a.pos[0])-m.angle),-7.5*dt,7.5*dt));if(sweptFree(w,a,a.pos,next,turn,m.angle,true))angle=turn;else if(!sweptFree(w,a,a.pos,next,m.angle,m.angle,true))next=null;}
  if(next){const old=[...a.pos],travel=Math.hypot(next[0]-a.pos[0],next[1]-a.pos[1]);m.travel+=travel;m.speed=travel/dt;m.angle=angle;a.pos=next;reindexAdult(w,a,old);m.mode='reorienting';}
}
export function moveAnt(a,w,time,dt,traffic=0){
  const m=a.motion;let passed=false;
  if(m.clearanceUntil){
    const goal=m.clearanceGoal,remaining=goal?Math.hypot(goal[0]-a.pos[0],goal[1]-a.pos[1]):0;
    if(time>=m.clearanceUntil||remaining<.015||(m.clearanceLeft??0)<.005){m.clearanceUntil=0;m.gaitDirection=1;m.speed=0;a.route=[];return true;}
    const step=Math.min(.3*dt,m.clearanceLeft,remaining),dx=(goal[0]-a.pos[0])/remaining,dy=(goal[1]-a.pos[1])/remaining,q=[a.pos[0]+dx*step,a.pos[1]+dy*step];
    if(clearSegment(w,a.pos,q)&&sweptFree(w,a,a.pos,q,m.angle,m.angle)){const old=[...a.pos];a.pos=q;m.clearanceLeft-=step;m.travel+=step;m.speed=step/dt;m.gaitDirection=dx*Math.cos(m.angle)+dy*Math.sin(m.angle)<-.3?-1:1;m.mode='stepping clear';reindexAdult(w,a,old);}else m.speed=0;return false;
  }
  if(m.backingUntil){
    const goal=m.backingGoal,remaining=goal?Math.hypot(goal[0]-a.pos[0],goal[1]-a.pos[1]):0;
    if(time>=m.backingUntil||remaining<.04||(m.backingLeft??0)<.005){m.backingUntil=0;m.gaitDirection=1;m.speed=0;a.route=[];return true;}
    const step=Math.min(.35*dt,m.backingLeft,remaining),q=[a.pos[0]-Math.cos(m.angle)*step,a.pos[1]-Math.sin(m.angle)*step];
    if(clearSegment(w,a.pos,q)&&sweptFree(w,a,a.pos,q,m.angle,m.angle)){const old=[...a.pos];a.pos=q;m.backingLeft-=step;m.travel+=step;m.speed=step/dt;m.gaitDirection=-1;m.mode='carefully backing';reindexAdult(w,a,old);}else m.speed=0;return false;
  }
  m.gaitDirection=1;
  // Discard the rotation-only markers used by older saves. Headings never drive translation.
  while(a.route.length&&Math.hypot(a.route[0][0]-a.pos[0],a.route[0][1]-a.pos[1])<.065){a.cell=a.route.shift().slice(0,2).map(n=>Math.round(n)||0);passed=true;}
  const next=a.route[0];if(!next){m.speed=0;return passed;}
  const previousAngle=m.angle,dx=next[0]-a.pos[0],dy=next[1]-a.pos[1],length=Math.hypot(dx,dy),following=a.route[1];let aim=next;
  if(next[3]==null&&following&&length<.65){const fx=following[0]-next[0],fy=following[1]-next[1],fl=Math.hypot(fx,fy),look=Math.min(.16,fl*(1-length/.65)*.35),q=[next[0]+fx/Math.max(fl,.001)*look,next[1]+fy/Math.max(fl,.001)*look];if(clearSegment(w,a.pos,q))aim=q;}
  const laneTarget=time<(m.passUntil??0)?.20:0;m.lane=(m.lane??0)+(laneTarget-(m.lane??0))*(1-Math.exp(-dt*6));
  if(m.lane>.005&&length>.25){const angle=m.passAngle??Math.atan2(dy,dx);const lead=Math.min(.65,length);aim=[a.pos[0]+dx/length*lead-Math.sin(angle)*m.lane,a.pos[1]+dy/length*lead+Math.cos(angle)*m.lane];}
  const loaded=!!(a.carried||a.carryingBrood),urgent=loaded||['refueling','queenMoving','toBrood','feedingQueen'].includes(a.task),searching=a.task==='exploring';
  // A body-routed waypoint has checked clearance. Keep contact steering but avoid random drift.
  const wander=next[3]==null?(m.wander??0)*(searching?.25:.08):0;
  const sensory=length<.4?0:(urgent?0:(m.turn??0)*.35+(m.touchTurn??0)*.3)+(m.separation??0)*.35+wander;
  const desired=Math.atan2(aim[1]-a.pos[1],aim[0]-a.pos[0])+sensory,difference=wrapAngle(desired-m.angle),turnLimit=(a.caste==='queen'?2.8:5.5)*dt;
  let angle=wrapAngle(m.angle+clamp(difference,-turnLimit,turnLimit));
  const alignment=Math.max(0,Math.cos(wrapAngle(desired-angle))),base=(a.caste==='queen'?.85:a.caste==='major'?2.5:3)*(loaded?.72:1)*(.7+a.energy*.3)/(1+Math.min(traffic,5)*.08);
  const waiting=time<(m.waitUntil??0),sampling=time<m.pauseUntil&&!urgent,approach=Math.min(1,length/(following?.32:.5));
  const targetSpeed=waiting||sampling?0:base*(m.pace??1)*(m.yielding??1)*alignment*alignment*approach;
  let speed=m.speed+(targetSpeed-m.speed)*(1-Math.exp(-dt*(targetSpeed<m.speed?18:8)));
  // No forward creep during an about-turn, and no stored momentum at contact.
  if(alignment<.45||waiting||sampling)speed=0;
  const step=Math.min(length,speed*dt),delta=wrapAngle(angle-previousAngle),origin=[...a.pos];
  const arc=(t,travel=step,turn=delta)=>Math.abs(turn)<1e-8?[origin[0]+Math.cos(previousAngle)*travel*t,origin[1]+Math.sin(previousAngle)*travel*t]:[origin[0]+travel/turn*(Math.sin(previousAngle+turn*t)-Math.sin(previousAngle)),origin[1]+travel/turn*(Math.cos(previousAngle)-Math.cos(previousAngle+turn*t))];
  const free=(t,travel=step,turn=delta,ignoreAdults=false)=>{const count=Math.max(1,Math.ceil(Math.abs(turn*t)/.12),Math.ceil(travel*t/.10));let p=origin,prior=previousAngle;for(let i=1;i<=count;i++){const fraction=t*i/count,q=arc(fraction,travel,turn),heading=previousAngle+turn*fraction;if(!sweptFree(w,a,p,q,heading,prior,false,ignoreAdults))return false;p=q;prior=heading;}return true;};
  let clear=free(1);
  if(!clear&&step>.018&&a.caste!=='queen'&&!a.carryingBrood&&surfaceFooting(w,origin)&&surfaceFooting(w,arc(1))&&free(1,step,delta,true)){
    const end=arc(1);
    const blocker=nearbyAdults(w,a,.8).find(b=>b.caste!=='queen'&&!b.motion?.climbHeight&&surfaceFooting(w,b.pos)&&bodyGap(a,b,end,angle)<0);
    if(blocker){
      m.climbHeight=Math.min(CLIMB_HEIGHT,(m.climbHeight??0)+dt*.82);
      m.climbUntil=time+.27;
      clear=free(1);
    }
  }
  let fraction=1,travelStep=step,turnStep=delta;
  if(!clear){let low=0,high=1;for(let i=0;i<7;i++){const t=(low+high)/2;if(free(t))low=t;else high=t;}fraction=low;
    if(fraction<.02){if(free(1,0,delta)){fraction=1;travelStep=0;}else if(step>0&&free(1,step,0)){fraction=1;turnStep=0;}}
  }
  const p=arc(fraction,travelStep,turnStep);m.angle=wrapAngle(previousAngle+turnStep*fraction);m.turnVelocity=wrapAngle(m.angle-previousAngle)/dt;
  const old=[...a.pos],travel=Math.hypot(p[0]-old[0],p[1]-old[1]);m.speed=travel/dt;m.travel+=travel;a.pos=p;reindexAdult(w,a,old);
  const remaining=Math.hypot(next[0]-p[0],next[1]-p[1]);
  if(travel<.005&&targetSpeed>.1){m.trafficBlocked=(m.trafficBlocked??0)+dt;m.waitingSince??=time;m.mode='yielding';}else if(travel>.025){m.trafficBlocked=0;m.waitingSince=null;m.mode=loaded?'carrying':'travelling';}
  const targetKey=next.slice(0,2).join(',');if(m.progressTarget!==targetKey){m.progressTarget=targetKey;m.bestDistance=length;m.progressAt=time;}if(remaining<(m.bestDistance??Infinity)-.025){m.bestDistance=remaining;m.progressAt=time;}else if(time-(m.progressAt??time)>2.5)m.trafficBlocked=Math.max(.5,m.trafficBlocked??0);
  const arrived=remaining<(following?(next[3]??.22):.065);if(arrived){a.cell=next.slice(0,2).map(n=>Math.round(n)||0);a.route.shift();}return arrived;
}
