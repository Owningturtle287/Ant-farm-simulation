import {broodStage} from './biology.mjs';
export function paintBrood(c,b,x,y,z,clock,transition=1,previous=null){
  const stage=broodStage(b),phase=clock*2.7+b.id*1.9;
  const draw=(kind,alpha)=>{c.save();c.globalAlpha*=alpha;c.translate(Math.round(x),Math.round(y));const box=(dx,dy,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(dx*z),Math.round(dy*z),Math.max(1,w*z),Math.max(1,h*z));};
    if(kind==='egg'){box(-2,-3,3,6,'#b6b9a0');box(-1,-3,2,5,'#fbf8e4');box(-2,-2,4,3,'#eeeccd');box(-1,-2,1,2,'#ffffff');}
    else if(kind==='larva'){const flex=Math.sin(phase)*.35;box(-4,-1+flex,2,3,'#b6a97d');box(-3,-3,3,5,'#ece1ab');box(-1,-3,3,6,'#f4e9bc');box(1,-2,3,5,'#e3d09b');box(3,0,2,3,'#d6ba84');box(3,0,2,1,'#8f603e');for(let i=-2;i<4;i+=2)box(i,-1,1,3,'#c6b581');box(-2,-3,3,1,'#fff6d3');}
    else {box(-5,-2,4,4,'#e5c898');box(-4,-3,3,5,'#f5dfb3');box(-1,-1,2,2,'#bda477');box(1,-2,3,4,'#ead1a7');box(4,-2,3,4,'#f4e0bb');box(5,-1,1,1,b.age>26*600?'#8d493a':'#bca278');for(const side of [-1,1]){box(1,side*2,3,1,'#c8ae86');box(3,side*3,2,1,'#dcc6a1');}box(-3,-2,1,3,'#d2b689');}
    c.restore();
  };
  if(previous&&transition<1){draw(previous,1-transition);draw(stage,transition);c.save();c.strokeStyle='#f9e4af';c.globalAlpha=.45*Math.sin(transition*Math.PI);c.lineWidth=Math.max(1,z*.5);c.beginPath();c.arc(x,y,(4+transition*3)*z,0,Math.PI*2);c.stroke();c.restore();}else draw(stage,1);
}
