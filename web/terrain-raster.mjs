import {MATERIALS,baseMaterial,hashCell} from './materials.mjs';
import {terrainMask,densityAt,CONTOUR_SAMPLES} from './geometry.mjs';
const key=c=>c.join(',');
const rgbCache=new Map();function rgb(hex){if(!rgbCache.has(hex))rgbCache.set(hex,[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));return rgbCache.get(hex);}
export function snapshotTerrain(world,cx,cy,lod=16){
  const solid=new Uint8Array(18*18),ground=new Int32Array(18),surface=new Int32Array(18),deposits=new Uint8Array(256),covered=new Uint8Array(256),dead=[];
  for(let x=0;x<18;x++){const wx=cx*16+x-1;ground[x]=world.baseSurface(wx);surface[x]=world.surface(wx);}
  for(let y=0;y<18;y++)for(let x=0;x<18;x++)solid[y*18+x]=Number(world.solid([cx*16+x-1,cy*16+y-1]));
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const c=[cx*16+x,cy*16+y],i=y*16+x;deposits[i]=Number(world.deposits.has(key(c)));covered[i]=Number(world.coveredMound(c));}
  for(const p of world.patches)if(p.origin==='grass'&&p.stage==='dead'&&p.cell[0]>=cx*16-2&&p.cell[0]<=cx*16+17)dead.push(p.cell[0]);
  return {seed:world.seed,cx,cy,lod,solid,ground,surface,deposits,covered,dead};
}
function snapshotWorld(s){const index=([x,y])=>(y-s.cy*16)*16+x-s.cx*16;return {seed:s.seed,
  solid:([x,y])=>!!s.solid[(y-s.cy*16+1)*18+x-s.cx*16+1],baseSurface:x=>s.ground[x-s.cx*16+1],surface:x=>s.surface[x-s.cx*16+1],coveredMound:c=>!!s.covered[index(c)],
  deposits:{has:id=>!!s.deposits[index(id.split(',').map(Number))]},patches:s.dead.map(x=>({origin:'grass',stage:'dead',cell:[x,0]}))};}
export function* rasterRows(snapshot){const {cx,cy,lod}=snapshot,world=snapshotWorld(snapshot);
    const size=16*lod,data=new Uint8ClampedArray(size*size*4),mask=terrainMask(world,cx,cy),maskSize=16*CONTOUR_SAMPLES;
    const palette={};for(const [name,m] of Object.entries(MATERIALS)){palette[name]={colors:m.colors.map(rgb),light:rgb(m.light),dark:rgb(m.dark)};}
    const ox=cx*16-.5,oy=cy*16-.5,solid=(x,y)=>world.solid([x,y]);
    const filled=(x,y)=>x>=0&&x<maskSize&&y>=0&&y<maskSize?mask[y*maskSize+x]:densityAt(ox+(x+.5)/CONTOUR_SAMPLES,oy+(y+.5)/CONTOUR_SAMPLES,solid)>=.5;
    const cells=[];for(let ly=0;ly<16;ly++)for(let lx=0;lx<16;lx++){
      const wx=cx*16+lx,wy=cy*16+ly,type=world.deposits.has(key([wx,wy]))||wy<world.baseSurface(wx)?'spoil':baseMaterial([wx,wy],world.seed,world.baseSurface(wx));
      cells.push({wx,wy,type,base:palette[type].colors[0],wall:world.coveredMound([wx,wy])||(wy<world.baseSurface(wx)&&wy>world.surface(wx)),grass:type==='topsoil'&&wy===world.baseSurface(wx)&&!world.patches.some(p=>p.origin==='grass'&&p.stage==='dead'&&Math.abs(p.cell[0]-wx)<=1)});
    }
    for(let y=0;y<size;y++){if(y%4===0)yield;for(let x=0;x<size;x++){
      const mx=Math.floor(x*CONTOUR_SAMPLES/lod),my=Math.floor(y*CONTOUR_SAMPLES/lod),inside=mask[my*maskSize+mx],info=cells[Math.floor(y/lod)*16+Math.floor(x/lod)],gx=cx*256+Math.floor(x*16/lod),gy=cy*256+Math.floor(y*16/lod),h=hashCell([gx,gy],world.seed),idx=(y*size+x)*4;
      let color,shade=0;
      if(inside){
        color=info.base;shade=((h>>>8)%9)-4;
        if(info.type!=='spoil'){const depth=oy+(y+.5)/lod-world.baseSurface(info.wx),mix=Math.max(0,Math.min(1,(depth-3+Math.sin((ox+x/lod)*.18+world.seed)*.65)/5));color=palette.topsoil.colors[0].map((v,i)=>v*(1-mix)+palette.earth.colors[0][i]*mix);}
        // Fine grains replace the old repeating eight-pixel blocks; crumb clusters remain distinct from rooted earth.
        const cluster=hashCell([Math.floor(gx/3),Math.floor(gy/2)],world.seed);
        if(info.type==='spoil'){if(cluster%7===0)color=palette.spoil.light;else if(cluster%9===0)color=palette.spoil.dark;}
        else if(h%29===0)color=palette[info.type].light;else if(h%37===0)color=palette[info.type].dark;
        if(info.type==='topsoil'&&cluster%127===0)shade-=18;
        if(!filled(mx,my-1))shade+=15;if(!filled(mx-1,my))shade+=6;if(!filled(mx,my+1))shade-=23;
        if(info.grass&&!filled(mx,my-1))color=rgb('#879d58');
      }else if(oy+(y+.5)/lod>=world.baseSurface(info.wx)-.5||info.wall){
        color=rgb(info.wall?'#58432e':info.type==='topsoil'?'#302a22':'#423525');shade=(h%9)-4;
        if(filled(mx,my-1)||filled(mx-1,my))shade-=10;
      }else continue;
      data[idx]=Math.max(0,Math.min(255,color[0]+shade));data[idx+1]=Math.max(0,Math.min(255,color[1]+shade));data[idx+2]=Math.max(0,Math.min(255,color[2]+shade));data[idx+3]=255;
    }
    }return {data,size};

}

export function rasterTerrain(snapshot){const rows=rasterRows(snapshot);let r;do{r=rows.next();}while(!r.done);return r.value;}
export function coarseTerrain(s){const data=new Uint8ClampedArray(16*16*4),world=snapshotWorld(s);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const wx=s.cx*16+x,wy=s.cy*16+y,id=y*16+x,filled=s.solid[(y+1)*18+x+1],above=wy<world.baseSurface(wx);let color;if(filled)color=rgb(s.deposits[id]||above?'#bc9564':wy-world.baseSurface(wx)<5?'#584737':'#806446');else if(!above||s.covered[id])color=rgb(s.covered[id]?'#58432e':'#423525');else continue;data.set(color,id*4);data[id*4+3]=255;}return {data,size:16};}
