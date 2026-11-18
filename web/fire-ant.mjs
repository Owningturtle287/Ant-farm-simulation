import {initCrop} from './provisions.mjs';
import {initializeMotion} from './locomotion.mjs';
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
  a.brain.recentWork??={};
  a.traits.lifeDays=a.fireAnt?a.traits.lifeDays:lifespanFor(a,seed);
  initCrop(a);initializeMotion(a,seed);a.fireAnt=true;a.knownBrood??=[];a.cargoNutrition??=null;return a;
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
export function observeNeeds(a,neighbors,cache,brood,traffic,time){
  let food=0,protein=0,water=0;
  for(const other of neighbors){
    const capacity=cropCapacity(other);
    food+=clamp((other.socialFood??0)/(capacity*.45));
    protein+=clamp((other.socialProtein??0)/(capacity*.18));
    water+=clamp((other.socialWater??0)/.65);
  }
  const count=Math.max(1,neighbors.length);
  const energy=1-clamp(cache.energy+food/count*.92);
  const proteinGap=1-clamp(cache.protein+protein/count*.92);
  const care=brood;
  const sample={
    forage:.04+Math.max(energy,proteinGap*(care>.25?1.15:.85)),
    protein:proteinGap,energy,water:.04+1-clamp(water/count),
    care,dig:traffic,
  };
  const old=a.knownNeeds;
  a.knownNeeds=Object.fromEntries(Object.entries(sample).map(([name,value])=>[name,old?value*.62+(old[name]??value)*.38:value]));
  a.needsAt=time;
  return a.knownNeeds;
}

export function taskScores(a,needs,local,time,hasBrood){
  const age=Math.min(adultDays(a),24),size=a.bodySize,t=a.traits;
  const crop=a.socialFood+a.socialProtein,full=clamp(crop/cropCapacity(a)),waterFull=clamp(a.socialWater/.75);
  const recruited=kind=>local[kind+'Contact']??0;
  const forage=needs.forage*(.57+age/35+size*.43)*(1-full*.88)*(1+recruited('food')*.65)/t.forage;
  const water=needs.water*(.61+age/42+size*.19)*(1-waterFull*.92)*(1+recruited('water')*.65)/t.water;
  const care=hasBrood?Math.max(needs.care,Math.min(.26,local.brood*.26))*(1.25-age*.017)*(1.2-size*.62)/t.care:0;
  const dig=(needs.dig*.65+local.construction*.76)*(1+a.skills.dig*.20)/t.dig;
  const defend=local.alarm>.12?Math.min(2,(local.alarm+a.brain.arousal)*1.7)*(1+size*.6):0;
  const scores=[['forage',forage],['water',water],['care',care],['dig',dig],['defend',defend]];
  for(const score of scores){
    const [job]=score,work=a.brain.recentWork[job];
    if(work)score[1]*=Math.max(.18,1+work.value*Math.exp(-(time-work.at)/95));
    if(job===a.lastJob&&time-(a.brain.lastDecision??0)<18)score[1]*=1.12;
  }
  return scores;
}

export function reinforceWork(a,job,time,reward){
  const recent=a.brain.recentWork[job],retained=recent?recent.value*Math.exp(-(time-recent.at)/95):0;
  a.brain.recentWork[job]={value:clamp(retained+reward,-.78,.7),at:time};
}

export function relayLarvalCue(a,queen,time){
  const cue=a.brain.larvalCue;if(!cue||time-cue.at>60)return;
  const recent=queen.brain.larvalInput??{value:0,at:time};
  queen.brain.larvalInput={at:time,value:clamp(recent.value*Math.exp(-(time-recent.at)/(DAY*.65))+cue.value*Math.exp(-(time-cue.at)/30))};
  delete a.brain.larvalCue;
}

export function layingDrive(a,time){
  const cue=a.brain.larvalInput;
  return cue?cue.value*Math.exp(-(time-cue.at)/(DAY*.65)):0;
}

export function rememberTask(a,job,time){a.brain.lastDecision=time;a.brain.taskHistory.push({job,time});a.brain.taskHistory=a.brain.taskHistory.slice(-12);}
