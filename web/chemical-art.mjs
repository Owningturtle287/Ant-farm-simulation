import {SIGNAL_COLORS} from './signals.mjs';
const OFFSETS=[[1,0],[0,1],[1,1],[-1,1]];
function glow(color){const image=document.createElement('canvas');image.width=image.height=32;const c=image.getContext('2d'),g=c.createRadialGradient(16,16,1,16,16,16);g.addColorStop(0,color+'ac');g.addColorStop(.3,color+'58');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,32,32);return image;}
export class ChemicalOverlay{
  constructor(){this.glows=Object.fromEntries(Object.entries({...SIGNAL_COLORS,odor:'#e6b968',moisture:'#82afda'}).map(([kind,color])=>[kind,glow(color)]));this.next=0;this.geometry=[];}
  collect(w,now){
    if(this.world===w&&now<this.next)return;this.world=w;this.next=now+250;this.geometry=[];
    for(const [kind,map] of Object.entries(w.signals)){
      const levels=Array.from({length:3},()=>({nodes:[],edges:[]}));
      for(const [id,strength] of map){if(strength<.06)continue;const [x,y]=id.split(',').map(Number),level=strength<.3?0:strength<1?1:2;levels[level].nodes.push([x,y,strength]);
        for(const [dx,dy] of OFFSETS){const other=map.get((x+dx)+','+(y+dy))??0;if(other<.06)continue;if(dx&&dy&&w.solid([x+dx,y])&&w.solid([x,y+dy]))continue;levels[Math.min(level,other<.3?0:other<1?1:2)].edges.push([x,y,x+dx,y+dy]);}
      }this.geometry.push({kind,levels});
    }
  }
  draw(c,w,renderer,now){
    this.collect(w,now);const u=renderer.unit,z=renderer.camera.zoom,min=renderer.world([-u*3,-u*3]),max=renderer.world([renderer.width+u*3,renderer.height+u*3]),visible=(x,y)=>x>=min[0]&&x<=max[0]&&y>=min[1]&&y<=max[1];
    // Broad source odor is visually separate from narrow deposited recruitment trails.
    for(const p of w.patches){if(p.amount<=.001||!visible(...p.cell))continue;const [x,y]=renderer.screen(p.cell),kind=p.kind==='water'?'moisture':'odor',strength=Math.min(1,p.amount/8)*(p.origin==='grass'?.4:1);c.globalAlpha=.20*strength;c.drawImage(this.glows[kind],x-u*2.1,y-u*2.1,u*4.2,u*4.2);}
    c.lineCap='round';c.lineJoin='round';let glows=0,segments=0;
    for(const {kind,levels} of this.geometry)for(let level=0;level<3;level++){
      const {nodes,edges}=levels[level],opacity=[.20,.42,.7][level];c.beginPath();let any=false;
      for(const [x,y,nx,ny] of edges){if(!visible(x,y)&&!visible(nx,ny))continue;if(segments++>5000)break;const a=renderer.screen([x,y]),b=renderer.screen([nx,ny]);c.moveTo(...a);c.lineTo(...b);any=true;}
      if(any){c.strokeStyle=SIGNAL_COLORS[kind];c.globalAlpha=opacity*.24;c.lineWidth=Math.max(2,u*.45);c.stroke();c.globalAlpha=opacity;c.lineWidth=Math.max(.7,u*.105);c.stroke();}
      for(const [wx,wy,strength] of nodes){if(!visible(wx,wy)||glows++>1600)continue;const [x,y]=renderer.screen([wx,wy]);c.globalAlpha=opacity*.52;c.drawImage(this.glows[kind],x-u*.6,y-u*.6,u*1.2,u*1.2);if(level>0){c.fillStyle=SIGNAL_COLORS[kind];c.globalAlpha=opacity*.65;const d=Math.max(1,1.5*z);c.fillRect(Math.round(x-d/2),Math.round(y-d/2),d,d);}}
    }c.globalAlpha=1;
  }
}
