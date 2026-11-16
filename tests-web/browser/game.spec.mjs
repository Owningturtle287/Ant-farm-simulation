import {test,expect} from '@playwright/test';
import {createStaticServer} from '../../scripts/serve-web.mjs';
import {readFileSync} from 'node:fs';
test.beforeEach(async({page})=>{
  await page.goto('./');await page.getByRole('button',{name:'Enter the clearing'}).click();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
});
test('colony controls, inspection, food placement, and safe reset',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.screenshot({path:info.outputPath('first-clearing.png')});
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.getByRole('button',{name:'Resume simulation'})).toBeVisible();
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
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.getByRole('button',{name:'Resume simulation',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Terrain guide',exact:true}).click();await expect(page.getByRole('heading',{name:'Loose mound soil',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Diggable earth',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('terrain-guide.png')});
});
test('an existing colony upgrades with its population and mound intact',async({page},info)=>{
  const legacy=readFileSync(new URL('../fixtures/v1-colony.json',import.meta.url),'utf8'),data=JSON.parse(legacy).colony;
  // Seed before application startup; pagehide correctly saves the outgoing colony.
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),legacy);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#ants-count')).toHaveText(String(data.ants.length));
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
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.locator('#weather')).toContainText('Rain');
  await page.screenshot({path:info.outputPath('rain-grass-and-brood.png')});
  await page.getByRole('button',{name:'Open colony roster'}).click();await expect(page.locator('#brood-breakdown')).toContainText('eggs');await expect(page.locator('#brood-breakdown')).toContainText('larvae');await expect(page.locator('#brood-breakdown')).toContainText('pupae');await expect(page.locator('#queen-laying')).toContainText('eggs / colony day');
  await page.screenshot({path:info.outputPath('brood-and-laying-info.png')});
  await page.getByRole('button',{name:'Close colony roster'}).click();await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Terrain guide',exact:true}).click();await expect(page.getByRole('heading',{name:'Rain & puddles',exact:true})).toBeVisible();await expect(page.getByText('Pupa · tan ant shape',{exact:true})).toBeVisible();
});

test('fire-ant society, chemical senses, and local alarm tool work on a phone',async({page},info)=>{
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Fire ant behavior',exact:true}).click();await expect(page.getByRole('heading',{name:'A fire ant society',exact:true})).toBeVisible();await expect(page.getByText('Large workers are not a separate permanent soldier caste.',{exact:false})).toBeVisible();
  await page.screenshot({path:info.outputPath('fire-ant-behavior.png')});await page.getByRole('button',{name:'Close fire ant behavior'}).click();
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await page.getByRole('button',{name:'Show pheromone trails'}).click();await expect(page.getByRole('complementary',{name:'Chemical signal colors'})).toBeVisible();
  await page.getByRole('button',{name:'Open colony roster'}).click();await expect(page.locator('#habitat-stats')).toContainText('Solenopsis invicta');await expect(page.locator('#growth-status')).not.toBeEmpty();await page.locator('[data-ant="1"]').click();await expect(page.locator('#ant-senses')).toContainText('Antennae');await expect(page.locator('#ant-social')).toContainText('recognized contacts');await page.screenshot({path:info.outputPath('worker-senses-and-contact.png')});
  await page.getByRole('button',{name:'Close ant profile'}).click();await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Disturb the ground',exact:true}).click();
  await expect(page.locator('#placement-text')).toContainText('brief local alarm');const viewport=page.viewportSize();await page.locator('#world').click({position:{x:viewport.width*.5-(viewport.width>550?115:0),y:viewport.height*(viewport.width>550?.48:.30)}});await expect(page.getByRole('status').filter({hasText:'raised an alarm'})).toBeVisible();await page.screenshot({path:info.outputPath('local-alarm-response.png')});
});
test('a collected water portion removes visible finite squares and survives a save',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v5-water.json',import.meta.url),'utf8'),original=JSON.parse(raw).colony,patchID=original.world.patches.find(p=>p.kind==='water').id;
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.screenshot({path:info.outputPath('finite-water-before.png')});
  await expect.poll(async()=>{
    await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
    return page.evaluate(id=>{const c=JSON.parse(localStorage.getItem('little-colony.web.v1')).colony;return c.ants.some(a=>a.cargoKind==='water'&&a.carried>0)||c.waterDelivered>0;},patchID);
  },{timeout:20000,intervals:[500,1000]}).toBe(true);
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
  const remaining=await page.evaluate(id=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony.world.patches.find(p=>p.id===id).amount,patchID);expect(remaining).toBeLessThan(3);expect(remaining).toBeGreaterThanOrEqual(0);
  await page.screenshot({path:info.outputPath('finite-water-after.png')});await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
});

test('mature low mounds, organic galleries and chemical signals render together',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v6-mature.json',import.meta.url),'utf8');
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await page.getByRole('button',{name:'Show pheromone trails'}).click();await page.screenshot({path:info.outputPath('mature-mound-and-organic-galleries.png')});
});
test('a v0.4 colony upgrades without retaining its old patrol loop',async({page})=>{
  const data=JSON.parse(readFileSync(new URL('../fixtures/v4-colony.json',import.meta.url),'utf8'));data.colony.ants[1].task='patrolling';data.colony.ants[1].caste='major';
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),JSON.stringify(data));await page.reload();await expect(page.locator('#ants-count')).toHaveText(String(data.colony.ants.length));await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
  const patrols=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony.ants.filter(a=>a.task==='patrolling').length);expect(patrols).toBe(0);await page.getByRole('button',{name:'Open colony roster'}).click();await expect(page.locator('#colony-summary > div').filter({hasText:'Workers'}).locator('strong')).toHaveText(String(data.colony.ants.filter(a=>a.caste!=='queen').length));
});

test('an unstable older mound settles without losing the colony or its soil',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v5-unstable.json',import.meta.url),'utf8'),original=JSON.parse(raw).colony;
  await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
  await expect(page.locator('#ants-count')).toHaveText(String(original.ants.length));await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-colony.web.v1')).colony);expect(saved.world.geometryVersion).toBe(2);expect(saved.world.soilDeposited).toBe(original.world.soilDeposited);expect(saved.food).toBeGreaterThan(original.food-.5);
  const peak=Math.min(...saved.world.deposits.map(id=>Number(id.split(',')[1])));expect(peak).toBeGreaterThan(-10);await page.screenshot({path:info.outputPath('older-mound-settled.png')});
});

test('fine contours remain readable when zoomed and in portrait orientation',async({page},info)=>{
  const raw=readFileSync(new URL('../fixtures/v6-mature.json',import.meta.url),'utf8');await page.addInitScript(raw=>localStorage.setItem('little-colony.web.v1',raw),raw);await page.reload();await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
  if(page.viewportSize().width>1000){await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.screenshot({path:info.outputPath('fine-terrain-closeup.png')});}
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Return to nest'}).click();await expect(page.getByRole('button',{name:'Open menu'})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath('mature-contours-portrait.png')});
});
