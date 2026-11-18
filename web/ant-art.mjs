import {antennaShape} from './locomotion.mjs';
import {drawGrain} from './resource-art.mjs';
import {paintBrood} from './brood-art.mjs';
import {broodStage} from './biology.mjs';
export const GAIT_FRAMES=12,SCAN_FRAMES=8,SPRITE_W=56,SPRITE_H=34;
function line(c,x0,y0,x1,y1,color,width=1){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let error=dx+dy;c.fillStyle=color;
  for(let i=0;i<60;i++){c.fillRect(x0,y0,width,width);if(x0===x1&&y0===y1)break;const e=error*2;if(e>=dy){error+=dy;x0+=sx;}if(e<=dx){error+=dx;y0+=sy;}}
}
function paint(c,caste,gait,scan,wide,part='all'){
  const phase=gait/GAIT_FRAMES*Math.PI*2,rest=gait===GAIT_FRAMES,body=caste==='queen'?'#934832':caste==='major'?'#8e4029':'#b75a31',highlight='#d78b52',dark='#3a2720';
  const s=antennaShape(scan/SCAN_FRAMES*Math.PI*2,wide?'searching':'tracking');
  // Alternating tripods: front/rear on one side move with the opposite middle leg.
  if(part==='all'||part==='legs')for(const side of [-1,1])for(let leg=0;leg<3;leg++){
    const p=phase+leg*Math.PI+(side===1?Math.PI:0),swing=rest?0:Math.cos(p)*3,lift=rest?0:Math.max(0,Math.sin(p))*1.8,hip=21+leg*3.1;
    const kneeX=hip+(leg-1)*2+swing*.4,kneeY=17+side*(5-lift*.3),footX=hip+(leg-1)*5+swing,footY=17+side*(10-lift);
    line(c,hip,17+side*2,kneeX,kneeY,dark);line(c,kneeX,kneeY,footX,footY,'#77482d');c.fillStyle='#b58149';c.fillRect(Math.round(footX),Math.round(footY),1,1);
  }
  const bob=rest?0:Math.sin(phase*2)*.45;
  c.save();c.translate(0,bob);const box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  // Gaster, narrow waist, thorax, and independently angled head.
  if(part==='all'||part==='abdomen'){box(4,13,14,8,dark);box(6,11,10,12,body);box(4,14,14,6,body);box(7,12,7,2,highlight);box(7,21,7,1,'#623722');box(17,16,4,3,dark);box(19,15,3,3,body);}
  if(part==='all'||part==='thorax'){box(22,13,8,8,dark);box(23,12,6,9,body);box(24,13,4,2,highlight);box(29,16,4,2,dark);}
  if(part==='all'||part==='head'){c.translate(34,17);if(part==='all')c.rotate(s.head);const big=caste==='major',hy=big?-6:-4,hh=big?12:9;
  box(-3,hy,8,hh,dark);box(-3,hy+1,8,hh-2,body);box(-2,hy+1,5,2,highlight);box(3,-2,2,1,'#f2c68b');
  for(const side of [-1,1]){line(c,4,side*2,6,side*2,'#6b3b25');line(c,6,side*2,7,side,'#e5b782');}
  for(const [side,angle,bend] of [[-1,s.left,s.leftBend],[1,s.right,s.rightBend]]){
    const ex=Math.cos(angle)*6.5,ey=side*2+Math.sin(angle)*6.5,tx=ex+Math.cos(angle+bend)*7.4,ty=ey+Math.sin(angle+bend)*7.4;
    line(c,1,side*2,ex,ey,'#462c21');line(c,ex,ey,tx,ty,'#e1b674');box(Math.round(tx),Math.round(ty),2,1,'#f0d19b');
  }}c.restore();
}
export function buildAntAtlas(caste){
  const atlas=document.createElement('canvas');atlas.width=(GAIT_FRAMES+1)*SPRITE_W;atlas.height=SCAN_FRAMES*2*SPRITE_H;const c=atlas.getContext('2d');
  for(let wide=0;wide<2;wide++)for(let scan=0;scan<SCAN_FRAMES;scan++)for(let gait=0;gait<=GAIT_FRAMES;gait++){
    c.save();c.translate(gait*SPRITE_W,(wide*SCAN_FRAMES+scan)*SPRITE_H);paint(c,caste,gait,scan,wide);c.restore();
  }return atlas;
}

export function buildAntParts(caste){
  const canvas=(width,height)=>{const out=document.createElement('canvas');out.width=width;out.height=height;return out;};
  const legs=canvas((GAIT_FRAMES+1)*SPRITE_W,SPRITE_H),head=canvas(SCAN_FRAMES*SPRITE_W,SPRITE_H*2),thorax=canvas(SPRITE_W,SPRITE_H),abdomen=canvas(SPRITE_W,SPRITE_H);
  const lc=legs.getContext('2d');for(let gait=0;gait<=GAIT_FRAMES;gait++){lc.save();lc.translate(gait*SPRITE_W,0);paint(lc,caste,gait,0,false,'legs');lc.restore();}
  const hc=head.getContext('2d');for(let wide=0;wide<2;wide++)for(let scan=0;scan<SCAN_FRAMES;scan++){hc.save();hc.translate(scan*SPRITE_W,wide*SPRITE_H);paint(hc,caste,GAIT_FRAMES,scan,wide,'head');hc.restore();}
  paint(thorax.getContext('2d'),caste,GAIT_FRAMES,0,false,'thorax');paint(abdomen.getContext('2d'),caste,GAIT_FRAMES,0,false,'abdomen');return {legs,head,thorax,abdomen};
}

export function paintHeldObject(c,atlas,a,baby,px,clock){
  // Everything here uses the head pivot. The cargo turns with the same neck joint as the jaws.
  const grip=7*px;
  c.save();
  if(baby){
    const stage=broodStage(baby),back=stage==='pupa'?6:stage==='larva'?4:2;
    const scale=Math.max(.5,px*2);
    paintBrood(c,baby,grip-.8*px+back*scale*.72,0,scale,clock);
  }else if(['food','broodMeal','queenMeal'].includes(a.cargoKind)){
    drawGrain(c,atlas,grip+3.5*px,0,8*px,0,Math.min(1,a.carried/2));
  }else{
    const soil=a.cargoKind==='soil',x=grip+3*px,r=3.5*px;
    c.fillStyle=soil?'#725135':'#487c86';
    c.beginPath();c.ellipse(x,0,r,r*.73,soil?-.28:.18,0,Math.PI*2);c.fill();
    c.fillStyle=soil?'#b89164':'#a4d9df';
    c.beginPath();c.ellipse(x+.3*px,-.35*px,r*.79,r*.56,-.25,0,Math.PI*2);c.fill();
    c.fillStyle=soil?'#dfbd87':'#e4ffff';
    c.fillRect(x-.8*px,-1.2*px,1.7*px,.8*px);
  }
  for(const side of [-1,1]){
    c.beginPath();c.moveTo(4.5*px,side*2.1*px);
    c.quadraticCurveTo(grip,side*2.5*px,grip+1.3*px,side*.8*px);
    c.lineWidth=Math.max(.45,px*1.1);c.strokeStyle='#50301e';c.stroke();
    c.fillStyle='#efc491';c.fillRect(grip+.55*px,side*.95*px,Math.max(.45,px),Math.max(.4,px*.8));
  }
  c.restore();
}
