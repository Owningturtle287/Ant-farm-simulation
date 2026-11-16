import {DAY,clamp,adultDays,Random} from './biology.mjs';
export const SPECIES=Object.freeze({name:'Red imported fire ant',scientific:'Solenopsis invicta',socialForm:'Single-queen (monogyne)',eggDays:8,larvaDays:10,pupaDays:12});
export function colonyOdor(seed){const r=new Random(seed^0x8a421);return [.18+r.float()*.6,.18+r.float()*.6,.18+r.float()*.6];}
export function lifespanFor(a,seed){const r=new Random((seed^Math.imul(a.id+7,3266489917))>>>0);return a.caste==='queen'?1200+r.float()*900:a.bodySize>.78?90+r.float()*90:a.bodySize>.43?60+r.float()*30:30+r.float()*30;}
export function initializeBrain(a,seed){
  const r=new Random((seed^Math.imul(a.id+1,2246822519))>>>0),odor=colonyOdor(seed);
  a.bodySize??=a.caste==='queen'?1.6:a.caste==='major'?.9:.18+Math.pow(r.float(),1.7)*.68;
  a.caste=a.caste==='queen'?'queen':a.bodySize>.78?'major':'worker';
  a.odor??=odor.map(v=>v+(r.float()-.5)*.025);a.recognitionTemplate??=[...odor];
  a.brain??={arousal:0,habituation:0,lastDecision:0,contacts:0,recognized:0,lastContact:'No recent antennal contact',recruitedKind:null,recruitUntil:0,senses:{},taskHistory:[]};
  a.traits.lifeDays=a.fireAnt?a.traits.lifeDays:lifespanFor(a,seed);
  a.fireAnt=true;a.knownBrood??=[];a.cargoNutrition??=null;return a;
}
export function recognize(a,b){return Math.sqrt(a.recognitionTemplate.reduce((s,v,i)=>s+(v-(b.odor?.[i]??-1))**2,0))<.20;}
export function contact(a,b,time){
  a.brain.contacts++;const trusted=recognize(a,b);
  if(trusted){a.brain.recognized++;a.recognitionTemplate=a.recognitionTemplate.map((v,i)=>v*.99+b.odor[i]*.01);a.brain.lastContact=b.caste==='queen'?'Queen recognized by contact cues':'Nestmate recognized by contact cues';}
  else{a.brain.lastContact='Unfamiliar colony odor · alarm response';a.brain.arousal=1;a.alarmUntil=time+10;}
  return trusted;
}
export const cropCapacity=a=>1.2+a.bodySize*2.4;
export function developmentalRate(temp){return temp<=27.5?clamp(.55+(temp-24)*.45/3.5,0,1):clamp(1+(temp-27.5)*.3/7.5,0,1.3);}
export function taskScores(a,needs,local,time,hasBrood){
  const age=adultDays(a),size=a.bodySize,t=a.traits,experience=a.skills;
  const recruitment=a.brain.recruitUntil>time?clamp(needs.forage*.8):0;
  const forage=(needs.forage+recruitment*(a.brain.recruitedKind==='food'?.55:0))*(.6+Math.min(age,24)/30+size*.45)*(1+experience.forage*.2)/t.forage;
  const water=(needs.water+recruitment*(a.brain.recruitedKind==='water'?.55:0))*(.65+Math.min(age,24)/35+size*.2)/t.water;
  const care=hasBrood?(needs.care*(1+Math.min(2,local.brood)*.3))*(age<10?1.15:.72)*(1.15-size*.4)*(1+experience.care*.2)/t.care:0;
  const dig=(needs.dig*1.6+local.construction*.65)*(1+experience.dig*.25)/t.dig;
  const defend=local.alarm>.12?Math.min(2,local.alarm*2)*(1+size*.6):0;
  return [['forage',forage],['water',water],['care',care],['dig',dig],['defend',defend]];
}
export function rememberTask(a,job,time){a.brain.lastDecision=time;a.brain.taskHistory.push({job,time});a.brain.taskHistory=a.brain.taskHistory.slice(-12);}
