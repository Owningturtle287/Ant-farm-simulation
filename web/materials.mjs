import {clamp} from './biology.mjs';
export const MATERIALS=Object.freeze({
  topsoil:{name:'Rooted dirt',hardness:1,colors:['#514334','#584737','#604d39'],light:'#806548',dark:'#362d25'},
  earth:{name:'Diggable earth',hardness:1,colors:['#806446','#866b4b','#795f43'],light:'#a28760',dark:'#594731'},
  spoil:{name:'Loose excavated mound',hardness:1,colors:['#bc9564','#c5a06e','#ad875b'],light:'#e2bd82',dark:'#86613e'}
});
export function hashCell([x,y],seed=0){let h=(Math.imul(x,73856093)^Math.imul(y,19349663)^(seed>>>0))>>>0;h=Math.imul(h^(h>>>16),0x45d9f3b);return (h^(h>>>16))>>>0;}
export function baseMaterial(c,seed,ground=1){return c[1]-ground<5+hashCell([Math.floor(c[0]/10),0],seed)%3?'topsoil':'earth';}
export function materialAt(world,c){return world.deposits.has(c.join(','))?'spoil':baseMaterial(c,world.seed,world.baseSurface(c[0]));}
export function conditionsAt(world,c){
  const [x,y]=c,depth=Math.max(0,y-world.baseSurface(x)),h=hashCell([Math.floor(x/5),Math.floor(y/4)],world.seed);
  let humidity=.32+.38*(1-Math.exp(-depth/18))+((h%11)-5)*.006+(world.weather?.wetness??.35)*.10*Math.exp(-depth/12);
  for(const p of world.patches)if(p.kind==='water'&&p.amount>0)humidity+=Math.exp(-Math.abs(x-p.cell[0])/5)*Math.exp(-depth/11)*.10*clamp(p.amount/40);
  const phase=(world.environmentAt??0)/600*Math.PI*2;
  return {humidity:clamp(humidity,.08,.95),temperature:24.5+Math.sin(phase)*2*Math.exp(-depth/10)-1.5*(1-Math.exp(-depth/14))};
}
export function digDuration(world,c,skill=0){return 3.2/(1+clamp(skill)*.3);}
