// Default settings, fixed production ticks, no player-supplied food or water.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Colony,DAY,broodStage} from '../web/sim.mjs';
import {supplyBalance} from '../web/provisions.mjs';
import {resourceBalance} from '../web/resources.mjs';
import {canOccupy} from '../web/traffic.mjs';
const seed=Number(process.argv[3]??287),c=new Colony(seed),began=performance.now(),checkpoints=[];
const inspect=()=>{
  const soilCargo=c.ants.filter(a=>a.cargoKind==='soil').reduce((n,a)=>n+a.carried,0);
  assert.equal(c.world.soilExcavated,c.world.soilDeposited+c.world.soilAbandoned+soilCargo,'Soil must remain conserved.');
  for(const kind of ['food','water'])assert.ok(Math.abs(resourceBalance(c.world,kind).error)<1e-5,kind+' must remain conserved.');
  assert.ok(c.ants.every(a=>c.world.walkable(a.cell)),'Adults must occupy traversable ground.');
  assert.ok(c.ants.every(a=>canOccupy(c.world,a,a.pos,a.motion.angle,null,false,true)),'Adult bodies must keep clear of other adults and grounded brood or supplies.');
  for(const kind of ['energy','protein','water'])assert.ok(Math.abs(supplyBalance(c,kind).error)<1e-5,kind+' in crops and food caches must remain conserved.');
  assert.ok(c.ants.length<=c.settings.populationCap);
  assert.equal(c.ants.some(a=>a.task==='patrolling'),false);
  for(const [x,y] of c.world.heights)assert.ok(Math.abs(y-c.world.surface(x-1))<=1&&Math.abs(y-c.world.surface(x+1))<=1,'Mature mounds must not form vertical exterior walls.');
  const covered=[...c.world.moundTunnels].filter(id=>c.world.coveredMound(id.split(',').map(Number))).length;assert.ok(covered<=c.world.deposits.size*.25+3,'Mound galleries must retain substantial solid soil.');
  const queen=c.ants.find(a=>a.caste==='queen');
  const tasks=Object.fromEntries([...new Set(c.ants.map(a=>a.task))].map(task=>[task,c.ants.filter(a=>a.task===task).length]));
  const stages=Object.fromEntries(['egg','larva','pupa'].map(stage=>{const list=c.brood.filter(b=>broodStage(b)===stage);return [stage,{count:list.length,hungry:list.filter(b=>b.nutrition<.4).length,meanNutrition:list.length?list.reduce((n,b)=>n+b.nutrition,0)/list.length:null,oldestDays:Math.max(0,...list.map(b=>b.age/DAY)),meanCareAge:list.length?list.reduce((n,b)=>n+c.time-b.lastCare,0)/list.length:null}];}));
  checkpoints.push({tasks,stages,crop:queen?{food:queen.socialFood,protein:queen.socialProtein,water:queen.socialWater}:null,storedFoodParcels:c.foodItems.length,freeBeds:c.freeBeds,seepSources:c.world.patches.filter(p=>p.origin==='seep').length,day:Math.round(c.time/DAY),adults:c.ants.length,brood:c.brood.length,births:c.births,deaths:c.deaths,moundPeak:Math.max(0,...[...c.world.heights].map(([x,y])=>c.world.baseSurface(x)-y)),coveredMoundCells:covered,moundCells:c.world.soilDeposited,moundTunnelCells:c.world.moundTunnels.size,food:c.food,protein:c.protein,water:c.water,alive:c.alive});
  console.log(JSON.stringify(checkpoints.at(-1)));
};
inspect();for(let i=0;i<120*DAY/.1;i++){c.step(.1);if((i+1)%(20*DAY/.1)===0)inspect();}
assert.ok(c.alive,'The default colony must survive a long run.');assert.ok(c.births>=30,'Normal reproduction must replace the founder generation.');assert.ok(c.ants.length>=25,'The colony must grow beyond its founders.');
const report={version:'0.11',seed,simulatedDays:120,tickSeconds:.1,settings:c.settings,wallSeconds:(performance.now()-began)/1000,checkpoints,balances:['food','water'].map(kind=>({kind,...resourceBalance(c.world,kind)})),scope:'One seeded CPU simulation; not a biological validation or a real-iPhone performance limit.'};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2));
