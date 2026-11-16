import {antennaShape} from './locomotion.mjs';
export const GAIT_FRAMES=12,SCAN_FRAMES=8,SPRITE_W=56,SPRITE_H=34;
function line(c,x0,y0,x1,y1,color,width=1){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let error=dx+dy;c.fillStyle=color;
  for(let i=0;i<60;i++){c.fillRect(x0,y0,width,width);if(x0===x1&&y0===y1)break;const e=error*2;if(e>=dy){error+=dy;x0+=sx;}if(e<=dx){error+=dx;y0+=sy;}}
}
function paint(c,caste,gait,scan,wide){
  const phase=gait/GAIT_FRAMES*Math.PI*2,rest=gait===GAIT_FRAMES,body=caste==='queen'?'#934832':caste==='major'?'#8e4029':'#b75a31',highlight='#d78b52',dark='#3a2720';
  const s=antennaShape(scan/SCAN_FRAMES*Math.PI*2,wide?'searching':'tracking');
  // Alternating tripods: front/rear on one side move with the opposite middle leg.
  for(const side of [-1,1])for(let leg=0;leg<3;leg++){
    const p=phase+leg*Math.PI+(side===1?Math.PI:0),swing=rest?0:Math.cos(p)*3,lift=rest?0:Math.max(0,Math.sin(p))*1.8,hip=21+leg*3.1;
    const kneeX=hip+(leg-1)*2+swing*.4,kneeY=17+side*(5-lift*.3),footX=hip+(leg-1)*5+swing,footY=17+side*(10-lift);
    line(c,hip,17+side*2,kneeX,kneeY,dark);line(c,kneeX,kneeY,footX,footY,'#77482d');c.fillStyle='#b58149';c.fillRect(Math.round(footX),Math.round(footY),1,1);
  }
  const bob=rest?0:Math.sin(phase*2)*.45;
  c.save();c.translate(0,bob);const box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  // Gaster, narrow waist, thorax, and independently angled head.
  box(4,13,14,8,dark);box(6,11,10,12,body);box(4,14,14,6,body);box(7,12,7,2,highlight);box(7,21,7,1,'#623722');box(17,16,4,3,dark);box(19,15,3,3,body);
  box(22,13,8,8,dark);box(23,12,6,9,body);box(24,13,4,2,highlight);box(29,16,4,2,dark);
  c.translate(34,17);c.rotate(s.head);const big=caste==='major',hy=big?-6:-4,hh=big?12:9;
  box(-3,hy,8,hh,dark);box(-3,hy+1,8,hh-2,body);box(-2,hy+1,5,2,highlight);box(3,-2,2,1,'#f2c68b');box(5,-2,2,1,'#deb481');box(5,2,2,1,'#deb481');
  for(const [side,angle,bend] of [[-1,s.left,s.leftBend],[1,s.right,s.rightBend]]){
    const ex=Math.cos(angle)*6.5,ey=side*2+Math.sin(angle)*6.5,tx=ex+Math.cos(angle+bend)*7.4,ty=ey+Math.sin(angle+bend)*7.4;
    line(c,1,side*2,ex,ey,'#462c21');line(c,ex,ey,tx,ty,'#e1b674');box(Math.round(tx),Math.round(ty),2,1,'#f0d19b');
  }c.restore();
}
export function buildAntAtlas(caste){
  const atlas=document.createElement('canvas');atlas.width=(GAIT_FRAMES+1)*SPRITE_W;atlas.height=SCAN_FRAMES*2*SPRITE_H;const c=atlas.getContext('2d');
  for(let wide=0;wide<2;wide++)for(let scan=0;scan<SCAN_FRAMES;scan++)for(let gait=0;gait<=GAIT_FRAMES;gait++){
    c.save();c.translate(gait*SPRITE_W,(wide*SCAN_FRAMES+scan)*SPRITE_H);paint(c,caste,gait,scan,wide);c.restore();
  }return atlas;
}
