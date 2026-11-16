import {cell,key,broodStage} from './sim.mjs';
import {MATERIALS,baseMaterial,hashCell} from './materials.mjs';
import {resourceTiles} from './resources.mjs';
import {terrainMask,densityAt,TERRAIN_PIXELS,CONTOUR_SAMPLES} from './geometry.mjs';
import {SIGNAL_COLORS} from './signals.mjs';
const rgbCache=new Map();function rgb(hex){if(!rgbCache.has(hex))rgbCache.set(hex,[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));return rgbCache.get(hex);}
function buffer(w,h) { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function antSprite(caste,frame) {
  const image=buffer(32,18),c=image.getContext('2d');
  const box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const body=caste==='queen'?'#914633':caste==='major'?'#873e29':'#b45a32';
  for(let leg=0;leg<3;leg++) { const x=13+leg*3,swing=(frame+leg)%2?1:-1;box(x,3,1,4,'#342823');box(x+swing,1,3,1,'#342823');box(x,10,1,4,'#342823');box(x-swing,14,3,1,'#342823'); }
  box(2,6,10,6,'#382b27');box(4,4,7,9,body);box(3,6,9,5,body);box(5,5,5,2,'#c88758');box(6,11,5,1,'#57332a');
  box(11,8,4,2,'#382b27');box(14,6,6,6,body);box(15,6,4,2,'#c88758');box(20,7,3,3,'#382b27');box(22,5,7,7,body);box(23,5,5,2,'#c88758');
  if(caste==='major') {box(22,2,7,11,body);box(23,3,5,2,'#ad7953');box(29,5,3,2,'#dbad73');box(29,10,3,2,'#dbad73');}
  box(27,6,1,1,'#fbe4ad');box(27,3,1,3,'#382b27');box(28,2,3,1,'#382b27');box(27,11,1,3,'#382b27');box(28,14,3,1,'#382b27');return image;
}
function broodPixel(c,stage,x,y,z){
  const box=(dx,dy,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x+dx*z),Math.round(y+dy*z),w*z,h*z);};
  if(stage==='egg'){box(-1,-2,3,4,'#f6efd8');box(0,-1,2,2,'#fffbed');}
  else if(stage==='larva'){box(-3,-1,2,3,'#c6c09d');box(-1,-2,4,4,'#e7dfb9');box(3,-1,2,2,'#f6ebc8');for(let i=-1;i<4;i+=2)box(i,0,1,2,'#c3b88f');}
  else{box(-5,-1,4,3,'#bfa26d');box(-1,-2,3,4,'#d5bd89');box(2,-1,3,3,'#cdb078');box(-2,-3,1,2,'#9c8256');box(0,2,1,2,'#9c8256');box(3,-2,1,1,'#f0dbab');}
}
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.width=1;this.height=1;this.camera={x:0,y:0,zoom:1};
    this.chunks=new Map();this.sprites={};this.positions=new Map();
    for(const caste of ['queen','worker','major']) this.sprites[caste]=Array.from({length:4},(_,frame)=>antSprite(caste,frame));
    this.resize();this.home();
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    this.dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(rect.width*this.dpr);this.canvas.height=Math.round(rect.height*this.dpr);
  }
  get unit() { return 14*this.camera.zoom; }
  home(world=null) {
    this.camera={x:0,y:0,zoom:Math.max(.68,Math.min(1.3,this.width/960))};if(!world?.deposits.size)return;
    let minX=0,maxX=0,minY=0,maxY=15;for(const ids of [world.excavated,world.deposits])for(const id of ids){const [x,y]=cell(id);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const top=this.width>550?110:170,bottom=this.height-96;
    this.camera.zoom=Math.max(.35,Math.min(this.camera.zoom,(this.width-48)/((maxX-minX+6)*14),Math.max(100,bottom-top)/((maxY-minY+6)*14)));
    this.camera.x=(minX+maxX)/2;this.camera.y=minY-3-(top-this.height*.30)/this.unit;
  }
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
    const size=16*TERRAIN_PIXELS,image=buffer(size,size),c=image.getContext('2d'),pixels=c.createImageData(size,size),data=pixels.data,mask=terrainMask(world,cx,cy),maskSize=16*CONTOUR_SAMPLES;
    const palette={};for(const [name,m] of Object.entries(MATERIALS)){palette[name]={colors:m.colors.map(rgb),light:rgb(m.light),dark:rgb(m.dark)};}
    const ox=cx*16-.5,oy=cy*16-.5,solid=(x,y)=>world.solid([x,y]);
    const filled=(x,y)=>x>=0&&x<maskSize&&y>=0&&y<maskSize?mask[y*maskSize+x]:densityAt(ox+(x+.5)/CONTOUR_SAMPLES,oy+(y+.5)/CONTOUR_SAMPLES,solid)>=.5;
    const cells=[];for(let ly=0;ly<16;ly++)for(let lx=0;lx<16;lx++){
      const wx=cx*16+lx,wy=cy*16+ly,type=world.deposits.has(key([wx,wy]))||wy<world.baseSurface(wx)?'spoil':baseMaterial([wx,wy],world.seed,world.baseSurface(wx));
      cells.push({wx,wy,type,base:palette[type].colors[0],wall:world.coveredMound([wx,wy])||(wy<world.baseSurface(wx)&&wy>world.surface(wx)),grass:type==='topsoil'&&wy===world.baseSurface(wx)&&!world.patches.some(p=>p.origin==='grass'&&p.stage==='dead'&&Math.abs(p.cell[0]-wx)<=1)});
    }
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const mx=x>>1,my=y>>1,inside=mask[my*maskSize+mx],info=cells[(y>>4)*16+(x>>4)],gx=cx*size+x,gy=cy*size+y,h=hashCell([gx,gy],world.seed),idx=(y*size+x)*4;
      let color,shade=0;
      if(inside){
        color=info.base;shade=((h>>>8)%9)-4;
        if(info.type!=='spoil'){const depth=oy+(y+.5)/TERRAIN_PIXELS-world.baseSurface(info.wx),mix=Math.max(0,Math.min(1,(depth-3+Math.sin((ox+x/TERRAIN_PIXELS)*.18+world.seed)*.65)/5));color=palette.topsoil.colors[0].map((v,i)=>v*(1-mix)+palette.earth.colors[0][i]*mix);}
        // Fine grains replace the old repeating eight-pixel blocks; crumb clusters remain distinct from rooted earth.
        const cluster=hashCell([Math.floor(gx/3),Math.floor(gy/2)],world.seed);
        if(info.type==='spoil'){if(cluster%7===0)color=palette.spoil.light;else if(cluster%9===0)color=palette.spoil.dark;}
        else if(h%29===0)color=palette[info.type].light;else if(h%37===0)color=palette[info.type].dark;
        if(info.type==='topsoil'&&cluster%127===0)shade-=18;
        if(!filled(mx,my-1))shade+=15;if(!filled(mx-1,my))shade+=6;if(!filled(mx,my+1))shade-=23;
        if(info.grass&&!filled(mx,my-1))color=rgb('#879d58');
      }else if(oy+(y+.5)/TERRAIN_PIXELS>=world.baseSurface(info.wx)-.5||info.wall){
        color=rgb(info.wall?'#58432e':info.type==='topsoil'?'#302a22':'#423525');shade=(h%9)-4;
        if(filled(mx,my-1)||filled(mx-1,my))shade-=10;
      }else continue;
      data[idx]=Math.max(0,Math.min(255,color[0]+shade));data[idx+1]=Math.max(0,Math.min(255,color[1]+shade));data[idx+2]=Math.max(0,Math.min(255,color[2]+shade));data[idx+3]=255;
    }
    c.putImageData(pixels,0,0);
    this.chunks.set(id,{image,version});return image;
  }
  landscape(world) {
    const c=this.ctx,w=this.width,h=this.height,ground=this.screen([0,.5])[1],scale=this.camera.zoom;
    c.fillStyle='#241e1a';c.fillRect(0,0,w,h);
    const gradient=c.createLinearGradient(0,ground-220*scale,0,ground);gradient.addColorStop(0,'#91b6a3');gradient.addColorStop(1,'#c0d2b6');c.fillStyle=gradient;c.fillRect(0,0,w,h);
    // One continuous stepped skyline avoids seams between distant hill sprites.
    for(let layer=0;layer<2;layer++){
      const step=Math.max(2,4*scale),phase=(world.seed%1000)*.01+this.camera.x*.018;
      c.fillStyle=layer?'#86aa90':'#9bb9a0';c.beginPath();c.moveTo(0,h);
      for(let px=0;px<=w+step;px+=step){
        const elevation=(55-layer*14+Math.sin(px*.007+phase+layer*2)*18+Math.sin(px*.017+phase*.5)*8)*scale;
        const y=Math.round(ground-elevation);c.lineTo(px,y);c.lineTo(px+step,y);
      }c.lineTo(w+step,h);c.closePath();c.fill();
    }
    for(let i=0;i<Math.ceil(w/(240*scale));i++){
      const x=((i*271+world.seed%170)*scale-this.camera.x*2)%(w+200*scale),y=ground-(140+i%3*13)*scale;
      c.fillStyle='#e5e6ce66';for(let j=0;j<4;j++)c.fillRect(Math.round(x+j*19*scale),Math.round(y-j%2*4*scale),32*scale,(10+j%2*7)*scale);
    }
  }
  surfaceLife(world,clock){
    const c=this.ctx,z=this.camera.zoom,u=this.unit;
    for(const p of world.patches){
      const [x,y]=this.screen([p.cell[0],world.surface(p.cell[0])-.5]);if(x<-100||x>this.width+100)continue;
      if(p.kind==='food'&&p.origin==='grass'){
        if(world.surface(p.cell[0])<world.baseSurface(p.cell[0]) )continue;
        const alive=p.stage!=='dead',growth=p.stage==='sprout'?Math.max(.15,p.growth):1;
        for(let i=0;i<5;i++){
          const dx=(i*3-6)*z,h=(10+(p.id+i)%7)*z*growth,sway=alive?Math.sin(clock*1.2+p.id+i*.5)*1.2*z:0;
          c.strokeStyle=alive?(i%2?'#6e934b':'#4c783d'):'#8b7c4f';c.lineWidth=Math.max(1,z);c.beginPath();c.moveTo(x+dx,y);c.lineTo(x+dx+sway+(alive?0:4*z),y-h*(alive?1:.35));c.stroke();
          if(alive){c.strokeStyle='#82a454';c.beginPath();c.moveTo(x+dx,y-h*.35);c.lineTo(x+dx+(i%2?4:-4)*z,y-h*.65);c.stroke();}
          if(p.stage==='seed'&&i<Math.ceil(p.amount/p.capacity*5)){
            c.fillStyle=i%2?'#e3bf70':'#cda151';for(let grain=0;grain<3;grain++)c.fillRect(Math.round(x+dx+sway+(grain%2?1:-2)*z),Math.round(y-h+grain*3*z),3*z,2*z);
          }
        }
      }
      if(p.kind==='water'||p.origin==='prey'||p.origin==='nectar'){
        const tiles=resourceTiles(world,p);
        for(const tile of tiles){const [tx,ty]=this.screen([tile.x,tile.y]);
          c.globalAlpha=Math.min(1,tile.amount/2);c.fillStyle=p.kind==='water'?'#80c3cf':p.origin==='prey'?'#ba755b':'#ecc56b';
          const size=p.kind==='water'?u/3-.3:u*.20;c.fillRect(Math.round(tx-size/2),Math.round(ty-size/2),size,size);
          c.fillStyle=p.kind==='water'?'#c2e6e9':p.origin==='prey'?'#e2a982':'#fff0b1';c.fillRect(Math.round(tx-size/2),Math.round(ty-size/2),Math.max(1,size*.6),Math.max(1,z));c.globalAlpha=1;
        }
        if(p.origin==='nectar'&&p.renewable!==false){c.strokeStyle='#577d46';c.lineWidth=Math.max(1,z);c.beginPath();c.moveTo(x,y);c.lineTo(x-2*z,y-12*z);c.stroke();c.fillStyle='#c1a3bd';c.fillRect(x-4*z,y-14*z,5*z,3*z);}
      }
    }
  }
  rainfall(world,clock){
    if(!world.weather.raining)return;const c=this.ctx,z=this.camera.zoom;
    c.fillStyle='#7898a015';c.fillRect(0,0,this.width,this.height);
    c.strokeStyle='#b7d5d977';c.lineWidth=Math.max(1,z);
    for(let i=0;i<Math.floor(this.width/9);i++){
      const x=(i*97+clock*32)%this.width,y=(i*61+clock*250)%(this.height+80)-40;
      const wx=this.world([x,y])[0],ground=this.screen([wx,world.surface(Math.round(wx))-.5])[1];if(y>ground)continue;
      c.beginPath();c.moveTo(x,y);c.lineTo(x-3*z,y+8*z);c.stroke();
    }
  }

  draw(colony,options,dt,clock) {
    const c=this.ctx,u=this.unit,z=this.camera.zoom;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;
    this.landscape(colony.world);
    const min=this.world([-u*16,-u*16]),max=this.world([this.width+u*16,this.height+u*16]),visible=new Set();
    for(let cy=Math.floor(min[1]/16);cy<=Math.floor(max[1]/16);cy++) for(let cx=Math.floor(min[0]/16);cx<=Math.floor(max[0]/16);cx++) {
      const [x,y]=this.screen([cx*16-.5,cy*16-.5]);visible.add(key([cx,cy]));c.drawImage(this.chunk(colony.world,cx,cy),Math.round(x),Math.round(y),Math.ceil(u*16)+.2,Math.ceil(u*16)+.2);
    }
    for(const id of this.chunks.keys()) if(!visible.has(id))this.chunks.delete(id);
    if(options.trails)for(const [kind,map] of Object.entries(colony.world.signals))for(const [id,strength] of map)if(strength>.08){const [x,y]=this.screen(cell(id));c.globalAlpha=Math.min(.8,strength*.4);c.fillStyle=SIGNAL_COLORS[kind];c.fillRect(x-2*z,y-4*z,kind==='alarm'?6*z:4*z,kind==='alarm'?4*z:2*z);c.globalAlpha=1;}
    const visualClock=options.paused?colony.time:clock;
    this.surfaceLife(colony.world,visualClock);
    for(const baby of colony.brood)if(baby.carriedBy==null){const [x,y]=this.screen(baby.cell);broodPixel(c,broodStage(baby),x+(baby.id%3-1)*2*z,y+2*z,z);}
    const carriedBrood=new Map(colony.brood.filter(b=>b.carriedBy!=null).map(b=>[b.carriedBy,b]));
    const live=new Set();
    for(const ant of colony.ants) {
      live.add(ant.id);let p=this.positions.get(ant.id);if(!p){p={x:ant.pos[0],y:ant.pos[1],angle:0};this.positions.set(ant.id,p);}
      const blend=options.speed>4?1:1-Math.exp(-dt*22);p.x+=(ant.pos[0]-p.x)*blend;p.y+=(ant.pos[1]-p.y)*blend;
      if(ant.route.length){const next=ant.route[0],dx=next[0]-ant.pos[0],dy=next[1]-ant.pos[1];if(Math.abs(dx)+Math.abs(dy)>.01)p.angle=Math.atan2(dy,dx);}
      const [x,y]=this.screen([p.x,p.y]);if(x<-50 || y<-50 || x>this.width+50 || y>this.height+50)continue;
      if(ant.id===options.selected){c.strokeStyle='#ebc381';c.lineWidth=1.3;c.beginPath();c.arc(x,y,(ant.caste==='queen'?20:14)*z,0,Math.PI*2);c.stroke();}
      const moving=ant.route.length || ['digging','harvesting'].includes(ant.task),frame=Math.floor((options.paused?colony.time:clock)*(moving?9:2)+ant.id)%4;
      const width=(ant.caste==='queen'?31:13+ant.bodySize*9)*z,height=width*18/32;
      c.save();c.translate(Math.round(x),Math.round(y));c.rotate(p.angle);if(ant.task==='laying')c.scale(1+Math.sin(visualClock*7)*.045,1);c.drawImage(this.sprites[ant.caste][frame],-width/2,-height/2,width,height);
      if(carriedBrood.has(ant.id))broodPixel(c,broodStage(carriedBrood.get(ant.id)),width*.55,0,z);
      if(ant.task==='laying'&&colony.time>ant.layUntil-2){c.fillStyle='#fff0cb';c.fillRect(-width*.55,-z,3*z,3*z);}
      if(ant.carried){c.fillStyle=ant.cargoKind==='soil'?'#c29a61':ant.cargoKind==='water'?'#93ccda':ant.cargoNutrition?.protein>.5?'#ba755b':'#ecc56b';for(let unit=0;unit<Math.ceil(ant.carried/2);unit++)c.fillRect(width*.35+unit*3*z,-height*.3,3*z,3*z);}c.restore();
    }
    for(const id of this.positions.keys())if(!live.has(id))this.positions.delete(id);
    this.rainfall(colony.world,visualClock);
  }
}
