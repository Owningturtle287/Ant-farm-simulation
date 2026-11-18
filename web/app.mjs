import {cropCapacity,waterCapacity,foodFill,supplyBalance} from './provisions.mjs';
import {Colony,antName,casteLabel,taskLabels,reason,distance,adultDays,DAY,broodStage} from './sim.mjs';
import {SPEEDS,POPULATION_CAPS} from './biology.mjs';
import {SPECIES} from './fire-ant.mjs';
import {resourceBalance} from './resources.mjs';
import {SimulationRunner,PerformanceMonitor} from './clock.mjs';
import {ColonyStore} from './large-saves.mjs';
import {Renderer} from './render.mjs';
const $=id=>document.getElementById(id), canvas=$('world');
let storage,store,colony,saveError;
try {storage=window.localStorage;store=new ColonyStore(storage);const loaded=await store.load();colony=loaded?.colony;if(loaded?.recovered)saveError='Recovered your colony from its backup.';}catch(error){saveError=error.message;}
colony??=new Colony(Date.now()>>>0);
const renderer=new Renderer(canvas),state={speed:1,paused:false,trails:false,selected:null,following:false,tool:null};
renderer.home(colony.world);
const monitor=new PerformanceMonitor(),runner=new SimulationRunner();
for(const cap of POPULATION_CAPS){const option=document.createElement('option');option.value=cap;option.textContent=cap.toLocaleString()+' ants'+(cap===120?' · default':cap>=1000?' · experimental':'');$('population-cap').append(option);}
let last=performance.now(),accumulator=0,lastUI=0,lastSave=last,toastTimer,hidden=document.hidden,lastAlive=colony.alive;
const dialogs=[...document.querySelectorAll('dialog')];
function toast(text) {clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function openDialog(id) {for(const d of dialogs)if(d.open)d.close();$(id).showModal();state.tool=null;updateTools();}
function closeDialog(id) {$(id).close();last=performance.now();}
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>closeDialog(b.dataset.close));
let saveTask=null,saving=false,lastCameraInput=0;
async function settleForEdit(){if(saveTask)await saveTask;await runner.finish(colony);}
function save(explicit=false){
  if(saveTask)return saveTask;lastSave=performance.now();const target=colony;saving=true;$('save-status').textContent='SAVING COLONY…';
  saveTask=(async()=>{await runner.finish(target);if(target!==colony)return false;
    try{if(!store)throw Error('Local saving is unavailable. Export a colony backup.');if(await store.save(target,explicit)){$('save-status').textContent='COLONY SAVED';return true;}}
    catch(error){$('save-status').textContent='SAVE NEEDS ATTENTION';if(explicit)toast(error.message);}return false;
  })().finally(()=>{saving=false;saveTask=null;});return saveTask;
}
function selectedAnt(){return colony.ants.find(a=>a.id===state.selected);}
function select(id,focus=false){state.selected=id;state.following=false;state.tool=null;updateTools();if(focus){const a=selectedAnt();if(a)Object.assign(renderer.camera,renderer.focus(a));}updateUI();}
function updateTools(){
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===state.tool)));
  $('trails').setAttribute('aria-pressed',String(state.trails));$('placement').hidden=!state.tool;
  $('placement-text').textContent=state.tool==='disturb'?'Tap near ants to create a brief local alarm.':state.tool?`Tap the world to leave ${state.tool} on the surface.`:'';
  $('trail-legend').hidden=!state.trails||state.selected!=null;
  canvas.style.cursor=state.tool?'crosshair':'grab';
}
function updateUI(){
  $('ants-count').textContent=colony.ants.length;$('food-count').textContent=Math.floor(colony.food+colony.protein);$('water-count').textContent=Math.floor(colony.water);$('brood-count').textContent=colony.brood.length;
  const clockMinutes=Math.floor((colony.time%DAY)/DAY*1440);
  $('weather').textContent=colony.world.weather.raining?'Rain · puddles filling':'Dry weather · grassland';
  $('day').textContent=`Day ${colony.day} · ${String(Math.floor(clockMinutes/60)).padStart(2,'0')}:${String(clockMinutes%60).padStart(2,'0')}`;$('event').textContent=colony.events[0]?.text??'Life, one small step at a time.';
  const pauseLabel=state.paused?'Resume simulation':'Pause simulation',pauseIcon=state.paused?'▶':'Ⅱ';$('pause-badge').hidden=!state.paused;if($('pause').getAttribute('aria-label')!==pauseLabel)$('pause').setAttribute('aria-label',pauseLabel);if($('pause-icon').textContent!==pauseIcon)$('pause-icon').textContent=pauseIcon;
  const speedText=state.speed+'×';if($('speed').textContent!==speedText){$('speed').textContent=speedText;$('speed').setAttribute('aria-label',`Simulation speed: ${state.speed} times`);}
  const ant=selectedAnt();$('inspector').hidden=!ant;
  if(ant){$('ant-name').textContent=antName(ant);$('ant-caste').textContent=casteLabel(ant).toUpperCase();$('ant-task').textContent=taskLabels[ant.task];
    for(const metric of ['energy','health','hydration']){$(metric+'-value').textContent=Math.round(ant[metric]*100)+'%';$(metric+'-bar').style.width=ant[metric]*100+'%';}
    const social=foodFill(ant),foodCap=cropCapacity(ant),waterCap=waterCapacity(ant);$('crop-food-value').textContent=Math.round(social/foodCap*100)+'% · '+social.toFixed(2)+' / '+foodCap.toFixed(2);$('crop-food-bar').style.width=Math.min(100,social/foodCap*100)+'%';$('crop-water-value').textContent=Math.round(ant.socialWater/waterCap*100)+'% · '+ant.socialWater.toFixed(2)+' / '+waterCap.toFixed(2);$('crop-water-bar').style.width=Math.min(100,ant.socialWater/waterCap*100)+'%';
    $('ant-age').textContent=adultDays(ant).toFixed(1)+' d';$('ant-experience').textContent=ant.experience;$('ant-trips').textContent=ant.trips;$('ant-reason').textContent=reason(ant);
    const follow=$('follow'),label=state.following?'Following ant':'Follow this ant';
    if(follow.textContent!==label)follow.textContent=label;
    const senses=ant.brain.senses;$('ant-senses').textContent=`Antennae · food ${(senses.food??0).toFixed(2)} · water ${(senses.water??0).toFixed(2)} · alarm ${(senses.alarm??0).toFixed(2)} · brood ${(senses.brood??0).toFixed(2)}`;
    const feelers=ant.brain.antennae,channel=feelers?.kind??'food',odor=channel==='food'?'foodOdor':'moisture',reading=side=>((feelers?.[side]?.[channel]??0)+(feelers?.[side]?.[odor]??0)*.8).toFixed(2);
    $('ant-sensing').textContent=`Left ${reading('left')} · right ${reading('right')} · ${channel} cue. ${ant.motion?.mode==='sampling'?'Pausing to sample':ant.motion?.mode==='tracking'?'Following the local gradient':ant.motion?.mode==='searching'?'Casting for a scent':ant.motion?.mode==='carrying'?'Keeping the load moving':ant.motion?.mode==='reorienting'?'Adjusting to freshly moved soil':'Scanning nearby cues'}.`;
    $('ant-social').textContent=`${ant.brain.recognized} recognized contacts · ${ant.brain.lastContact}`;
    $('ant-memory').textContent=ant.memories.length+' remembered source'+(ant.memories.length===1?'':'s')+' · skills improve with successful work.';
  }else{state.selected=null;state.following=false;}
  if(lastAlive && !colony.alive)toast('The queen has died. You can start a new colony from More.');lastAlive=colony.alive;
  $('performance-button').textContent=$('performance-panel').hidden?'Show performance':'Hide performance';
  if(!$('performance-panel').hidden)updatePerformance();
}
function performanceSnapshot(){const taskCounts={};for(const a of colony.ants)taskCounts[a.task]=(taskCounts[a.task]??0)+1;return {...monitor.values,routeRecoveries:colony.world.runtime.recoveries,recognitions:colony.recognitions,socialTransfers:colony.socialTransfers,alarmEvents:colony.alarmEvents,taskCounts,resourceBalance:{food:resourceBalance(colony.world,'food'),water:resourceBalance(colony.world,'water')},moundTunnels:colony.world.moundTunnels.size,entrances:colony.world.entrances.filter(e=>e.state==='open').length,supplies:{energy:supplyBalance(colony,'energy'),protein:supplyBalance(colony,'protein'),water:supplyBalance(colony,'water'),storedFoodParcels:colony.foodItems.length,freeBroodBeds:colony.freeBeds,groundwaterDepth:colony.world.groundwater.depth},requestedSpeed:state.speed,ants:colony.ants.length,brood:colony.brood.length,populationCap:colony.settings.populationCap,soilDeposited:colony.world.soilDeposited,openCells:colony.world.excavated.size,cachedChunks:renderer.chunks.size,terrainCacheBytes:renderer.chunks.bytes,renderDpr:renderer.dpr,nativeRenderDpr:renderer.nativeDpr,terrain:{...renderer.renderStats,queued:renderer.requests.size,active:!!renderer.active},pathCalls:colony.world.runtime.pathCalls,routingMs:colony.world.runtime.pathCalls?colony.world.runtime.pathMs/colony.world.runtime.pathCalls:0};}
function updatePerformance(){
  const m=performanceSnapshot();$('performance-panel').dataset.readings=JSON.stringify(m);$('perf-fps').textContent=m.fps.toFixed(0);$('perf-frame').textContent=m.frameMs.toFixed(1)+' ms';$('perf-tick').textContent=m.tickMs.toFixed(2)+' ms';$('perf-draw').textContent=m.drawMs.toFixed(2)+' ms';$('perf-speed').textContent=m.effective.toFixed(1)+'× / '+m.requestedSpeed+'×';$('perf-population').textContent=m.ants+' / '+m.populationCap;$('perf-mound').textContent=m.soilDeposited;$('perf-routing').textContent=m.routingMs.toFixed(2)+' ms';$('perf-recoveries').textContent=colony.world.runtime.recoveries;
}
function syncSettings(){
  for(const [id,field] of [['egg-rate','eggRate'],['brood-rate','broodRate'],['starting-workers','startingWorkers'],['population-cap','populationCap'],['water-depth','waterTableDepth']])$(id).value=String(colony.settings[field]);
  $('cap-note').textContent=colony.ants.length>=colony.settings.populationCap?'The ceiling pauses further growth; your existing ants remain.':'The ceiling controls growth. Changing it never removes existing ants.';
}
function buildRoster(){
  const stock=resourceBalance(colony.world,'food'),water=resourceBalance(colony.world,'water');$('habitat-stats').textContent=`${SPECIES.scientific} · single queen · finite food ${stock.available.toFixed(1)} · water ${water.available.toFixed(1)} outside · ${colony.world.entrances.filter(e=>e.state==='open').length} open mouths · ${colony.world.moundTunnels.size} mound tunnel cells`;
  $('supply-stats').textContent=`${colony.foodItems.length} separate stored food parcels · ${colony.water.toFixed(1)} water carried in crops · ${colony.freeBeds??0} free brood beds · water table ~${colony.settings.waterTableDepth} cells deep`;
  const hungry=colony.brood.filter(b=>broodStage(b)==='larva'&&b.nutrition<.25).length;
  $('growth-status').textContent=colony.ants.length>=colony.settings.populationCap?'Population ceiling reached. Ready brood waits for an adult vacancy.':!colony.alive?'The queen has died.':colony.settings.eggRate===0?'New eggs are disabled in reproduction settings.':hungry?`${hungry} hungry larvae need care and protein from grain.`:colony.canLay()?'Growth is proceeding through egg, larva, and pupa stages. Development takes modeled weeks.':'Laying is paused by nutrition or brood-care capacity. The colony must support existing brood first.';
  const counts={egg:0,larva:0,pupa:0};for(const b of colony.brood)counts[broodStage(b)]++;
  $('brood-breakdown').textContent=`${counts.egg} eggs · ${counts.larva} larvae · ${counts.pupa} pupae · ${colony.broodMoved} brood deliveries`;
  $('queen-laying').textContent=`Queen laying target: ${(DAY/colony.eggInterval).toFixed(1)} eggs / colony day · ${colony.eggsLaid} laid. Capacity and resources can pause laying.`;
  $('colony-summary').replaceChildren();
  for(const [label,value] of [['Workers',colony.ants.filter(a=>a.caste!=='queen').length],['Brood',colony.brood.length],['New ants',colony.births],['Day',colony.day]]){
    const div=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;div.append(strong,span);$('colony-summary').append(div);
  }
  const nursery=colony.world.conditions(colony.nursery);
  $('soil-stats').textContent=`${colony.world.soilExcavated} soil excavated · ${colony.world.soilDeposited} deposited · protein ${colony.protein.toFixed(1)} · nursery ${Math.round(nursery.humidity*100)}% humidity, ${nursery.temperature.toFixed(1)}°C`;
  $('ant-list').replaceChildren();rosterPage=0;appendRoster();
}
let rosterPage=0;const ROSTER_PAGE=100;
function appendRoster(){
  $('roster-more')?.remove();const fragment=document.createDocumentFragment();
  for(const ant of colony.ants.slice(rosterPage*ROSTER_PAGE,(rosterPage+1)*ROSTER_PAGE)){const button=document.createElement('button');button.className='ant-row';button.dataset.ant=ant.id;
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#i-ant');icon.append(use);
    const info=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small'),caste=document.createElement('span');strong.textContent=antName(ant);small.textContent=taskLabels[ant.task];caste.textContent=casteLabel(ant);caste.className='caste';info.append(strong,small);button.append(icon,info,caste);
    button.addEventListener('click',()=>{closeDialog('roster');select(ant.id,true);});fragment.append(button);
  }
  $('ant-list').append(fragment);rosterPage++;if(rosterPage*ROSTER_PAGE<colony.ants.length){const more=document.createElement('button');more.id='roster-more';more.className='secondary full';more.textContent='Show next 100 ants';more.onclick=appendRoster;$('ant-list').append(more);}
}
$('pause').addEventListener('click',()=>{state.paused=!state.paused;accumulator=0;updateUI();});
$('speed').addEventListener('click',()=>{state.speed=SPEEDS[(SPEEDS.indexOf(state.speed)+1)%SPEEDS.length];updateUI();});
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{state.tool=state.tool===b.dataset.tool?null:b.dataset.tool;state.selected=null;state.following=false;updateTools();updateUI();}));
$('cancel-tool').addEventListener('click',()=>{state.tool=null;updateTools();});
$('trails').addEventListener('click',()=>{state.trails=!state.trails;updateTools();});
$('home').addEventListener('click',()=>{renderer.home(colony.world);select(null);});
$('close-profile').addEventListener('click',()=>select(null));
$('follow').addEventListener('click',()=>{state.following=!state.following;const a=selectedAnt();if(a && state.following)Object.assign(renderer.camera,renderer.focus(a));updateUI();});
$('roster-button').addEventListener('click',()=>{buildRoster();openDialog('roster');});
$('menu-button').addEventListener('click',()=>openDialog('menu'));
$('save-now').addEventListener('click',async()=>{closeDialog('menu');if(await save(true))toast('Your colony is saved on this device.');});
$('help').addEventListener('click',()=>openDialog('guide'));
$('settings-button').addEventListener('click',()=>{syncSettings();openDialog('settings');});
$('materials-button').addEventListener('click',()=>openDialog('materials'));
$('species-button').addEventListener('click',()=>openDialog('species'));
$('disturb-button').addEventListener('click',()=>{closeDialog('menu');state.tool='disturb';state.selected=null;updateTools();updateUI();});
$('performance-button').addEventListener('click',()=>{$('performance-panel').hidden=!$('performance-panel').hidden;closeDialog('menu');updateUI();});
$('close-performance').addEventListener('click',()=>{$('performance-panel').hidden=true;updateUI();});
for(const [id,field] of [['egg-rate','eggRate'],['brood-rate','broodRate'],['starting-workers','startingWorkers'],['population-cap','populationCap'],['water-depth','waterTableDepth']])$(id).addEventListener('change',async()=>{await settleForEdit();colony.setSettings({[field]:Number($(id).value)});syncSettings();toast(await save()?'Colony settings saved.':'Colony settings updated for this session.');});
$('enter').addEventListener('click',()=>{try{storage?.setItem('little-colony.guide','seen');}catch{}closeDialog('guide');});
$('reset').addEventListener('click',()=>openDialog('reset-confirm'));
$('confirm-reset').addEventListener('click',async()=>{await settleForEdit();colony=new Colony(Date.now()>>>0,colony.settings);state.selected=null;state.following=false;state.paused=false;accumulator=0;lastAlive=true;runner.reset();renderer.reset();monitor.reset();closeDialog('reset-confirm');save(true);updateUI();toast('A small colony takes root.');});
$('export').addEventListener('click',async()=>{await settleForEdit();
  const blob=new Blob([JSON.stringify({version:4,savedAt:Date.now(),colony})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='little-colony-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Colony backup exported.');
});
$('export-performance').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:'0.10',recordedAt:new Date().toISOString(),...performanceSnapshot(),settings:colony.settings,viewport:{width:renderer.width,height:renderer.height,dpr:renderer.dpr}},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='little-colony-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Performance readings exported.');});
$('install-button').addEventListener('click',()=>openDialog('install'));
for(const [id,factor] of [['zoom-in',1.25],['zoom-out',.8]])$(id).addEventListener('click',()=>{lastCameraInput=performance.now();state.following=false;renderer.zoom(factor);});
const pointers=new Map();let start=null,lastPoint=null,moved=false,pinchDistance=0;
function localPoint(event){const r=canvas.getBoundingClientRect();return [event.clientX-r.left,event.clientY-r.top];}
canvas.addEventListener('pointerdown',event=>{lastCameraInput=performance.now();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);const p=localPoint(event);pointers.set(event.pointerId,p);if(pointers.size===1){start=p;lastPoint=p;moved=false;}else{moved=true;pinchDistance=distance(...[...pointers.values()].slice(0,2));}});
canvas.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;lastCameraInput=performance.now();const p=localPoint(event);pointers.set(event.pointerId,p);
  if(pointers.size>=2){const [a,b]=[...pointers.values()],d=distance(a,b);if(pinchDistance>0)renderer.zoom(d/pinchDistance,[(a[0]+b[0])/2,(a[1]+b[1])/2]);pinchDistance=d;state.following=false;moved=true;return;}
  if(start && distance(start,p)>6)moved=true;
  if(moved && lastPoint){renderer.cameraInput();renderer.camera.x-=(p[0]-lastPoint[0])/renderer.unit;renderer.camera.y-=(p[1]-lastPoint[1])/renderer.unit;state.following=false;}lastPoint=p;
});
canvas.addEventListener('pointerup',async event=>{
  const p=localPoint(event);pointers.delete(event.pointerId);
  if(!moved && pointers.size===0){const world=renderer.world(p);
    if(state.tool){await settleForEdit();const kind=state.tool;let responders=0;if(kind==='disturb')responders=colony.disturb(world.map(Math.round));else colony.place(kind,world[0]);state.tool=null;updateTools();toast(kind==='disturb'?(responders?'Nearby workers raised an alarm. Watch at 1×.':'Ground disturbed. No workers were close enough to react.'):kind==='food'?'Food placed. Grain supplies energy and protein.':'Water placed. The pool shrinks as workers drink.');}
    else{const ants=colony.ants.filter(a=>distance(renderer.screen(a.pos),p)<26).sort((a,b)=>a.id-b.id),current=ants.findIndex(a=>a.id===state.selected);select(ants.length?ants[(current+1)%ants.length].id:null);}
  }
  if(pointers.size===1){lastPoint=[...pointers.values()][0];moved=true;}else{start=null;lastPoint=null;}pinchDistance=0;
});
canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);start=null;lastPoint=null;moved=true;pinchDistance=0;});
canvas.addEventListener('wheel',event=>{lastCameraInput=performance.now();event.preventDefault();renderer.zoom(Math.exp(-event.deltaY*.0015),localPoint(event));state.following=false;},{passive:false});
canvas.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();state.paused=!state.paused;updateUI();}if(['+','=','-'].includes(event.key)){event.preventDefault();renderer.zoom(event.key==='-'?.8:1.25);}if(event.key==='Escape'){state.tool=null;select(null);}});
new ResizeObserver(()=>renderer.resize()).observe(canvas);
function lifecycleSave(){if(!runner.busy&&!saving&&!store?.blocked&&colony.ants.length<600&&colony.brood.length<1000&&colony.foodItems.length<1000){try{if(store?.small.save(colony))storage.removeItem('little-colony.web.v1.database');}catch{}}else save();}
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden)lifecycleSave();else{last=performance.now();monitor.reset(last);}accumulator=0;});
window.addEventListener('pagehide',lifecycleSave);
function frame(now){
  const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
  const paused=state.paused || hidden || saving || dialogs.some(d=>d.open);
  let stats={ticks:0,simulated:0,cost:0};
  stats=runner.advance(colony,dt,state.speed,paused,()=>performance.now(),renderer.requests.size?3:5);
  if(state.following){const a=selectedAnt();if(a){const target=renderer.focus(a);renderer.camera.x+=(target.x-renderer.camera.x)*.1;renderer.camera.y+=(target.y-renderer.camera.y)*.1;}}
  const drawBegan=performance.now();renderer.draw(colony,{...state,paused},dt,now/1000);monitor.frame(now,stats,performance.now()-drawBegan);
  if(now-lastUI>250){updateUI();lastUI=now;}
  if(now-lastSave>(colony.ants.length>=600?60000:20000)&&pointers.size===0&&now-lastCameraInput>800&&!saveTask)save();
  if($('game').dataset.ready!=='true')$('game').dataset.ready='true';const terrainReady=renderer.requests.size===0&&!renderer.active&&!renderer.fallback&&now>=(renderer.motionUntil??0);if(canvas.dataset.terrainReady!==String(terrainReady))canvas.dataset.terrainReady=String(terrainReady);requestAnimationFrame(frame);
}
function networkState(){const cached=$('offline-state').dataset.cached==='true' || !!navigator.serviceWorker?.controller;$('offline-state').textContent=!navigator.onLine?(cached?'Offline · your colony is ready to play.':'Offline · open once online to cache the game.'):(cached?'Ready for offline play · saves stay on this device.':'Preparing offline play…');}
for(const event of ['online','offline'])window.addEventListener(event,networkState);
if('serviceWorker' in navigator){
  networkState();
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>{$('offline-state').dataset.cached='true';networkState();}).catch(()=>{if(navigator.serviceWorker.controller)networkState();else $('offline-state').textContent='Online play ready. Offline caching is unavailable in this browser.';});
}
else $('offline-state').textContent='Online play ready. Home Screen access works through your browser.';
updateTools();updateUI();requestAnimationFrame(frame);
let seen;try{seen=storage?.getItem('little-colony.guide');}catch{}
if(!seen)openDialog('guide');
if(saveError)setTimeout(()=>toast(saveError),500);
