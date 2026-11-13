import {Colony,antName,taskLabels,reason,distance} from './sim.mjs';
import {SaveStore} from './persistence.mjs';
import {Renderer} from './render.mjs';
const $=id=>document.getElementById(id), canvas=$('world');
let storage,store,colony,saveError;
try {storage=window.localStorage;store=new SaveStore(storage);const loaded=store.load();colony=loaded?.colony;if(loaded?.recovered)saveError='Recovered your colony from its backup.';}catch(error){saveError=error.message;}
colony??=new Colony();
const renderer=new Renderer(canvas),state={speed:1,paused:false,trails:false,selected:null,following:false,tool:null};
let last=performance.now(),accumulator=0,lastUI=0,lastSave=last,toastTimer,hidden=document.hidden,lastAlive=colony.alive;
const dialogs=[...document.querySelectorAll('dialog')];
function toast(text) {clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function openDialog(id) {for(const d of dialogs)if(d.open)d.close();$(id).showModal();state.tool=null;updateTools();}
function closeDialog(id) {$(id).close();last=performance.now();}
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>closeDialog(b.dataset.close));
function save(explicit=false) {
  lastSave=performance.now();
  try {if(!store)throw Error('Local saving is unavailable in this browser. Export a backup from More.');if(store.save(colony,explicit)){$('save-status').textContent='COLONY SAVED';return true;}}
  catch(error){$('save-status').textContent='SAVE NEEDS ATTENTION';if(explicit)toast(error.message);}
  return false;
}
function selectedAnt(){return colony.ants.find(a=>a.id===state.selected);}
function select(id,focus=false){state.selected=id;state.following=false;state.tool=null;updateTools();if(focus){const a=selectedAnt();if(a)Object.assign(renderer.camera,renderer.focus(a));}updateUI();}
function updateTools(){
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===state.tool)));
  $('trails').setAttribute('aria-pressed',String(state.trails));$('placement').hidden=!state.tool;
  $('placement-text').textContent=state.tool?`Tap the world to leave ${state.tool} on the surface.`:'';
  canvas.style.cursor=state.tool?'crosshair':'grab';
}
function updateUI(){
  $('ants-count').textContent=colony.ants.length;$('food-count').textContent=Math.floor(colony.food);$('water-count').textContent=Math.floor(colony.water);$('brood-count').textContent=colony.brood.length;
  $('day').textContent=`Day ${colony.day}`;$('event').textContent=colony.events[0]?.text??'Life, one small step at a time.';
  $('pause-badge').hidden=!state.paused;$('pause').setAttribute('aria-label',state.paused?'Resume simulation':'Pause simulation');$('pause-icon').textContent=state.paused?'▶':'Ⅱ';
  $('speed').textContent=state.speed+'×';$('speed').setAttribute('aria-label',`Simulation speed: ${state.speed} times`);
  const ant=selectedAnt();$('inspector').hidden=!ant;
  if(ant){$('ant-name').textContent=antName(ant);$('ant-caste').textContent=ant.caste.toUpperCase();$('ant-task').textContent=taskLabels[ant.task];
    for(const metric of ['energy','health']){$(metric+'-value').textContent=Math.round(ant[metric]*100)+'%';$(metric+'-bar').style.width=ant[metric]*100+'%';}
    $('ant-age').textContent=Math.floor(ant.age/60)+'m';$('ant-experience').textContent=ant.experience;$('ant-trips').textContent=ant.trips;$('ant-reason').textContent=reason(ant);$('follow').textContent=state.following?'Following ant':'Follow this ant';
  }else{state.selected=null;state.following=false;}
  if(lastAlive && !colony.alive)toast('The queen has died. You can start a new colony from More.');lastAlive=colony.alive;
}
function buildRoster(){
  $('colony-summary').replaceChildren();
  for(const [label,value] of [['Workers',colony.ants.filter(a=>a.caste==='worker').length],['Brood',colony.brood.length],['New ants',colony.births],['Day',colony.day]]){
    const div=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;div.append(strong,span);$('colony-summary').append(div);
  }
  $('soil-stats').textContent=`${colony.world.soilExcavated} soil excavated · ${colony.world.soilDeposited} carried into the mound`;
  $('ant-list').replaceChildren();
  for(const ant of colony.ants){const button=document.createElement('button');button.className='ant-row';button.dataset.ant=ant.id;
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#i-ant');icon.append(use);
    const info=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small'),caste=document.createElement('span');strong.textContent=antName(ant);small.textContent=taskLabels[ant.task];caste.textContent=ant.caste;caste.className='caste';info.append(strong,small);button.append(icon,info,caste);
    button.addEventListener('click',()=>{closeDialog('roster');select(ant.id,true);});$('ant-list').append(button);
  }
}
$('pause').addEventListener('click',()=>{state.paused=!state.paused;accumulator=0;updateUI();});
$('speed').addEventListener('click',()=>{state.speed=state.speed===1?2:state.speed===2?4:1;updateUI();});
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{state.tool=state.tool===b.dataset.tool?null:b.dataset.tool;state.selected=null;state.following=false;updateTools();updateUI();}));
$('cancel-tool').addEventListener('click',()=>{state.tool=null;updateTools();});
$('trails').addEventListener('click',()=>{state.trails=!state.trails;updateTools();});
$('home').addEventListener('click',()=>{renderer.home();select(null);});
$('close-profile').addEventListener('click',()=>select(null));
$('follow').addEventListener('click',()=>{state.following=!state.following;const a=selectedAnt();if(a && state.following)Object.assign(renderer.camera,renderer.focus(a));updateUI();});
$('roster-button').addEventListener('click',()=>{buildRoster();openDialog('roster');});
$('menu-button').addEventListener('click',()=>openDialog('menu'));
$('save-now').addEventListener('click',()=>{closeDialog('menu');if(save(true))toast('Your colony is saved on this device.');});
$('help').addEventListener('click',()=>openDialog('guide'));
$('enter').addEventListener('click',()=>{try{storage?.setItem('little-colony.guide','seen');}catch{}closeDialog('guide');});
$('reset').addEventListener('click',()=>openDialog('reset-confirm'));
$('confirm-reset').addEventListener('click',()=>{colony=new Colony(Date.now()>>>0);state.selected=null;state.following=false;state.paused=false;accumulator=0;lastAlive=true;renderer.reset();closeDialog('reset-confirm');save(true);updateUI();toast('A new colony takes root.');});
$('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({version:1,savedAt:Date.now(),colony})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='little-colony-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Colony backup exported.');
});
$('install-button').addEventListener('click',()=>openDialog('install'));
for(const [id,factor] of [['zoom-in',1.25],['zoom-out',.8]])$(id).addEventListener('click',()=>{state.following=false;renderer.zoom(factor);});
const pointers=new Map();let start=null,lastPoint=null,moved=false,pinchDistance=0;
function localPoint(event){const r=canvas.getBoundingClientRect();return [event.clientX-r.left,event.clientY-r.top];}
canvas.addEventListener('pointerdown',event=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);const p=localPoint(event);pointers.set(event.pointerId,p);if(pointers.size===1){start=p;lastPoint=p;moved=false;}else{moved=true;pinchDistance=distance(...[...pointers.values()].slice(0,2));}});
canvas.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;const p=localPoint(event);pointers.set(event.pointerId,p);
  if(pointers.size>=2){const [a,b]=[...pointers.values()],d=distance(a,b);if(pinchDistance>0)renderer.zoom(d/pinchDistance,[(a[0]+b[0])/2,(a[1]+b[1])/2]);pinchDistance=d;state.following=false;moved=true;return;}
  if(start && distance(start,p)>6)moved=true;
  if(moved && lastPoint){renderer.camera.x-=(p[0]-lastPoint[0])/renderer.unit;renderer.camera.y-=(p[1]-lastPoint[1])/renderer.unit;state.following=false;}lastPoint=p;
});
canvas.addEventListener('pointerup',event=>{
  const p=localPoint(event);pointers.delete(event.pointerId);
  if(!moved && pointers.size===0){const world=renderer.world(p);
    if(state.tool){const kind=state.tool;colony.place(kind,world[0]);state.tool=null;updateTools();toast(kind==='food'?'Food placed. Let the scouts find it.':'Water placed. Workers will bring it home.');}
    else{const ants=colony.ants.filter(a=>distance(renderer.screen(a.pos),p)<26).sort((a,b)=>a.id-b.id),current=ants.findIndex(a=>a.id===state.selected);select(ants.length?ants[(current+1)%ants.length].id:null);}
  }
  if(pointers.size===1){lastPoint=[...pointers.values()][0];moved=true;}else{start=null;lastPoint=null;}pinchDistance=0;
});
canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);start=null;lastPoint=null;moved=true;pinchDistance=0;});
canvas.addEventListener('wheel',event=>{event.preventDefault();renderer.zoom(Math.exp(-event.deltaY*.0015),localPoint(event));state.following=false;},{passive:false});
canvas.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();state.paused=!state.paused;updateUI();}if(['+','=','-'].includes(event.key)){event.preventDefault();renderer.zoom(event.key==='-'?.8:1.25);}if(event.key==='Escape'){state.tool=null;select(null);}});
new ResizeObserver(()=>renderer.resize()).observe(canvas);
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden)save();else last=performance.now();accumulator=0;});
window.addEventListener('pagehide',()=>save());
function frame(now){
  const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
  const paused=state.paused || hidden || dialogs.some(d=>d.open);
  if(!paused){accumulator+=dt*state.speed;let steps=0;while(accumulator>=.1 && steps++<8){colony.step();accumulator-=.1;}}
  else accumulator=0;
  if(state.following){const a=selectedAnt();if(a){const target=renderer.focus(a);renderer.camera.x+=(target.x-renderer.camera.x)*.1;renderer.camera.y+=(target.y-renderer.camera.y)*.1;}}
  renderer.draw(colony,{...state,paused},dt,now/1000);
  if(now-lastUI>250){updateUI();lastUI=now;}
  if(now-lastSave>20000)save();
  if($('game').dataset.ready!=='true')$('game').dataset.ready='true';requestAnimationFrame(frame);
}
function networkState(){const cached=$('offline-state').dataset.cached==='true';$('offline-state').textContent=!navigator.onLine?(cached?'Offline · your colony is ready to play.':'Offline · open once online to cache the game.'):(cached?'Ready for offline play · saves stay on this device.':'Preparing offline play…');}
for(const event of ['online','offline'])window.addEventListener(event,networkState);
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(()=>navigator.serviceWorker.ready).then(()=>{$('offline-state').dataset.cached='true';networkState();}).catch(()=>{$('offline-state').textContent='Online play ready. Offline caching is unavailable in this browser.';});}
else $('offline-state').textContent='Online play ready. Home Screen access works through your browser.';
updateTools();updateUI();requestAnimationFrame(frame);
let seen;try{seen=storage?.getItem('little-colony.guide');}catch{}
if(!seen)openDialog('guide');
if(saveError)setTimeout(()=>toast(saveError),500);
