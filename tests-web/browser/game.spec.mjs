import {test,expect} from '@playwright/test';
import {createStaticServer} from '../../scripts/serve-web.mjs';
import {readFileSync} from 'node:fs';
async function zoomCamera(page,browserName,delta){
  if(browserName!=='webkit'){await page.mouse.wheel(0,delta);return;}
  // Mobile WebKit's driver has no wheel API. Exercise the app's two-pointer pinch path.
  await page.evaluate(async delta=>{const canvas=document.querySelector('#world'),r=canvas.getBoundingClientRect(),x=r.left+r.width*.6,y=r.top+r.height*.55,original=canvas.setPointerCapture;canvas.setPointerCapture=()=>{};
    const fire=(type,id,dx)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===71,clientX:x+dx,clientY:y,buttons:type==='pointerup'?0:1,bubbles:true,cancelable:true}));
    try{fire('pointerdown',71,-30);fire('pointerdown',72,30);for(let i=1;i<=12;i++){const span=30*Math.exp(-delta*.0015*i/12);fire('pointermove',71,-span);fire('pointermove',72,span);await new Promise(requestAnimationFrame);}fire('pointerup',71,-30);fire('pointerup',72,30);}finally{canvas.setPointerCapture=original;}
  },delta);
}
test.beforeEach(async({page})=>{
  await page.goto('./');await page.getByRole('button',{name:'Enter the clearing'}).click();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
});
test('colony controls, inspection, food placement, and safe reset',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.screenshot({path:info.outputPath('first-clearing.png')});
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await expect(page.getByRole('button',{name:'Resume simulation'})).toBeVisible();
  await page.getByRole('button',{name:'Resume simulation'}).click();await page.getByRole('button',{name:'Simulation speed: 1 times'}).click();await expect(page.getByRole('button',{name:'Simulation speed: 2 times'})).toBeVisible();
  await page.getByRole('button',{name:'Open colony roster'}).click();await page.locator('[data-ant="0"]').click();await expect(page.locator('#ant-name')).toHaveText('Queen Aurelia');
  await page.screenshot({path:info.outputPath('individual-ant.png')});await page.getByRole('button',{name:'Follow this ant',exact:true}).click();await expect(page.getByRole('button',{name:'Following ant',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Return to nest'}).click();await page.getByRole('button',{name:'Place food',exact:true}).click();
  const size=page.viewportSize();await page.locator('#world').click({position:{x:size.width*.28,y:size.height*.48}});await expect(page.getByRole('status').filter({hasText:'Food placed.'})).toBeVisible();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Start a new colony',exact:true}).click();await expect(page.getByRole('dialog',{name:'A new beginning?'})).toBeVisible();await page.getByRole('button',{name:'Keep my colony'}).click();
  expect(errors).toEqual([]);
});
test('local saves restore and the complete app reopens without its origin under the repository subpath',async({page,context,browserName})=>{
  const origin=createStaticServer();await new Promise(resolve=>origin.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${origin.address().port}/Ant-farm-simulation/`;
  const stop=async()=>{if(!origin.listening)return;const closed=new Promise((resolve,reject)=>origin.close(error=>error?reject(error):resolve()));origin.closeAllConnections();await closed;};
  try{
    await page.goto(url);await page.getByRole('button',{name:'Enter the clearing'}).click();
    await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-colony.web.v1')));expect(saved.colony.ants.length).toBe(13);expect(saved.version).toBe(4);
    await page.reload();await expect(page.locator('#ants-count')).toHaveText('13');
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
    // WebKit's offline flag rejects even literal service-worker responses:
    // https://github.com/microsoft/playwright/issues/42775
    // Stop the actual origin for WebKit; Chromium also exercises offline emulation.
    if(browserName==='webkit'){await stop();expect(origin.listening).toBe(false);}else await context.setOffline(true);
    const response=await page.reload({waitUntil:'domcontentloaded'});expect(response.fromServiceWorker()).toBe(true);
    await expect(page.getByRole('heading',{name:'The first clearing'})).toBeVisible();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
    const blocked=await page.evaluate(async()=>{try{await fetch('./offline-probe?'+Date.now(),{cache:'no-store'});return false;}catch{return true;}});expect(blocked).toBe(true);
    await page.getByRole('button',{name:'Open menu'}).click();await expect(page.locator('#offline-state')).toHaveText(/offline/i);await expect(page.locator('#offline-state')).not.toContainText('unavailable');
  }finally{await context.setOffline(false);await stop();}
});
test('reproduction settings persist and small new colonies respect the selected start size',async({page})=>{
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Colony & reproduction',exact:true}).click();
  await page.locator('#egg-rate').selectOption('0');await page.locator('#brood-rate').selectOption('4');await page.locator('#starting-workers').selectOption('6');await page.locator('#population-cap').selectOption('250');
  await page.getByRole('button',{name:'Back to the colony',exact:true}).click();await page.reload();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Colony & reproduction',exact:true}).click();
  await expect(page.locator('#egg-rate')).toHaveValue('0');await expect(page.locator('#brood-rate')).toHaveValue('4');await expect(page.locator('#population-cap')).toHaveValue('250');
  await expect(page.locator('#ants-count')).toHaveText('13');await page.getByRole('button',{name:'Back to the colony',exact:true}).click();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Start a new colony',exact:true}).click();await page.getByRole('button',{name:'Start new colony',exact:true}).click();await expect(page.locator('#ants-count')).toHaveText('7');
});
test('128x remains interactive, records actual performance, and builds a distinguishable mound',async({page},info)=>{
  for(const speed of [1,2,4,8,16,32,64])await page.getByRole('button',{name:'Simulation speed: '+speed+' times',exact:true}).click();
  await expect(page.getByRole('button',{name:'Simulation speed: 128 times',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Show performance',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Live performance'})).toBeVisible();
  await expect.poll(async()=>Number(await page.locator('#perf-fps').textContent()),{timeout:15000}).toBeGreaterThan(0);
  await expect.poll(async()=>Number(await page.locator('#perf-mound').textContent()),{timeout:15000}).toBeGreaterThan(0);
  await expect(page.locator('#perf-speed')).toContainText('/ 128×');await page.screenshot({path:info.outputPath('living-soil-mound.png')});
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await expect(page.getByRole('button',{name:'Resume simulation',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Terrain guide',exact:true}).click();await expect(page.getByRole('heading',{name:'Loose mound soil',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Diggable earth',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('terrain-guide.png')});
});
test('an existing colony upgrades with its population and mound intact',async({page},info)=>{
  const legacy=readFileSync(new URL('../fixtures/v1-colony.json',import.meta.url),'utf8'),data=JSON.parse(legacy).colony;
  // Seed before application startup; pagehide correctly saves the outgoing colony.
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),legacy);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await expect(page.locator('#ants-count')).toHaveText(String(data.ants.length));
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Show performance',exact:true}).click();expect(Number(await page.locator('#perf-mound').textContent())).toBeGreaterThanOrEqual(data.world.soilDeposited);
  await page.screenshot({path:info.outputPath('upgraded-colony-mound.png')});
});
test('portrait phone layout and Home Screen metadata are complete',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Open menu'})).toBeInViewport();await expect(page.getByRole('button',{name:'Place food',exact:true})).toBeInViewport();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save to my Home Screen'}).click();await expect(page.getByRole('heading',{name:'Keep your colony close.'})).toBeVisible();
  await page.getByRole('button',{name:'Back to the clearing'}).click();await page.screenshot({path:info.outputPath('iphone-portrait.png')});
  const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel="manifest"]').href).then(r=>r.json()));expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('./');
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('./icons/apple-touch-icon.png');
  for(const icon of manifest.icons){const response=await page.request.get(icon.src);expect(response.ok()).toBe(true);}
});

test('rainy grassland, nursery stages, and queen production information survive reopening',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v3-living.json',import.meta.url),'utf8');
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await expect(page.locator('#weather')).toContainText('Rain');
  await page.screenshot({path:info.outputPath('rain-grass-and-brood.png')});
  await page.getByRole('button',{name:'Open colony roster'}).click();await expect(page.locator('#brood-breakdown')).toContainText('eggs');await expect(page.locator('#brood-breakdown')).toContainText('larvae');await expect(page.locator('#brood-breakdown')).toContainText('pupae');await expect(page.locator('#queen-laying')).toContainText('eggs / colony day');
  await page.screenshot({path:info.outputPath('brood-and-laying-info.png')});
  await page.getByRole('button',{name:'Close colony roster'}).click();await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Terrain guide',exact:true}).click();await expect(page.getByRole('heading',{name:'Rain & puddles',exact:true})).toBeVisible();await expect(page.getByText('Pupa · tan ant shape',{exact:true})).toBeVisible();
});

test('fire-ant society, chemical senses, and local alarm tool work on a phone',async({page},info)=>{
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Fire ant behavior',exact:true}).click();await expect(page.getByRole('heading',{name:'A fire ant society',exact:true})).toBeVisible();await expect(page.getByText('Large workers are not a separate permanent soldier caste.',{exact:false})).toBeVisible();
  await page.screenshot({path:info.outputPath('fire-ant-behavior.png')});await page.getByRole('button',{name:'Close fire ant behavior'}).click();
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await page.getByRole('button',{name:'Show pheromone trails'}).click();await expect(page.getByRole('complementary',{name:'Chemical signal colors'})).toBeVisible();
  await page.getByRole('button',{name:'Open colony roster'}).click();await expect(page.locator('#habitat-stats')).toContainText('Solenopsis invicta');await expect(page.locator('#growth-status')).not.toBeEmpty();await page.locator('[data-ant="1"]').click();await expect(page.locator('#ant-senses')).toContainText('Antennae');await expect(page.locator('#ant-social')).toContainText('recognized contacts');await page.screenshot({path:info.outputPath('worker-senses-and-contact.png')});
  await page.getByRole('button',{name:'Close ant profile'}).click();await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Disturb the ground',exact:true}).click();
  await expect(page.locator('#placement-text')).toContainText('brief local alarm');const viewport=page.viewportSize();await page.locator('#world').click({position:{x:viewport.width*.5-(viewport.width>550?115:0),y:viewport.height*(viewport.width>550?.48:.30)}});await expect(page.getByRole('status').filter({hasText:'raised an alarm'})).toBeVisible();await page.screenshot({path:info.outputPath('local-alarm-response.png')});
});
test('a collected water portion removes visible finite squares and survives a save',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v5-water.json',import.meta.url),'utf8'),original=JSON.parse(raw).colony,patchID=original.world.patches.find(p=>p.kind==='water').id;
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.screenshot({path:info.outputPath('finite-water-before.png')});
  await expect.poll(async()=>{
    await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
    return page.evaluate(id=>{const c=JSON.parse(localStorage.getItem('little-colony.web.v1')).colony;return c.ants.some(a=>(a.deliveryKind==='water'&&a.socialWater>0)||(a.cargoKind==='water'&&a.carried>0))||c.waterDelivered>0;},patchID);
  },{timeout:20000,intervals:[500,1000]}).toBe(true);
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
  const remaining=await page.evaluate(id=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony.world.patches.find(p=>p.id===id).amount,patchID);expect(remaining).toBeLessThan(original.world.patches.find(p=>p.id===patchID).amount);expect(remaining).toBeGreaterThanOrEqual(0);const pieces=await page.evaluate(id=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony.world.patches.find(p=>p.id===id).pieces.reduce((s,p)=>s+p.amount,0),patchID);expect(Math.abs(pieces-remaining)).toBeLessThan(1e-7);
  await page.screenshot({path:info.outputPath('finite-water-after.png')});await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
});

test('mature low mounds, organic galleries and chemical signals render together',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v6-mature.json',import.meta.url),'utf8');
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await page.getByRole('button',{name:'Show pheromone trails'}).click();await page.screenshot({path:info.outputPath('mature-mound-and-organic-galleries.png')});
});
test('a v0.4 colony upgrades without retaining its old patrol loop',async({page})=>{
  const data=JSON.parse(readFileSync(new URL('../fixtures/v4-colony.json',import.meta.url),'utf8'));data.colony.ants[1].task='patrolling';data.colony.ants[1].caste='major';
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),JSON.stringify(data));await page.reload();await expect(page.locator('#ants-count')).toHaveText(String(data.colony.ants.length));await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
  const patrols=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony.ants.filter(a=>a.task==='patrolling').length);expect(patrols).toBe(0);await page.getByRole('button',{name:'Open colony roster'}).click();await expect(page.locator('#colony-summary > div').filter({hasText:'Workers'}).locator('strong')).toHaveText(String(data.colony.ants.filter(a=>a.caste!=='queen').length));
});

test('an unstable older mound settles without losing the colony or its soil',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v5-unstable.json',import.meta.url),'utf8'),original=JSON.parse(raw).colony;
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
  await expect(page.locator('#ants-count')).toHaveText(String(original.ants.length));await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony);expect(saved.world.geometryVersion).toBe(2);expect(saved.world.soilDeposited).toBe(original.world.soilDeposited);expect(saved.food).toBeGreaterThan(original.food-.5);
  const peak=Math.min(...saved.world.deposits.map(id=>Number(id.split(',')[1])));expect(peak).toBeGreaterThan(-10);await page.screenshot({path:info.outputPath('older-mound-settled.png')});
});

test('fine contours remain readable when zoomed and in portrait orientation',async({page,browserName},info)=>{
  const raw=readFileSync(new URL('../fixtures/v6-mature.json',import.meta.url),'utf8');await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
  if(page.viewportSize().width>1000){await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.screenshot({path:info.outputPath('fine-terrain-closeup.png')});}
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Return to nest'}).click();await expect(page.getByRole('button',{name:'Open menu'})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath('mature-contours-portrait.png')});
});


test('camera sweeps use background terrain and retain a bounded cache',async({page,browserName},info)=>{
  const raw=readFileSync(new URL('../fixtures/v6-mature.json',import.meta.url),'utf8');await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Show performance',exact:true}).click();
  await expect.poll(async()=>JSON.parse(await page.locator('#performance-panel').getAttribute('data-readings')).terrain.worker).toBe(true);
  await page.evaluate(()=>{window.cameraFrames=[];let previous=performance.now();const frame=now=>{cameraFrames.push(now-previous);previous=now;if(cameraFrames.length<360)requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  const {width,height}=page.viewportSize();for(let i=0;i<4;i++){await page.mouse.move(width*.6,height*.6);await page.mouse.down();await page.mouse.move(width*(i%2?.85:.25),height*.65,{steps:18});await page.mouse.up();await zoomCamera(page,browserName,i%2?-400:400);}
  await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
  const report=await page.evaluate(()=>{const frames=cameraFrames.slice(3).sort((a,b)=>a-b);return {frames:frames.length,p95:frames[Math.floor(frames.length*.95)],max:frames.at(-1),...JSON.parse(document.querySelector('#performance-panel').dataset.readings)};});expect(report.frames).toBeGreaterThan(20);expect(report.p95).toBeLessThan(110);expect(report.terrain.worker).toBe(true);await expect(page.locator('#world')).toHaveAttribute('data-render-dpr',String(await page.evaluate(()=>Math.min(2,devicePixelRatio))));expect(report.terrainCacheBytes).toBeLessThanOrEqual(24*1024*1024);expect(report.terrain.built).toBeGreaterThan(0);await info.attach('camera-performance.json',{body:JSON.stringify(report,null,2),contentType:'application/json'});await page.screenshot({path:info.outputPath('responsive-camera.png')});
});

test('10000-ant saves use atomic database generations and the roster stays paged',async({page,browserName},info)=>{
  test.setTimeout(120000);const d=JSON.parse(readFileSync(new URL('../fixtures/v6-mature.json',import.meta.url),'utf8'));d.colony.settings.populationCap=10000;d.colony.settings.eggRate=0;const baby=d.colony.brood[0];const open=d.colony.world.excavated.map(id=>id.split(',').map(Number));
  d.colony.ants=Array.from({length:10000},(_,id)=>({id,caste:id?'worker':'queen',cell:open[id%open.length],pos:open[id%open.length],task:id?'reserve':'queenRest',busyUntil:1e9,energy:1,hydration:1,health:1,age:0,initialAgeDays:1}));
  d.colony.brood=Array.from({length:1000},(_,i)=>({...baby,id:100000+i,cell:open[i%open.length],carriedBy:null,age:6000,nutrition:1,vitality:1}));d.colony.nextID=101000;
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),JSON.stringify(d));await page.reload();await expect(page.locator('#ants-count')).toHaveText('10000');await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Show performance',exact:true}).click();
  await page.evaluate(()=>{window.largeFrames=[];let previous=performance.now();const frame=now=>{largeFrames.push(now-previous);previous=now;if(largeFrames.length<240)requestAnimationFrame(frame);};requestAnimationFrame(frame);});const viewport=page.viewportSize();for(let i=0;i<2;i++){await page.mouse.move(viewport.width*.65,viewport.height*.65);await page.mouse.down();await page.mouse.move(viewport.width*.35,viewport.height*.6,{steps:24});await page.mouse.up();await zoomCamera(page,browserName,i?-250:250);}
  const motion=await page.evaluate(()=>{const frames=largeFrames.slice(3).sort((a,b)=>a-b);return {frames:frames.length,p95:frames[Math.floor(frames.length*.95)],max:frames.at(-1),...JSON.parse(document.querySelector('#performance-panel').dataset.readings)};});expect(motion.frames).toBeGreaterThan(12);expect(motion.p95).toBeLessThan(150);await info.attach('10000-ant-camera.json',{body:JSON.stringify(motion),contentType:'application/json'});await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();await expect(page.getByRole('status').filter({hasText:'Your colony is saved'})).toBeVisible({timeout:45000});await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
  await page.getByRole('button',{name:'Open colony roster'}).click();expect(await page.locator('.ant-row').count()).toBe(100);await page.getByRole('button',{name:'Show next 100 ants',exact:true}).click();expect(await page.locator('.ant-row').count()).toBe(200);await page.getByRole('button',{name:'Close colony roster'}).click();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Colony & reproduction',exact:true}).click();await expect(page.locator('#population-cap')).toHaveValue('10000');for(const cap of ['20','40','750','1000','2000','5000','7500','10000'])expect(await page.locator(`#population-cap option[value="${cap}"]`).count()).toBe(1);await page.getByRole('button',{name:'Back to the colony',exact:true}).click();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();await expect(page.getByRole('status').filter({hasText:'Your colony is saved'})).toBeVisible({timeout:45000});
  expect(await page.evaluate(()=>localStorage.getItem('little-colony.web.v1.database'))).toBe('1');await page.reload();await expect(page.locator('#ants-count')).toHaveText('10000');await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();await expect(page.getByRole('status').filter({hasText:'Your colony is saved'})).toBeVisible({timeout:45000});
  const heads=await page.evaluate(async()=>{const {ColonyStore}=await import('./large-saves.mjs'),s=new ColonyStore(localStorage);return s.read(['primary','backup']);});expect(heads[0].ants).toBe(10000);expect(heads[1].ants).toBe(10000);expect(heads[0].id).not.toBe(heads[1].id);await info.attach('large-save-heads.json',{body:JSON.stringify(heads),contentType:'application/json'});
  await page.evaluate(async id=>{const {ColonyStore}=await import('./large-saves.mjs'),s=new ColonyStore(localStorage);await s.put(id+':meta',null);},heads[0].id);await page.reload();await expect(page.locator('#ants-count')).toHaveText('10000');await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();await expect(page.getByRole('status').filter({hasText:'Your colony is saved'})).toBeVisible({timeout:45000});const backup=await page.evaluate(async()=>{const {ColonyStore}=await import('./large-saves.mjs');return (await new ColonyStore(localStorage).read(['backup']))[0];});expect(backup.id).toBe(heads[1].id);
});

test('terrain rendering falls back to bounded row batches when workers are unavailable',async({page},info)=>{
  await page.addInitScript(()=>{window.Worker=undefined;});await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:30000});await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Show performance',exact:true}).click();await expect.poll(async()=>JSON.parse(await page.locator('#performance-panel').getAttribute('data-readings')).terrain.worker).toBe(false);await page.screenshot({path:info.outputPath('budgeted-fallback.png')});
});

test('articulated ants expose bilateral sensing and layered chemical cues',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:'Show pheromone trails'}).click();
  await expect(page.getByRole('complementary',{name:'Chemical signal colors'})).toContainText('Food scent');await expect(page.locator('#trail-legend')).toContainText('Moisture');
  await page.getByRole('button',{name:'Open colony roster'}).click();await page.locator('[data-ant="1"]').click();await page.getByRole('button',{name:'Follow this ant',exact:true}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(page.locator('#ant-sensing')).toContainText(/Left [\d.]+ · right [\d.]+/);await expect(page.locator('#ant-senses')).toContainText('Antennae');
  await page.evaluate(()=>new Promise(resolve=>{let frames=0;const step=()=>++frames>=24?resolve():requestAnimationFrame(step);requestAnimationFrame(step);}));
  await page.screenshot({path:info.outputPath('living-ant-and-bilateral-senses.png')});
  await page.getByRole('button',{name:'Close ant profile'}).click();await page.getByRole('button',{name:'Return to nest'}).click();
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
  await page.screenshot({path:info.outputPath('layered-pheromones-and-source-scent.png')});
  // Atlas evidence shows all three body sizes and distinct limb/antenna poses.
  const atlas=await page.evaluate(async()=>{const {buildAntAtlas}=await import('./ant-art.mjs');return buildAntAtlas('worker').toDataURL().split(',')[1];});await info.attach('articulated-worker-atlas.png',{body:Buffer.from(atlas,'base64'),contentType:'image/png'});
  expect(errors).toEqual([]);
});


test('separate social crops, physical food caches and individual brood beds survive reopening',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v9-drought.json',import.meta.url),'utf8');await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:20000});
  await page.getByRole('button',{name:'Open colony roster'}).click();await expect(page.locator('#supply-stats')).toContainText('separate stored food parcels');await expect(page.locator('#supply-stats')).toContainText('water carried in crops');await page.locator('[data-ant="0"]').click();await page.locator('#crop-food-value').scrollIntoViewIfNeeded();await expect(page.locator('#crop-food-value')).toContainText('%');await expect(page.locator('#crop-water-value')).toContainText('%');await page.screenshot({path:info.outputPath('social-stomach-food-and-water.png')});
  await page.getByRole('button',{name:'Close ant profile'}).click();await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();await expect(page.getByRole('status').filter({hasText:'Your colony is saved'})).toBeVisible();
  const check=await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('little-colony.web.v1')).colony,slots=[];for(const p of c.world.patches)for(const i of p.pieces??[])slots.push(i.pos.map(v=>Math.round(v*3)).join(','));for(const p of c.foodItems)slots.push(p.pos.map(v=>Math.round(v*3)).join(','));for(const b of c.brood)if(b.carriedBy==null)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)slots.push((b.cell[0]*3+x)+','+(b.cell[1]*3+y));return{all:slots.length,unique:new Set(slots).size,caches:c.foodItems.length,version:c.supplyVersion,seep:c.world.patches.some(p=>p.origin==='seep'),waterCaches:c.foodItems.some(p=>p.kind==='water')};});expect(check.all).toBe(check.unique);expect(check.caches).toBeGreaterThan(0);expect(check.version).toBe(1);expect(check.seep).toBe(true);expect(check.waterCaches).toBe(false);await info.attach('individual-item-spaces.json',{body:JSON.stringify(check),contentType:'application/json'});await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
});

test('water-table depth and a much wider camera view work on a phone',async({page},info)=>{
  test.setTimeout(90000);const raw=readFileSync(new URL('../fixtures/v9-drought.json',import.meta.url),'utf8');await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Colony & reproduction',exact:true}).click();await expect(page.locator('#water-depth')).toHaveValue('24');await page.locator('#water-depth').selectOption('80');await page.getByRole('button',{name:'Back to the colony',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony.settings.waterTableDepth)).toBe(80);
  for(let i=0;i<18;i++)await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-camera-zoom','0.100');await expect(page.locator('#world')).toHaveAttribute('data-terrain-ready','true',{timeout:45000});await page.screenshot({path:info.outputPath('deep-water-table-and-wide-view.png')});
});
