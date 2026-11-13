import {test,expect} from '@playwright/test';
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
test('local saves restore and the complete app reopens offline under the repository subpath',async({page,context})=>{
  await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-colony.web.v1')));expect(saved.colony.ants.length).toBe(29);
  await page.reload();await expect(page.locator('#ants-count')).toHaveText('29');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'The first clearing'})).toBeVisible();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
  await page.getByRole('button',{name:'Open menu'}).click();await expect(page.locator('#offline-state')).toContainText('Offline');await context.setOffline(false);
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
