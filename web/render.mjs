import {cell,key} from './sim.mjs';
const COLORS={soil:['#74543a','#7b593e','#705038','#805d42'],deep:['#544438','#58483a','#5d4a3d']};
function buffer(w,h) { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function antSprite(caste,frame) {
  const image=buffer(32,18),c=image.getContext('2d');
  const box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const body=caste==='queen'?'#a64e3d':caste==='soldier'?'#663d31':'#8f4d32';
  for(let leg=0;leg<3;leg++) { const x=13+leg*3,swing=(frame+leg)%2?1:-1;box(x,3,1,4,'#342823');box(x+swing,1,3,1,'#342823');box(x,10,1,4,'#342823');box(x-swing,14,3,1,'#342823'); }
  box(2,6,10,6,'#382b27');box(4,4,7,9,body);box(3,6,9,5,body);box(5,5,5,2,'#c88758');box(6,11,5,1,'#57332a');
  box(11,8,4,2,'#382b27');box(14,6,6,6,body);box(15,6,4,2,'#c88758');box(20,7,3,3,'#382b27');box(22,5,7,7,body);box(23,5,5,2,'#c88758');
  if(caste==='soldier') {box(23,3,6,3,body);box(29,6,3,1,'#dbad73');box(29,10,3,1,'#dbad73');}
  box(27,6,1,1,'#fbe4ad');box(27,3,1,3,'#382b27');box(28,2,3,1,'#382b27');box(27,11,1,3,'#382b27');box(28,14,3,1,'#382b27');return image;
}
function treeSprite(variant) {
  const image=buffer(96,116),c=image.getContext('2d'),box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  box(45,54,9,62,'#4a4132');box(47,58,3,55,'#766044');box(35,72,13,5,'#4a4132');box(33,62,5,14,'#4a4132');box(53,62,16,5,'#4a4132');box(64,51,5,14,'#4a4132');
  const colors=['#284d42','#35644b','#4c7b53','#71935d'];
  for(let i=0;i<29;i++) box(8+(i*19+variant*7)%65,12+(i*13)%53,18+(i%3)*5,13+(i%4)*3,colors[i%4]);
  for(let i=0;i<12;i++) box(20+(i*17)%60,20+(i*11)%35,5,3,'#93aa6d');return image;
}
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.width=1;this.height=1;this.camera={x:0,y:0,zoom:1};
    this.chunks=new Map();this.sprites={};this.positions=new Map();this.trees=[treeSprite(0),treeSprite(1),treeSprite(2)];
    for(const caste of ['queen','worker','soldier']) this.sprites[caste]=Array.from({length:4},(_,frame)=>antSprite(caste,frame));
    this.resize();this.home();
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    this.dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(rect.width*this.dpr);this.canvas.height=Math.round(rect.height*this.dpr);
  }
  get unit() { return 14*this.camera.zoom; }
  home() { this.camera={x:0,y:0,zoom:Math.max(.68,Math.min(1.3,this.width/960))}; }
  reset() {this.chunks.clear();this.positions.clear();this.home();}
  screen([x,y]) {return [this.width/2+(x-this.camera.x)*this.unit,this.height*.30+(y-this.camera.y)*this.unit];}
  world([x,y]) {return [(x-this.width/2)/this.unit+this.camera.x,(y-this.height*.30)/this.unit+this.camera.y];}
  zoom(factor,anchor=[this.width/2,this.height/2]) {
    const before=this.world(anchor);this.camera.zoom=Math.max(.35,Math.min(3,this.camera.zoom*factor));
    const after=this.world(anchor);this.camera.x+=before[0]-after[0];this.camera.y+=before[1]-after[1];
  }
  focus(a) {
    const wide=this.width>550;
    return {x:a.pos[0]+(wide?115/this.unit:0),y:a.pos[1]-(wide?this.height*.18/this.unit:0)};
  }
  chunk(world,cx,cy) {
    const id=key([cx,cy]),version=world.chunkRevisions.get(id)??0,old=this.chunks.get(id);
    if(old?.version===version) return old.image;
    const image=buffer(128,128),c=image.getContext('2d');
    const box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    for(let ly=0;ly<16;ly++) for(let lx=0;lx<16;lx++) {
      const pos=[cx*16+lx,cy*16+ly],[wx,wy]=pos,x=lx*8,y=ly*8;
      const hash=((Math.imul(wx,73856093)^Math.imul(wy,19349663)^(world.seed%10000))>>>0);
      if(world.solid(pos)) {
        const colors=wy>28?COLORS.deep:COLORS.soil;box(x,y,8,8,colors[hash%colors.length]);
        box(x+hash%6,y+Math.floor(hash/7)%6,2,1,'#946d4c');box(x+Math.floor(hash/17)%7,y+6,1,1,'#503e2e');
        if(!world.solid([wx,wy-1])) {box(x,y,8,1,wy<=1?'#8ea760':'#b28757');if(wy<=1)box(x,y+1,8,1,'#657a46');}
        if(!world.solid([wx-1,wy]))box(x,y,1,8,'#9b734d');
        if(!world.solid([wx,wy+1]))box(x,y+7,8,1,'#49392c');
        if(hash%19===0 && wy>2)box(x+2,y+2,3,2,'#a08a65');
        if(wy<6 && hash%5===0) {box(x+3,y,1,6,'#59452f');box(x+4,y+4,2,1,'#59452f');}
      } else if(wy>0) {box(x,y,8,8,hash%3===0?'#392b23':'#3d2f25');box(x+hash%7,y+Math.floor(hash/11)%7,1,1,'#4b392b');if(world.solid([wx,wy-1]))box(x,y,8,2,'#2c241e');}
    }
    this.chunks.set(id,{image,version});return image;
  }
  landscape() {
    const c=this.ctx,w=this.width,h=this.height,ground=this.screen([0,.5])[1],scale=this.camera.zoom;
    c.fillStyle='#241e1a';c.fillRect(0,0,w,h);
    const gradient=c.createLinearGradient(0,ground-220*scale,0,ground);gradient.addColorStop(0,'#91b6a3');gradient.addColorStop(1,'#c0d2b6');c.fillStyle=gradient;c.fillRect(0,0,w,Math.max(0,Math.min(h,ground)));
    const from=Math.floor((this.camera.x-w/this.unit/2)/22)-1,to=from+Math.ceil(w/this.unit/22)+3;
    for(let i=from;i<=to;i++) {
      const [x]=this.screen([i*22,0]);c.fillStyle=i%2?'#86aa90':'#789d85';
      c.beginPath();c.moveTo(x-150*scale,ground);c.lineTo(x-100*scale,ground-35*scale);c.lineTo(x-20*scale,ground-70*scale);c.lineTo(x+70*scale,ground-50*scale);c.lineTo(x+170*scale,ground);c.fill();
      if(i%2) {const cloudX=x-80*scale,cloudY=ground-145*scale-Math.abs(i%3)*16*scale;c.fillStyle='#e5e6ce88';for(let j=0;j<4;j++)c.fillRect(Math.round(cloudX+j*19*scale),Math.round(cloudY-j%2*4*scale),32*scale,(10+j%2*7)*scale);}
    }
    const treeFrom=Math.floor((this.camera.x-w/this.unit/2)/28)-1;
    for(let i=treeFrom;i<treeFrom+Math.ceil(w/this.unit/28)+3;i++) if(i!==0) {
      const [x]=this.screen([i*28-5,0]);c.drawImage(this.trees[Math.abs(i)%3],Math.round(x-53*scale),Math.round(ground-140*scale),106*scale,140*scale);
    }
    const plantFrom=Math.floor((this.camera.x-w/this.unit/2)/4)-1;
    for(let i=plantFrom;i<plantFrom+Math.ceil(w/this.unit/4)+3;i++) {
      const [x]=this.screen([i*4,0]);c.strokeStyle='#557b4b';c.lineWidth=2*scale;c.beginPath();c.moveTo(x,ground);c.lineTo(x-4*scale,ground-15*scale);c.lineTo(x+scale,ground-8*scale);c.moveTo(x,ground);c.lineTo(x+7*scale,ground-19*scale);c.stroke();
      if(i%4===0){c.fillStyle='#e5c183';c.fillRect(x+5*scale,ground-21*scale,5*scale,4*scale);}
    }
  }
  draw(colony,options,dt,clock) {
    const c=this.ctx,u=this.unit,z=this.camera.zoom;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;
    this.landscape();
    const min=this.world([-u*16,-u*16]),max=this.world([this.width+u*16,this.height+u*16]),visible=new Set();
    for(let cy=Math.floor(min[1]/16);cy<=Math.floor(max[1]/16);cy++) for(let cx=Math.floor(min[0]/16);cx<=Math.floor(max[0]/16);cx++) {
      const [x,y]=this.screen([cx*16-.5,cy*16-.5]);visible.add(key([cx,cy]));c.drawImage(this.chunk(colony.world,cx,cy),Math.round(x),Math.round(y),Math.ceil(u*16)+.2,Math.ceil(u*16)+.2);
    }
    for(const id of this.chunks.keys()) if(!visible.has(id))this.chunks.delete(id);
    if(options.trails) for(const [id,strength] of colony.world.pheromones) if(strength>.08) {const [x,y]=this.screen(cell(id));c.fillStyle=`rgba(180,206,138,${Math.min(.75,strength*.4)})`;c.fillRect(x-2*z,y-4*z,5*z,2*z);}
    for(const patch of colony.world.patches) if(patch.amount>0) {
      const [x,y]=this.screen(patch.cell);
      for(let i=0;i<Math.min(10,Math.floor(patch.amount/12)+2);i++){c.fillStyle=patch.kind==='water'?'#89c4c6':i%2?'#cfad66':'#b6cc6c';c.fillRect(x+(i%4*4-6)*z,y-(Math.floor(i/4)*3+5)*z,(patch.kind==='water'?6:4)*z,3*z);}
    }
    for(const baby of colony.brood) {const [x,y]=this.screen(baby.cell);c.fillStyle=baby.age<45?'#e9deb3':baby.age<100?'#d3c8a2':'#aa8a60';c.fillRect(x+baby.id%3*2*z,y,baby.age<45?3*z:5*z,3*z);}
    const live=new Set();
    for(const ant of colony.ants) {
      live.add(ant.id);let p=this.positions.get(ant.id);if(!p){p={x:ant.pos[0],y:ant.pos[1],angle:0};this.positions.set(ant.id,p);}
      const blend=1-Math.exp(-dt*22);p.x+=(ant.pos[0]-p.x)*blend;p.y+=(ant.pos[1]-p.y)*blend;
      if(ant.route.length){const next=ant.route[0],dx=next[0]-ant.pos[0],dy=next[1]-ant.pos[1];if(Math.abs(dx)+Math.abs(dy)>.01)p.angle=Math.atan2(dy,dx);}
      const [x,y]=this.screen([p.x,p.y]);if(x<-50 || y<-50 || x>this.width+50 || y>this.height+50)continue;
      if(ant.id===options.selected){c.strokeStyle='#ebc381';c.lineWidth=1.3;c.beginPath();c.arc(x,y,(ant.caste==='queen'?20:14)*z,0,Math.PI*2);c.stroke();}
      const moving=ant.route.length || ant.task==='digging',frame=Math.floor((options.paused?colony.time:clock)*(moving?9:2)+ant.id)%4;
      const width=(ant.caste==='queen'?34:ant.caste==='soldier'?23:20)*z,height=width*18/32;
      c.save();c.translate(Math.round(x),Math.round(y));c.rotate(p.angle);c.drawImage(this.sprites[ant.caste][frame],-width/2,-height/2,width,height);
      if(ant.carried){c.fillStyle=ant.task==='haulingSoil'?'#c29a61':ant.task==='returningWater'?'#93ccda':'#accf6d';c.fillRect(width*.35,-height*.3,4*z,4*z);}c.restore();
    }
    for(const id of this.positions.keys())if(!live.has(id))this.positions.delete(id);
  }
}
