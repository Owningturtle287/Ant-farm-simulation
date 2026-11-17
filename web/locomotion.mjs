import {sweptFree,reindexAdult} from './traffic.mjs';
// Local sensorimotor approximation, not a reconstruction of an ant nervous system.
import {clamp} from './biology.mjs';
import {densityAt} from './geometry.mjs';
import {sampleChemicals,resourceOdor} from './signals.mjs';
export const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function random(m){let n=m.rng;n^=n<<13;n^=n>>>17;n^=n<<5;m.rng=n>>>0;return m.rng/4294967296;}
export function initializeMotion(a,seed){
  if(a.motion?.version===1)return a.motion;
  const next=a.route?.[0],angle=next?Math.atan2(next[1]-a.pos[1],next[0]-a.pos[0]):a.heading<0?Math.PI:0;
  return a.motion={version:1,angle,speed:0,travel:0,phase:(a.id*2.399963)%6.283185,rng:((seed^Math.imul(a.id+31,1597334677))>>>0)||1,wander:0,pace:1,nextVariation:0,nextSense:0,pauseUntil:0,nextPause:4+(a.id%17),blocked:0,mode:'settling',turn:0};
}
export function antennaShape(phase,mode='searching',arousal=0){
  const broad=mode==='sampling'||mode==='searching',spread=broad?.63:.38,sweep=Math.sin(phase)*(broad?.30:.16);
  // Independent elbow flexion, with oppositely biased sweeps; both still point ahead.
  return {left:-spread+sweep,right:spread+sweep*.78,leftBend:-.24-Math.sin(phase*.83)*.13,rightBend:.24+Math.sin(phase*.83+.8)*.13,head:sweep*.22+arousal*.025};
}
export function antennaTips(a){
  const m=a.motion,s=antennaShape(m.phase,m.mode,a.brain?.arousal??0),co=Math.cos(m.angle),si=Math.sin(m.angle);
  const tip=(side,angle,bend)=>{const x=.40+Math.cos(angle)*.27+Math.cos(angle+bend)*.31,y=side*.08+Math.sin(angle)*.27+Math.sin(angle+bend)*.31;return [a.pos[0]+co*x-si*y,a.pos[1]+si*x+co*y];};
  return {left:tip(-1,s.left,s.leftBend),right:tip(1,s.right,s.rightBend)};
}
export function senseAntennae(a,w,time,occupancy){
  const m=a.motion;if(time<m.nextSense)return;
  m.nextSense=time+.38+(a.id%5)*.025;
  const tips=antennaTips(a),read=p=>{const out=sampleChemicals(w,p);const odor=resourceOdor(w,p);out.foodOdor=odor.food;out.moisture=odor.water;out.touch=w.solid(p.map(Math.round))?1:0;return out;};
  const left=read(tips.left),right=read(tips.right),kind=a.foragingKind??'food',odor=kind==='food'?'foodOdor':'moisture';
  const l=left[kind]+left[odor]*.8,r=right[kind]+right[odor]*.8,sum=l+r,previous=a.brain.antennae?.strength??0;
  const tracking=['exploring','toFood','toWater'].includes(a.task),alarm=(left.alarm+right.alarm)*.5;
  m.turn=tracking?clamp((r-l)/(.12+sum),-1,1)*.42:0;
  if(a.task==='investigating')m.turn=clamp((right.alarm-left.alarm)/(.12+alarm*2),-1,1)*.5;
  m.touchTurn=(left.touch-right.touch)*.25;m.separation=0;m.yielding=1;
  if(occupancy){let checked=0;const bins=new Set([a.cell.join(','),tips.left.map(Math.round).join(','),tips.right.map(Math.round).join(',')]);for(const id of bins){const agents=occupancy.get(id)??[];for(let i=0;i<agents.length&&checked<8;i++){const other=agents[(i+a.id)%agents.length];if(other.id===a.id)continue;checked++;const dx=other.pos[0]-a.pos[0],dy=other.pos[1]-a.pos[1],d=Math.hypot(dx,dy),forward=Math.cos(m.angle)*dx+Math.sin(m.angle)*dy;if(d>.1&&d<1.05&&forward>.05){const side=Math.cos(m.angle)*dy-Math.sin(m.angle)*dx;m.separation+=Math.abs(side)<.08?.18:-Math.sign(side)*.18;m.yielding=Math.min(m.yielding,.72+d*.2);}}}m.separation=clamp(m.separation,-.32,.32);}

  a.brain.antennae={left,right,tips,kind,strength:sum*.5,contrast:(r-l)/(.12+sum),sampledAt:time};
  if(tracking&&!a.carried&&!a.carryingBrood&&a.energy>.35&&a.hydration>.35){
    if(time>=m.nextPause&&(sum<.07||sum>previous*2+.4)){
      m.pauseUntil=time+.12+random(m)*.30;m.nextPause=time+6+random(m)*12;
    }
    m.mode=time<m.pauseUntil?'sampling':sum>.12?'tracking':'searching';
  }else m.mode=a.carried||a.carryingBrood?'carrying':a.task==='investigating'?'alert':a.route.length?'travelling':'resting';
}
export function updateMotion(a,w,time,dt,occupancy){
  const m=a.motion;w.motionRevisions??=new Map();if(w.motionRevisions.get(a.id)!==w.revision){w.motionRevisions.set(a.id,w.revision);if(densityAt(...a.pos,(x,y)=>w.solid([x,y]))>=.49)m.recovering=true;}m.phase=wrapAngle(m.phase+dt*(m.mode==='sampling'?11:6.5)+(a.brain.arousal??0)*dt*2);
  if(time>=m.nextVariation){m.wander=m.wander*.6+(random(m)-.5)*.32;m.pace=.87+random(m)*.26;m.nextVariation=time+.45+random(m)*.7;}
  senseAntennae(a,w,time,occupancy);
  if(!a.route.length){m.speed*=Math.exp(-dt*12);if(m.speed<.01)m.speed=0;}
}
export function clearSegment(w,from,to,escaping=false){
  let previous=escaping?densityAt(...from,(x,y)=>w.solid([x,y])):0;
  const length=Math.hypot(to[0]-from[0],to[1]-from[1]),steps=Math.max(1,Math.ceil(length/.16));
  for(let i=1;i<=steps;i++){const t=i/steps,x=from[0]+(to[0]-from[0])*t,y=from[1]+(to[1]-from[1])*t;const density=densityAt(x,y,(sx,sy)=>w.solid([sx,sy]));if(density>=.49&&(!escaping||previous<.49||density>previous+.001))return false;previous=density;
    const rounded=[Math.round(x),Math.round(y)];if(!escaping&&!w.walkable(rounded)){let supported=false;const ix=Math.floor(x),iy=Math.floor(y);for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)if(Math.hypot(x-ix-dx,y-iy-dy)<.81&&w.walkable([ix+dx,iy+dy]))supported=true;if(!supported)return false;}}return true;
}
export function recoverBody(a,w,dt){
  const m=a.motion,density=densityAt(...a.pos,(x,y)=>w.solid([x,y]));
  if(density<.49){
    m.recovering=false;
    if(Math.hypot(a.pos[0]-a.cell[0],a.pos[1]-a.cell[1])>.9){let nearest=null,best=Infinity;const cx=Math.round(a.pos[0]),cy=Math.round(a.pos[1]);for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){const d=Math.hypot(x-a.pos[0],y-a.pos[1]);if(d<best&&w.walkable([x,y])){nearest=[x,y];best=d;}}if(nearest){a.cell=nearest;const goal=a.route.at(-1)??a.destination;if(goal&&w.path)a.route=w.path(a.cell,goal)??[];}}
    return;
  }
  const dx=a.cell[0]-a.pos[0],dy=a.cell[1]-a.pos[1],length=Math.hypot(dx,dy),step=Math.min(length,1.6*dt),toward=[a.pos[0]+dx/Math.max(length,.0001)*step,a.pos[1]+dy/Math.max(length,.0001)*step];
  let next=clearSegment(w,a.pos,toward,true)?toward:null,best=density;
  if(!next)for(let i=0;i<8;i++){const angle=i*Math.PI/4,p=[a.pos[0]+Math.cos(angle)*step,a.pos[1]+Math.sin(angle)*step],value=densityAt(...p,(x,y)=>w.solid([x,y]));if(value<best&&clearSegment(w,a.pos,p,true)){best=value;next=p;}}
  if(next){const travel=Math.hypot(next[0]-a.pos[0],next[1]-a.pos[1]);m.travel+=travel;m.speed=travel/dt;m.angle=wrapAngle(m.angle+clamp(wrapAngle(Math.atan2(next[1]-a.pos[1],next[0]-a.pos[0])-m.angle),-7.5*dt,7.5*dt));a.pos=next;m.mode='reorienting';}
}
export function moveAnt(a,w,time,dt,traffic=0){
  const m=a.motion,next=a.route[0];if(!next)return false;const previousAngle=m.angle;
  const dx=next[0]-a.pos[0],dy=next[1]-a.pos[1],length=Math.hypot(dx,dy),following=a.route[1];
  // Look around a corner only inside the same traversable corridor.
  let aim=next;
  if(following&&length<.8){const t=(1-length/.8)*.48,p=[next[0]+(following[0]-next[0])*t,next[1]+(following[1]-next[1])*t];if(clearSegment(w,a.pos,p))aim=p;}
  const searching=a.task==='exploring',loaded=!!(a.carried||a.carryingBrood),urgent=loaded||['refueling','queenMoving','toBrood','feedingQueen'].includes(a.task);
  const offset=urgent?m.wander*.12:m.wander*(searching?1:.35),sensory=(urgent?0:m.turn+(m.touchTurn??0))+(m.separation??0)*(urgent?.45:1);
  const desired=Math.atan2(aim[1]-a.pos[1],aim[0]-a.pos[0])+(length<.3?0:offset+sensory);
  const difference=wrapAngle(desired-m.angle),turnLimit=(a.caste==='queen'?4.2:7.5)*dt;
  m.angle=wrapAngle(m.angle+clamp(difference,-turnLimit,turnLimit));
  const base=(a.caste==='queen'?.85:a.caste==='major'?2.5:3)*(loaded?.72:1)*(.7+a.energy*.3)/(1+Math.min(traffic,7)*.18);
  const targetSpeed=(time<m.pauseUntil&&!urgent?0:base*m.pace*(m.yielding??1))*(.25+.75*Math.max(0,Math.cos(difference*.6)));
  m.speed+=(targetSpeed-m.speed)*(1-Math.exp(-dt*(targetSpeed<m.speed?14:8)));
  if(time<m.pauseUntil&&!urgent)m.mode='sampling';else if(m.mode==='sampling')m.mode=searching?'searching':'travelling';
  const step=Math.min(length,m.speed*dt);let p=[a.pos[0]+Math.cos(m.angle)*step,a.pos[1]+Math.sin(m.angle)*step];
  if(length<=step+.015&&!following)p=[...next];
  if(!clearSegment(w,a.pos,p)){
    // Wall contact redirects locomotion, without indefinitely waiting or abandoning a load.
    m.blocked+=dt;const direct=[a.pos[0]+dx/Math.max(length,.0001)*step,a.pos[1]+dy/Math.max(length,.0001)*step];
    if(clearSegment(w,a.pos,direct)){p=direct;m.angle=wrapAngle(m.angle+clamp(wrapAngle(Math.atan2(dy,dx)-m.angle),-turnLimit,turnLimit));}else{
      const sx=next[0]-a.cell[0],sy=next[1]-a.cell[1],den=sx*sx+sy*sy,t=den?clamp(((a.pos[0]-a.cell[0])*sx+(a.pos[1]-a.cell[1])*sy)/den):0,guide=[a.cell[0]+sx*t,a.cell[1]+sy*t],gx=guide[0]-a.pos[0],gy=guide[1]-a.pos[1],gl=Math.hypot(gx,gy),correction=[a.pos[0]+gx/Math.max(gl,.0001)*Math.min(step,gl),a.pos[1]+gy/Math.max(gl,.0001)*Math.min(step,gl)];
      if(clearSegment(w,a.pos,correction))p=correction;else return false;
    }
  }else m.blocked=0;
  if(!sweptFree(w,a,a.pos,p,m.angle,previousAngle)){
    let candidate=null;const desired=Math.atan2(dy,dx),side=(a.id%2?1:-1);
    for(const offset of [side*.65,-side*.65,side*1.15,-side*1.15,Math.PI]){
      const angle=desired+offset,q=[a.pos[0]+Math.cos(angle)*step*.65,a.pos[1]+Math.sin(angle)*step*.65];
      if(clearSegment(w,a.pos,q)&&sweptFree(w,a,a.pos,q,angle,previousAngle)){candidate={p:q,angle};break;}
    }
    if(!candidate)for(const offset of [Math.PI/2,-Math.PI/2,Math.PI,0]){const q=[a.pos[0]+Math.cos(previousAngle+offset)*step*.45,a.pos[1]+Math.sin(previousAngle+offset)*step*.45];if(clearSegment(w,a.pos,q)&&sweptFree(w,a,a.pos,q,previousAngle,previousAngle)){candidate={p:q,angle:previousAngle};break;}}
    if(!candidate){m.angle=previousAngle;m.speed=0;m.trafficBlocked=(m.trafficBlocked??0)+dt;m.mode='yielding';return false;}p=candidate.p;m.angle=candidate.angle;
  }else m.trafficBlocked=0;
  if(Math.hypot(p[0]-next[0],p[1]-next[1])>length-.005)m.trafficBlocked=(m.trafficBlocked??0)+dt;
  const old=[...a.pos],travel=Math.hypot(p[0]-a.pos[0],p[1]-a.pos[1]);m.travel+=travel;a.pos=p;reindexAdult(w,a,old);
  // Intermediate waypoints are passed without snapping the continuous body position.
  const remaining=Math.hypot(next[0]-p[0],next[1]-p[1]),arrived=remaining<(following?.28:.075);
  if(arrived){a.cell=[...next];a.route.shift();}return arrived;
}
