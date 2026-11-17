// Shared by contact physics, antennal sensing and the articulated pixel renderer.
export const NECK_LIMIT=.62,WAIST_LIMIT=.42;
export const spriteWidth=a=>a.caste==='queen'?18:9.5+(a.bodySize??.4)*4.5;
export const bodyPixel=a=>spriteWidth(a)/14/56;
const poses=new WeakMap();
export function bodyDiscs(a,p=a.pos,angle=a.motion?.angle??0,joints=a.motion){
  const actual=p===a.pos&&angle===(a.motion?.angle??0)&&joints===a.motion,old=actual?poses.get(a):null,neckValue=joints?.neck??0,waistValue=joints?.waist??0;
  if(old&&old.x===p[0]&&old.y===p[1]&&old.angle===angle&&old.neck===neckValue&&old.waist===waistValue&&old.size===a.bodySize&&old.caste===a.caste)return old.discs;
  const u=bodyPixel(a),co=Math.cos(angle),si=Math.sin(angle),neck=angle+(joints?.neck??0),waist=angle+(joints?.waist??0);
  const discs=[
    {x:p[0],y:p[1],radius:4.0*u},
    {x:p[0]+4*u*co+5*u*Math.cos(neck),y:p[1]+4*u*si+5*u*Math.sin(neck),radius:(a.caste==='major'?5.1:3.9)*u},
    {x:p[0]-6*u*co-9*u*Math.cos(waist),y:p[1]-6*u*si-9*u*Math.sin(waist),radius:5.4*u}
  ];
  if(actual)poses.set(a,{x:p[0],y:p[1],angle,neck:neckValue,waist:waistValue,size:a.bodySize,caste:a.caste,discs});return discs;
}
