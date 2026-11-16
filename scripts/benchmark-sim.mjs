import {Colony,createAnt} from '../web/sim.mjs';
import {writeFileSync} from 'node:fs';
const results=[];
for(const population of [13,60,120,250,500,1000,2500,5000,10000]){
  const c=new Colony(287,{populationCap:10000}),open=[...c.world.excavated].map(s=>s.split(',').map(Number));
  while(c.ants.length<population){const id=c.nextID++;c.ants.push(createAnt(id,'worker',open[id%open.length],c.world.seed,8));}
  c.food=population;c.water=population*.6;c.protein=population*.3;
  const warm=[];for(let i=0;i<50;i++){const before=performance.now();c.step();warm.push(performance.now()-before);}
  const samples=[];for(let i=0;i<200;i++){const before=performance.now();c.step();samples.push(performance.now()-before);}samples.sort((a,b)=>a-b);
  results.push({ants:population,medianTickMs:samples[100],p95TickMs:samples[190],maxTickMs:samples[199],startupMaxMs:Math.max(...warm),pathCalls:c.world.runtime.pathCalls,scope:'Node CPU simulation only; not phone rendering or thermal performance'});
}
console.table(results.map(r=>({ants:r.ants,median_ms:r.medianTickMs.toFixed(3),p95_ms:r.p95TickMs.toFixed(3),startup_max_ms:r.startupMaxMs.toFixed(3)})));
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({version:'0.7',recordedAt:new Date().toISOString(),node:process.version,platform:process.platform,results},null,2));
