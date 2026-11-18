import {paintBrood} from './brood-art.mjs';
import {bedPosition} from './provisions.mjs';
import {paintGrain,paintWater} from './resource-art.mjs';
import {TerrainCache} from './render-cache.mjs';
import {rasterRows,coarseTerrain,snapshotTerrain} from './terrain-raster.mjs';
import {cell,key,broodStage} from './sim.mjs';
import {resourceTiles} from './resources.mjs';
import {ChemicalOverlay} from './chemical-art.mjs';
import {wrapAngle,antennaTips} from './locomotion.mjs';
import {buildAntAtlas,buildAntParts,GAIT_FRAMES,SCAN_FRAMES,SPRITE_W,SPRITE_H} from './ant-art.mjs';
const visualClockForWater=(options,colony,clock)=>options.paused?colony.time:clock;
function buffer(w,h) { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.width=1;this.height=1;this.camera={x:0,y:0,zoom:1};
    this.broodPoses=new Map();this.chemicals=new ChemicalOverlay();this.chunks=new TerrainCache();this.sprites={};this.bodyParts={};this.positions=new Map();this.frameID=0;this.epoch=0;this.active=null;this.requests=new Map();this.fallback=null;this.renderStats={worker:false,built:0,hits:0,misses:0,mainRasterMs:0,workerRasterMs:0,drawnAnts:0};
    try{this.worker=new Worker(new URL('./terrain-worker.mjs',import.meta.url),{type:'module'});this.renderStats.worker=true;this.worker.onmessage=e=>this.acceptTerrain(e.data);this.worker.onerror=()=>this.workerFailed();}catch{this.worker=null;}
    for(const caste of ['queen','worker','major']){this.sprites[caste]=buildAntAtlas(caste);this.bodyParts[caste]=buildAntParts(caste);}
    this.resize();this.home();
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();this.width=rect.width;this.height=rect.height;this.nativeDpr=Math.min(2,window.devicePixelRatio||1);this.resolution(this.nativeDpr);
  }
  resolution(dpr){const width=Math.round(this.width*dpr),height=Math.round(this.height*dpr);if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;this.dpr=dpr;this.canvas.dataset.renderDpr=String(dpr);}
  cameraInput(){this.motionUntil=performance.now()+180;}
  get unit() { return 14*this.camera.zoom; }
  home(world=null) {
    this.camera={x:0,y:0,zoom:Math.max(.68,Math.min(1.3,this.width/960))};if(!world?.deposits.size)return;
    let minX=0,maxX=0,minY=0,maxY=15;for(const ids of [world.excavated,world.deposits])for(const id of ids){const [x,y]=cell(id);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const top=this.width>550?110:170,bottom=this.height-96;
    this.camera.zoom=Math.max(.10,Math.min(this.camera.zoom,(this.width-48)/((maxX-minX+6)*14),Math.max(100,bottom-top)/((maxY-minY+6)*14)));
    this.camera.x=(minX+maxX)/2;this.camera.y=minY-3-(top-this.height*.30)/this.unit;
  }
  reset() {this.broodPoses.clear();this.epoch++;this.chunks.clear();this.positions.clear();this.requests.clear();this.active=null;this.fallback=null;this.home();}
  screen([x,y]) {return [this.width/2+(x-this.camera.x)*this.unit,this.height*.30+(y-this.camera.y)*this.unit];}
  world([x,y]) {return [(x-this.width/2)/this.unit+this.camera.x,(y-this.height*.30)/this.unit+this.camera.y];}
  zoom(factor,anchor=[this.width/2,this.height/2]) {
    this.cameraInput();const before=this.world(anchor);this.camera.zoom=Math.max(.10,Math.min(3,this.camera.zoom*factor));
    const after=this.world(anchor);this.camera.x+=before[0]-after[0];this.camera.y+=before[1]-after[1];
  }
  focus(a) {
    const wide=this.width>550;
    return {x:a.pos[0]+(wide?115/this.unit:0),y:a.pos[1]-(wide?this.height*.18/this.unit:0)};
  }
  terrainImage(result){const image=buffer(result.size,result.size);image.getContext('2d').putImageData(new ImageData(result.data,result.size,result.size),0,0);return image;}
  acceptTerrain(job){
    if(job.epoch!==this.epoch)return;const active=this.active;if(!active)return;if(job.error){this.workerFailed();return;}
    const jobs=job.batch??[job];for(const result of jobs){if(!(active.ids??[active.id]).includes(result.id))continue;this.chunks.put(result.id,{image:this.terrainImage({data:new Uint8ClampedArray(result.pixels),size:result.size}),bytes:result.size*result.size*4,version:result.version,detail:true,at:performance.now()});this.renderStats.built++;this.renderStats.workerRasterMs=result.cost;}this.active=null;
  }
  workerFailed(){this.worker?.terminate();this.worker=null;this.active=null;this.fallback=null;this.renderStats.worker=false;}
  chunk(world,cx,cy,lod){
    const id=`${cx},${cy},${lod}`,version=world.chunkRevisions.get(key([cx,cy]))??0,old=this.chunks.get(id);
    if(old?.version===version&&old.detail){this.renderStats.hits++;return old.image;}
    if(old?.detail&&performance.now()-old.at<100)return old.image;
    this.renderStats.misses++;this.requests.set(id,{id,cx,cy,lod,version,priority:(old?.detail?1000:0)+Math.hypot(cx*16+8-this.camera.x,cy*16+8-this.camera.y)});
    if(old)return old.image;
    for(const other of [8,4,2,16])if(other!==lod){const alternate=this.chunks.get(`${cx},${cy},${other}`);if(alternate?.detail)return alternate.image;}
    if(performance.now()>this.previewDeadline)return null;
    const began=performance.now(),snapshot=snapshotTerrain(world,cx,cy,lod),result=coarseTerrain(snapshot),image=this.terrainImage(result);this.chunks.put(id,{image,bytes:16*16*4,version,detail:false});this.renderStats.mainRasterMs+=performance.now()-began;return image;
  }
  serviceTerrain(world){
    if(this.active)return;
    if(this.fallback){const until=performance.now()+1.5;let result;do{result=this.fallback.rows.next();}while(!result.done&&performance.now()<until);if(result.done){const f=this.fallback;this.fallback=null;this.chunks.put(f.job.id,{image:this.terrainImage(result.value),bytes:result.value.size**2*4,version:f.job.version,detail:true,at:performance.now()});this.renderStats.built++;}return;}
    const sorted=[...this.requests.values()].sort((a,b)=>a.priority-b.priority),job=sorted[0];if(!job)return;
    if(this.worker){
      const batch=sorted.slice(0,job.lod<=2?12:job.lod<=4?4:1).map(j=>({...j,epoch:this.epoch,snapshot:snapshotTerrain(world,j.cx,j.cy,j.lod)})),transfers=batch.flatMap(j=>[j.snapshot.solid.buffer,j.snapshot.ground.buffer,j.snapshot.surface.buffer,j.snapshot.deposits.buffer,j.snapshot.covered.buffer]);this.active={ids:batch.map(j=>j.id)};this.worker.postMessage({epoch:this.epoch,batch},transfers);
    }else this.fallback={job,rows:rasterRows(snapshotTerrain(world,job.cx,job.cy,job.lod))};
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
        }
      }
      if(p.kind==='water'||p.origin==='prey'||p.origin==='nectar'||p.origin==='grass'&&p.stage==='seed'){
        const tiles=resourceTiles(world,p);
        if(p.kind==='water'){
          const sorted=tiles.sort((a,b)=>b.y-a.y||a.x-b.x);
          for(let i=0;i<sorted.length;){
            const first=sorted[i++];let last=first,total=first.amount,count=1;
            while(i<sorted.length&&sorted[i].y===first.y&&sorted[i].x-last.x<.35){
              last=sorted[i++];total+=last.amount;count++;
            }
            const [tx,ty]=this.screen([(first.x+last.x)/2,first.y]);
            if(ty<-u||ty>this.height+u)continue;
            const portion=Math.sqrt(total/(2*count));
            paintWater(c,tx,ty,Math.max(1,u*(last.x-first.x+.34*portion)),Math.max(1,u*.29*portion),clock*3+p.id*.7+first.x*.4);
          }
        }else for(const tile of tiles){
          const [tx,ty]=this.screen([tile.x,tile.y]);if(ty<-u||ty>this.height+u)continue;
          if(p.origin==='grass'){paintGrain(c,tx,ty,u*.24,tile.id??0,tile.amount/2);continue;}
          const size=u*.20;c.globalAlpha=Math.min(1,tile.amount/2);
          c.fillStyle=p.origin==='prey'?'#ba755b':'#ecc56b';
          c.fillRect(Math.round(tx-size/2),Math.round(ty-size/2),size,size);
          c.fillStyle=p.origin==='prey'?'#e2a982':'#fff0b1';
          c.fillRect(Math.round(tx-size/2),Math.round(ty-size/2),Math.max(1,size*.6),Math.max(1,z));c.globalAlpha=1;
        }
        if(p.origin==='nectar'&&p.renewable!==false){c.strokeStyle='#577d46';c.lineWidth=Math.max(1,z);c.beginPath();c.moveTo(x,y);c.lineTo(x-2*z,y-12*z);c.stroke();c.fillStyle='#c1a3bd';c.fillRect(x-4*z,y-14*z,5*z,3*z);}
      }
    }
  }
  groundwater(world,clock){
    if(!world.groundwater)return;const c=this.ctx,u=this.unit,min=this.world([0,0]),max=this.world([this.width,this.height]);if(max[1]<world.groundwater.depth-12)return;
    c.beginPath();let first=true;for(let x=Math.floor(min[0])-1;x<=Math.ceil(max[0])+1;x++){const p=this.screen([x,world.waterTable(x)]);if(first){c.moveTo(...p);first=false;}else c.lineTo(...p);}c.lineTo(this.width,this.height);c.lineTo(0,this.height);c.closePath();c.fillStyle='#4e9baa25';c.fill();
    c.strokeStyle='#9acbd282';c.lineWidth=Math.max(1,this.camera.zoom);c.beginPath();first=true;for(let x=Math.floor(min[0])-1;x<=Math.ceil(max[0])+1;x++){const p=this.screen([x,world.waterTable(x)+Math.sin(clock*.7+x*.15)*.025]);if(first){c.moveTo(...p);first=false;}else c.lineTo(...p);}c.stroke();
    for(const id of world.excavated){const cell=id.split(',').map(Number);if(cell[0]<min[0]-1||cell[0]>max[0]+1||cell[1]<min[1]-1||cell[1]>max[1]+1||cell[1]<world.waterTable(cell[0])-.25)continue;const [x,y]=this.screen(cell);c.fillStyle='#438daba8';c.fillRect(x-u*.43,y-u*.43,u*.86,u*.86);}
  }
  rainfall(world,clock){
    if(!world.weather.raining)return;const c=this.ctx,z=this.camera.zoom,intensity=world.weather.intensity??.7;
    c.fillStyle='#6d889720';c.fillRect(0,0,this.width,this.height);c.lineWidth=Math.max(.7,z*.7);
    const count=Math.min(240,Math.floor(this.width/(8+8*(1-intensity))));for(let i=0;i<count;i++){
      const speed=210+(i%7)*18,wind=8+Math.sin(clock*.23)*8,x=((i*97-clock*wind)%(this.width+60)+this.width+60)%(this.width+60)-30,y=(i*61+clock*speed)%(this.height+100)-50,wx=this.world([x,y])[0],ground=this.screen([wx,world.surface(Math.round(wx))-.5])[1];
      if(y>ground)continue;c.strokeStyle=i%3?'#b3d3df80':'#d2e3e899';c.beginPath();c.moveTo(x,y);c.lineTo(x-3*z,y+(7+i%4*2)*z);c.stroke();
      const phase=(clock*2+i*.37)%1;if(ground>0&&ground<this.height&&phase<.3){const r=(1-phase/.3)*2.5*z;c.fillStyle='#bedad370';c.fillRect(x-r,ground-phase*7*z,Math.max(1,z),Math.max(1,z));c.fillRect(x+r,ground-phase*5*z,Math.max(1,z),Math.max(1,z));}
    }
    for(const p of world.patches)if(p.kind==='water'&&p.origin==='puddle'&&p.amount>0){const [x,y]=this.screen([p.cell[0],world.surface(p.cell[0])-.65]),t=(clock*1.3+p.id*.21)%1;if(x<0||x>this.width||y<0||y>this.height)continue;c.strokeStyle='#d0e5e6';c.globalAlpha=(1-t)*.5;c.beginPath();c.ellipse(x,y,(2+t*7)*z,(1+t*2)*z,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;
  }

  draw(colony,options,dt,clock) {
    this.resolution(performance.now()<(this.motionUntil??0)?Math.min(1,this.nativeDpr):this.nativeDpr);
    const c=this.ctx,u=this.unit,z=this.camera.zoom;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;
    this.canvas.dataset.cameraZoom=this.camera.zoom.toFixed(3);this.frameID++;this.landscape(colony.world);
    this.requests.clear();this.previewDeadline=performance.now()+1.5;this.renderStats.drawnAnts=0;this.renderStats.crowdSkipped=0;this.renderStats.simpleSprites=0;const crowd=new Map(),crowdWidth=Math.max(4,8*z),crowdHeight=Math.max(4,5*z),richBudget=Math.max(400,Math.min(1500,Math.ceil(this.width*this.height/800)));const density=u*this.dpr,lod=this.worker&&density>=13?16:density>=6?8:density>=4?4:2;
    const min=this.world([-u,-u]),max=this.world([this.width+u,this.height+u]);
    for(let cy=Math.floor(min[1]/16);cy<=Math.floor(max[1]/16);cy++) for(let cx=Math.floor(min[0]/16);cx<=Math.floor(max[0]/16);cx++) {
      const [x,y]=this.screen([cx*16-.5,cy*16-.5]),image=this.chunk(colony.world,cx,cy,lod);if(image)c.drawImage(image,Math.round(x),Math.round(y),Math.ceil(u*16)+.2,Math.ceil(u*16)+.2);else{const ground=this.screen([cx*16,colony.world.baseSurface(cx*16)-.5])[1],top=Math.max(y,ground);if(top<y+u*16){c.fillStyle='#806446';c.fillRect(x,top,u*16,y+u*16-top);}}
    }
    this.serviceTerrain(colony.world);this.groundwater(colony.world,visualClockForWater(options,colony,clock));
    if(options.trails)this.chemicals.draw(c,colony.world,this,performance.now());
    const visualClock=options.paused?colony.time:clock;
    this.surfaceLife(colony.world,visualClock);
    for(const baby of colony.brood)if(baby.carriedBy==null&&baby.cell[0]>=min[0]-1&&baby.cell[0]<=max[0]+1&&baby.cell[1]>=min[1]-1&&baby.cell[1]<=max[1]+1){const [x,y]=this.screen(bedPosition(baby));let pose=this.broodPoses.get(baby.id);const stage=broodStage(baby);if(!pose){pose={stage,changed:clock};this.broodPoses.set(baby.id,pose);}if(pose.stage!==stage){pose.previous=pose.stage;pose.stage=stage;pose.changed=clock;}paintBrood(c,baby,x,y,z,visualClock,Math.min(1,(clock-pose.changed)/.85),pose.previous);}
    for(const item of colony.foodItems){const [x,y]=this.screen(item.pos);if(x<-u||y<-u||x>this.width+u||y>this.height+u)continue;if(item.origin==='grass'){paintGrain(c,x,y,u*.24,item.id,(item.energy+item.protein)/2);continue;}const d=Math.max(1,u*.23);c.fillStyle=item.protein>item.energy?'#b97950':'#d4b56d';c.fillRect(Math.round(x-d/2),Math.round(y-d/2),d,d*.7);c.fillStyle='#efd39a';c.fillRect(Math.round(x-d/2),Math.round(y-d/2),Math.max(1,d*.6),Math.max(1,z*.6));}
    const carriedBrood=new Map(colony.brood.filter(b=>b.carriedBy!=null).map(b=>[b.carriedBy,b]));
    const live=new Set();
    for(const ant of colony.ants) {
      live.add(ant.id);if(ant.pos[0]<min[0]-3||ant.pos[0]>max[0]+3||ant.pos[1]<min[1]-3||ant.pos[1]>max[1]+3)continue;const bucket=Math.floor((this.width/2+(ant.pos[0]-this.camera.x)*u)/crowdWidth)+','+Math.floor((this.height*.3+(ant.pos[1]-this.camera.y)*u)/crowdHeight),count=crowd.get(bucket)??0;if(count>=(z<1.3?1:3)&&ant.id!==options.selected&&ant.caste!=='queen'){this.renderStats.crowdSkipped++;continue;}crowd.set(bucket,count+1);this.renderStats.drawnAnts++;if(z<.5&&ant.id!==options.selected&&ant.caste!=='queen'){const [sx,sy]=this.screen(ant.pos);c.fillStyle='#b45a32';c.fillRect(Math.round(sx),Math.round(sy),1,1);this.renderStats.simpleSprites++;continue;}let p=this.positions.get(ant.id);if(!p){p={x:ant.pos[0],y:ant.pos[1],angle:ant.motion?.angle??0,neck:ant.motion?.neck??0,waist:ant.motion?.waist??0,gait:0,scan:ant.motion?.phase??0,hatchAt:ant.bornAt>0&&colony.time-ant.bornAt<4?clock:null};this.positions.set(ant.id,p);}
      if(p.frame!==this.frameID-1){p.x=ant.pos[0];p.y=ant.pos[1];p.angle=ant.motion?.angle??0;}p.frame=this.frameID;
      const oldX=p.x,oldY=p.y,blend=options.speed>4?1:1-Math.exp(-dt*22);p.x+=(ant.pos[0]-p.x)*blend;p.y+=(ant.pos[1]-p.y)*blend;
      const motion=ant.motion,angle=motion?.angle??p.angle;if(!options.paused){p.angle=wrapAngle(p.angle+wrapAngle(angle-p.angle)*blend);p.scan=wrapAngle(p.scan+wrapAngle((motion?.phase??0)-p.scan)*blend);if((motion?.speed??0)>.06&&(ant.route.length||motion?.recovering))p.gait=((p.gait+Math.min(Math.hypot(p.x-oldX,p.y-oldY),dt*4)*2.7*GAIT_FRAMES*(motion?.gaitDirection??1))%GAIT_FRAMES+GAIT_FRAMES)%GAIT_FRAMES;}else{p.angle=angle;p.scan=motion?.phase??0;}
      const jointBlend=options.paused?1:blend;p.neck+=((motion?.neck??0)-(p.neck??0))*jointBlend;p.waist+=((motion?.waist??0)-(p.waist??0))*jointBlend;const [x,y]=this.screen([p.x,p.y]);if(x<-50 || y<-50 || x>this.width+50 || y>this.height+50)continue;
      if(ant.id===options.selected){c.strokeStyle='#ebc381';c.lineWidth=1.3;c.beginPath();c.arc(x,y,(ant.caste==='queen'?20:14)*z,0,Math.PI*2);c.stroke();}
      if(this.renderStats.drawnAnts>richBudget&&ant.id!==options.selected&&ant.caste!=='queen'){c.fillStyle='#b45a32';c.fillRect(Math.round(x),Math.round(y),Math.max(1,2*z),Math.max(1,z));this.renderStats.simpleSprites++;continue;}
      const moving=(motion?.speed??0)>.06&&(ant.route.length||motion?.recovering),frame=moving?Math.floor(p.gait):GAIT_FRAMES;
      const scan=Math.floor(((p.scan/(Math.PI*2)+1)%1)*SCAN_FRAMES)%SCAN_FRAMES,wide=['searching','sampling','resting'].includes(motion?.mode),row=scan+(wide?SCAN_FRAMES:0);
      const width=(ant.caste==='queen'?18:9.5+ant.bodySize*4.5)*z,height=width*SPRITE_H/SPRITE_W;
      c.save();c.translate(x,y);c.rotate(p.angle);if(p.hatchAt!=null&&clock-p.hatchAt<1.3){c.filter='brightness(1.45) saturate(.55)';c.fillStyle='#e8d6ad';c.fillRect(-8*z,3*z,2*z,z);c.fillRect(-5*z,4*z,2*z,z);}if(ant.task==='laying')c.scale(1+Math.sin(visualClock*7)*.045,1);if(z>=.95||ant.id===options.selected||ant.caste==='queen'){
        const parts=this.bodyParts[ant.caste],px=width/SPRITE_W,draw=(source,sx=0,sy=0,pivot=26)=>c.drawImage(source,sx,sy,SPRITE_W,SPRITE_H,-pivot*px,-17*px,width,height);
        draw(parts.legs,frame*SPRITE_W);draw(parts.thorax);c.save();c.translate(-6*px,0);c.rotate(p.waist??0);draw(parts.abdomen,0,0,20);c.restore();c.save();c.translate(4*px,0);c.rotate(p.neck??0);draw(parts.head,scan*SPRITE_W,wide?SPRITE_H:0,30);c.restore();
      }else c.drawImage(this.sprites[ant.caste],frame*SPRITE_W,row*SPRITE_H,SPRITE_W,SPRITE_H,-width*26/SPRITE_W,-height/2,width,height);
      if(ant.task==='laying'&&colony.time>ant.layUntil-2){c.fillStyle='#fff0cb';c.fillRect(-width*.55,-z,3*z,3*z);}
      if(carriedBrood.has(ant.id)||ant.carried){c.save();c.translate(width*4/SPRITE_W,0);c.rotate(z>=.95||ant.id===options.selected||ant.caste==='queen'?p.neck??0:0);
        if(carriedBrood.has(ant.id))paintBrood(c,carriedBrood.get(ant.id),width*.32,0,z,visualClock);
        if(ant.carried&&ant.cargoKind==='food'&&ant.cargoOrigin==='grass')paintGrain(c,width*.34,-height*.2,u*.24,ant.id,ant.carried/2);
        else if(ant.carried){c.fillStyle=ant.cargoKind==='soil'?'#c29a61':ant.cargoKind==='water'?'#93ccda':ant.cargoNutrition?.protein>.5?'#ba755b':'#ecc56b';for(let unit=0;unit<Math.ceil(ant.carried/2);unit++)c.fillRect(width*.28+unit*3*z,-height*.3,3*z,3*z);}c.restore();}c.restore();
    }
    const broodIDs=new Set(colony.brood.map(b=>b.id));for(const id of this.broodPoses.keys())if(!broodIDs.has(id))this.broodPoses.delete(id);
    for(const id of this.positions.keys())if(!live.has(id))this.positions.delete(id);
    if(options.trails&&options.selected!=null){const a=colony.ants.find(a=>a.id===options.selected);if(a?.motion){const tips=antennaTips(a);for(const [side,color] of [['left','#bce77f'],['right','#77d9e8']]){const [x,y]=this.screen(tips[side]);c.strokeStyle=color;c.globalAlpha=.55;c.lineWidth=1;c.beginPath();c.arc(x,y,Math.max(2,u*.10),0,Math.PI*2);c.stroke();}c.globalAlpha=1;}}
    this.rainfall(colony.world,visualClock);
  }
}
