import {clamp} from './biology.mjs';
export const MATERIALS=Object.freeze({
  topsoil:{name:'Organic topsoil',hardness:1,colors:['#514334','#584737','#604d39'],light:'#806548',dark:'#362d25'},
  sand:{name:'Sandy subsoil',hardness:.8,colors:['#aa8c60','#b3976c','#a4875c'],light:'#c9b081',dark:'#88704d'},
  clay:{name:'Compact clay',hardness:2.1,colors:['#806154','#87675a','#785b50'],light:'#a77c68',dark:'#5b4943'},
  silt:{name:'Deep mineral soil',hardness:1.5,colors:['#6d6a5c','#747060','#676558'],light:'#8f8970',dark:'#4e5049'},
  rock:{name:'Stone',hardness:Infinity,colors:['#777c78','#6d7471','#858882'],light:'#a1a397',dark:'#505a56'},
  spoil:{name:'Loose excavated mound',hardness:.55,colors:['#bc9564','#c5a06e','#ad875b'],light:'#e2bd82',dark:'#86613e'}
});
export function hashCell([x,y],seed=0){return (Math.imul(x,73856093)^Math.imul(y,19349663)^(seed>>>0))>>>0;}
export function baseMaterial(c,seed){
  const [x,y]=c,h=hashCell([Math.floor(x/3),Math.floor(y/2)],seed);
  if(y>30 && h%19===0)return 'rock';
  if(y<=5+(hashCell([Math.floor(x/10),0],seed)%3))return 'topsoil';
  if(y<=17+(hashCell([Math.floor(x/16),1],seed)%4))return 'sand';
  if(y<=40)return 'clay';return 'silt';
}
export function materialAt(world,c){return world.deposits.has(c.join(','))?'spoil':baseMaterial(c,world.seed);}
export function conditionsAt(world,c){
  const [x,y]=c,h=hashCell([Math.floor(x/5),Math.floor(y/4)],world.seed);
  let humidity=.30+.42*(1-Math.exp(-Math.max(0,y)/18))+((h%11)-5)*.006;
  for(const p of world.patches)if(p.kind==='water' && p.amount>0)humidity+=Math.exp(-Math.abs(x-p.cell[0])/5)*Math.exp(-Math.max(0,y)/11)*.20*clamp(p.amount/80);
  return {humidity:clamp(humidity,.08,.98),temperature:24.5-1.5*(1-Math.exp(-Math.max(0,y)/14))};
}
export function digDuration(world,c,skill=0){
  const type=materialAt(world,c),humidity=conditionsAt(world,c).humidity;
  if(type==='rock' || humidity>.94)return Infinity;
  const moisturePenalty=1+Math.max(0,.4-humidity)*3+Math.max(0,humidity-.8)*5;
  return 4*MATERIALS[type].hardness*moisturePenalty/(1+clamp(skill)*.3);
}
