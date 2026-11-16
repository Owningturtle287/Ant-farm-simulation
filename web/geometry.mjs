// Shared geometry: model centers stay traversable; silhouettes resolve at 1/8 cell.
import {hashCell} from './materials.mjs';
export const TERRAIN_PIXELS=16,CONTOUR_SAMPLES=8;
const key=c=>c.join(',');
export function curvedPassage(start,end,rng){
  const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);if(!length)return [];
  rng.float();const bend=(rng.float()-.5)*Math.min(5,length*.35),nx=-dy/length,ny=dx/length;
  const a=[start[0]+dx*.33+nx*bend,start[1]+dy*.33+ny*bend],b=[start[0]+dx*.7-nx*bend*.5,start[1]+dy*.7-ny*bend*.5],route=[],seen=new Set([key(start)]);let previous=[...start];
  for(let i=1;i<=Math.ceil(length*6);i++){
    const t=i/Math.ceil(length*6),q=1-t,c=[0,1].map(axis=>Math.round(q*q*q*start[axis]+3*q*q*t*a[axis]+3*q*t*t*b[axis]+t*t*t*end[axis]));
    // Cardinal bridge at raster corners: geometry never asks ants to cross solid corners.
    while(previous[0]!==c[0]||previous[1]!==c[1]){
      const axis=previous[0]===c[0]?1:previous[1]===c[1]?0:Math.abs(dx)>Math.abs(dy)?0:1;previous=[...previous];previous[axis]+=Math.sign(c[axis]-previous[axis]);
      if(!seen.has(key(previous))){seen.add(key(previous));route.push([...previous]);}
    }
  }return route;
}
export function chamberCells(center,rx,ry,seed){
  const angle=(hashCell(center,seed)%1000)/1000*Math.PI,co=Math.cos(angle),si=Math.sin(angle),out=[];
  for(let y=-Math.ceil(rx+ry);y<=Math.ceil(rx+ry);y++)for(let x=-Math.ceil(rx+ry);x<=Math.ceil(rx+ry);x++){
    const u=(x*co+y*si)/rx,v=(-x*si+y*co)/ry,theta=Math.atan2(v,u),rim=1+.10*Math.sin(theta*3+angle)+.06*Math.cos(theta*5-angle);
    if(u*u+v*v<=rim*rim)out.push([center[0]+x,center[1]+y]);
  }return out;
}
export function densityAt(x,y,solid){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  return (solid(ix,iy)?1:0)*(1-fx)*(1-fy)+(solid(ix+1,iy)?1:0)*fx*(1-fy)+(solid(ix,iy+1)?1:0)*(1-fx)*fy+(solid(ix+1,iy+1)?1:0)*fx*fy;
}
export function terrainMask(world,cx,cy){
  const size=16*CONTOUR_SAMPLES,result=new Uint8Array(size*size),grid=new Uint8Array(18*18),ox=cx*16-.5,oy=cy*16-.5;
  for(let y=0;y<18;y++)for(let x=0;x<18;x++)grid[y*18+x]=world.solid([cx*16+x-1,cy*16+y-1])?1:0;
  const solid=(x,y)=>grid[(y-cy*16+1)*18+x-cx*16+1];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)result[y*size+x]=densityAt(ox+(x+.5)/CONTOUR_SAMPLES,oy+(y+.5)/CONTOUR_SAMPLES,solid)>=.5?1:0;
  return result;
}
