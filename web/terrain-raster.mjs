import {MATERIALS,baseMaterial,hashCell} from './materials.mjs';
import {densityAt,surfaceProfile,CONTOUR_SAMPLES} from './geometry.mjs';
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
function snapshotWorld(s){
  function localIndex(x,y,margin){
    const lx=x-s.cx*16+margin,ly=y-s.cy*16+margin,size=16+2*margin;
    return lx>=0&&lx<size&&ly>=0&&ly<size?ly*size+lx:-1;
  }
  return {seed:s.seed,solid:([x,y])=>!!s.solid[localIndex(x,y,1)],
    baseSurface:x=>s.ground[x-s.cx*16+1],surface:x=>s.surface[x-s.cx*16+1],
    coveredMound:([x,y])=>!!s.covered[localIndex(x,y,0)],
    deposits:{has:id=>!!s.deposits[localIndex(...id.split(',').map(Number),0)]}};
}
export function* rasterRows(snapshot){const {cx,cy,lod}=snapshot,world=snapshotWorld(snapshot);
    const size=16*lod,data=new Uint8ClampedArray(size*size*4),samples=Math.min(CONTOUR_SAMPLES,lod),maskSize=16*samples;
    const palette={};for(const [name,m] of Object.entries(MATERIALS)){palette[name]={colors:m.colors.map(rgb),light:rgb(m.light),dark:rgb(m.dark)};}
    const ox=cx*16-.5,oy=cy*16-.5,solid=(x,y)=>{
      const lx=x-cx*16+1,ly=y-cy*16+1;
      return lx>=0&&lx<18&&ly>=0&&ly<18&&snapshot.solid[ly*18+lx];
    };
    const exterior=worldX=>{
      const x=Math.floor(worldX),left=world.surface(x),right=world.surface(x+1);
      return {height:surfaceProfile(world,worldX),intact:Math.abs(left-right)<=1&&solid(x,left)&&solid(x+1,right),upperSoil:Math.min(left,right)+.55};
    };
    const columns=Array.from({length:maskSize},(_,x)=>exterior(ox+(x+.5)/samples));
    const sample=(worldX,worldY,edge)=>edge.intact&&worldY<=edge.upperSoil?worldY>=edge.height:densityAt(worldX,worldY,solid)>=.5;
    const mask=new Uint8Array(maskSize*maskSize);
    for(let my=0;my<maskSize;my++)for(let mx=0;mx<maskSize;mx++)mask[my*maskSize+mx]=Number(sample(ox+(mx+.5)/samples,oy+(my+.5)/samples,columns[mx]));
    const filled=(x,y)=>{
      if(x>=0&&x<maskSize&&y>=0&&y<maskSize)return mask[y*maskSize+x];
      const wx=ox+(x+.5)/samples;
      return sample(wx,oy+(y+.5)/samples,columns[x]??exterior(wx));
    };
    const cells=[];for(let ly=0;ly<16;ly++)for(let lx=0;lx<16;lx++){
      const wx=cx*16+lx,wy=cy*16+ly,ground=world.baseSurface(wx),top=world.surface(wx);
      const type=world.deposits.has(key([wx,wy]))||top<ground&&wy<ground?'spoil':baseMaterial([wx,wy],world.seed,ground);
      cells.push({wx,type,ground,base:palette[type].colors[0],wall:world.coveredMound([wx,wy]),grass:type==='topsoil'&&wy<=ground&&!snapshot.dead.some(x=>Math.abs(x-wx)<=1)});
    }
    for(let y=0;y<size;y++){if(y%4===0)yield;for(let x=0;x<size;x++){
      const mx=Math.floor(x*samples/lod),my=Math.floor(y*samples/lod),inside=mask[my*maskSize+mx],info=cells[Math.floor(y/lod)*16+Math.floor(x/lod)],gx=cx*256+Math.floor(x*16/lod),gy=cy*256+Math.floor(y*16/lod),h=hashCell([gx,gy],world.seed),idx=(y*size+x)*4;
      let color,shade=0;const py=oy+(my+.5)/samples,edge=columns[mx];
      if(inside){
        color=info.base;shade=((h>>>8)%9)-4;
        if(info.type!=='spoil'){const depth=oy+(y+.5)/lod-world.baseSurface(info.wx),mix=Math.max(0,Math.min(1,(depth-3+Math.sin((ox+x/lod)*.18+world.seed)*.65)/5));color=palette.topsoil.colors[0].map((v,i)=>v*(1-mix)+palette.earth.colors[0][i]*mix);}
        // Fine grains replace the old repeating eight-pixel blocks; crumb clusters remain distinct from rooted earth.
        const cluster=hashCell([Math.floor(gx/3),Math.floor(gy/2)],world.seed);
        if(info.type==='spoil'){if(cluster%7===0)color=palette.spoil.light;else if(cluster%9===0)color=palette.spoil.dark;}
        else if(h%29===0)color=palette[info.type].light;else if(h%37===0)color=palette[info.type].dark;
        if(info.type==='topsoil'&&cluster%127===0)shade-=18;
        if(!filled(mx,my-1))shade+=15;if(!filled(mx-1,my))shade+=6;if(!filled(mx,my+1))shade-=23;
        if(info.grass&&Math.abs(py-edge.height)<.24&&!filled(mx,my-1))color=rgb('#879d58');
      }else if(py>=edge.height){
        color=rgb(info.wall?'#58432e':info.type==='topsoil'?'#302a22':'#423525');shade=(h%9)-4+Math.max(0,Math.round(18-18*(py-edge.height)));
        if(filled(mx,my-1)||filled(mx-1,my))shade-=10;
      }else continue;
      data[idx]=Math.max(0,Math.min(255,color[0]+shade));data[idx+1]=Math.max(0,Math.min(255,color[1]+shade));data[idx+2]=Math.max(0,Math.min(255,color[2]+shade));data[idx+3]=255;
    }
    }return {data,size};

}

export function rasterTerrain(snapshot){const rows=rasterRows(snapshot);let r;do{r=rows.next();}while(!r.done);return r.value;}
export function coarseTerrain(s){const data=new Uint8ClampedArray(16*16*4),world=snapshotWorld(s);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const wx=s.cx*16+x,wy=s.cy*16+y,id=y*16+x,filled=s.solid[(y+1)*18+x+1],above=wy<world.baseSurface(wx);let color;if(filled)color=rgb(s.deposits[id]||above?'#bc9564':wy-world.baseSurface(wx)<5?'#584737':'#806446');else if(!above||s.covered[id])color=rgb(s.covered[id]?'#58432e':'#423525');else continue;data.set(color,id*4);data[id*4+3]=255;}return {data,size:16};}
