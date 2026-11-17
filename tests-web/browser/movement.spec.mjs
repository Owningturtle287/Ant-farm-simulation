import {test,expect} from '@playwright/test';
test.use({video:'on'});
test.beforeEach(async({page})=>{await page.goto('./');await page.getByRole('button',{name:'Enter the clearing'}).click();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');});
  test('three body parts render independently and the saved pose matches the active sensors',async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.getByRole('button',{name:'Open colony roster'}).click();await page.locator('[data-ant="1"]').click();await page.getByRole('button',{name:'Follow this ant',exact:true}).click();for(let i=0;i<6;i++)await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await page.evaluate(()=>new Promise(resolve=>{let count=0;const frame=()=>++count>=150?resolve():requestAnimationFrame(frame);requestAnimationFrame(frame);}));
    await page.screenshot({path:info.outputPath('jointed-ant-closeup.png')});
    await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await page.getByRole('button',{name:'Close ant profile'}).click();await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Save colony now'}).click();
    const pose=await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('little-colony.web.v1')).colony;return c.ants.map(a=>({version:a.motion.version,neck:a.motion.neck,waist:a.motion.waist,speed:a.motion.speed}));});expect(pose.every(a=>a.version===2&&Math.abs(a.neck)<=.621&&Math.abs(a.waist)<=.421)).toBe(true);expect(pose.some(a=>Math.abs(a.neck)>.01)).toBe(true);await info.attach('articulated-poses.json',{body:JSON.stringify(pose),contentType:'application/json'});
    const parts=await page.evaluate(async()=>{const {buildAntParts}=await import('./ant-art.mjs');return Object.entries(buildAntParts('worker')).map(([name,canvas])=>({name,data:canvas.toDataURL().split(',')[1]}));});for(const part of parts)await info.attach('worker-'+part.name+'.png',{body:Buffer.from(part.data,'base64'),contentType:'image/png'});expect(errors).toEqual([]);
  });
