import {DAY,Random,clamp} from './biology.mjs';
import {initLedger,restoreLedger,addStock,removeStock,NUTRITION} from './resources.mjs';
import {densityAt} from './geometry.mjs';
export function terrainHash(x,seed){let h=(Math.imul(x,374761393)^seed)>>>0;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
function noise(x,seed){const i=Math.floor(x),t=x-i,s=t*t*(3-2*t);return ((terrainHash(i,seed)%1000)*(1-s)+(terrainHash(i+1,seed)%1000)*s)/1000;}
export function terrainHeight(x,seed){
  const shape=t=>noise(t/15,seed)*7+noise(t/37,seed^4729)*5;
  return 1+Math.round(shape(x)-shape(0));
}
export function snapshotMoisture(w){w.moistureSources=w.patches.filter(p=>p.kind==='water'&&p.amount>0).map(p=>({cell:[...p.cell],amount:p.amount}));}
export function initHabitat(w){
  w.habitatRegions=new Set();w.ecologyRng=new Random(w.seed^0x51a37);w.environmentAt=0;
  w.weather={raining:false,until:0,nextRain:120+w.ecologyRng.int(0,180),intensity:0,storms:0,wetness:.35};
  w.patches=[];w.nextPatchID=0;initLedger(w);
  for(let x=-96;x<=96;x+=32)ensureHabitat(w,x);
  if(!w.patches.some(p=>p.kind==='water')){const pool=basins(w).sort((a,b)=>Math.abs(a.x)-Math.abs(b.x))[0];if(pool)addPuddle(w,pool,12);}
  snapshotMoisture(w);
}
export function ensureHabitat(w,x){
  const region=Math.floor(x/32);if(w.habitatRegions.has(region))return;w.habitatRegions.add(region);
  for(let px=region*32+1;px<(region+1)*32;px+=4){
    const h=terrainHash(px,w.seed);if(Math.abs(px)<3||h%7===0)continue;
    if(w.patches.some(p=>p.kind==='food'&&Math.abs(p.cell[0]-px)<2))continue;
    const p={id:w.nextPatchID++,kind:'food',origin:'grass',nutrition:NUTRITION.grain,cell:[px,w.surface(px)-1],amount:0,capacity:8+h%11,growth:1,stage:'seed',regrowAt:0};w.patches.push(p);addStock(w,p,p.capacity);
  }
  // Residual water starts only in actual depressions. Rain replenishes these sites.
  for(const basin of basins(w,region*32,(region+1)*32-1))if(terrainHash(basin.x,w.seed)%3===0)addPuddle(w,basin,8+terrainHash(basin.x,w.seed)%12);
}
export function basins(w,min=-96,max=127){
  const result=[];
  for(let x=min;x<=max;x++){
    const y=w.surface(x);if(w.entrances?.some(e=>Math.abs(e.mouth[0]-x)<2)||y<w.surface(x-1)||y<w.surface(x+1))continue;
    if(y===w.surface(x-1))continue; // One representative per flat-bottomed depression.
    const left=x;let right=x;while(right<max+16&&w.surface(right+1)===y)right++;
    if(w.surface(left-1)>=y||w.surface(right+1)>=y)continue;
    result.push({x:Math.round((left+right)/2),left,right,depth:y-Math.max(w.surface(left-1),w.surface(right+1))});
  }return result;
}
export function addPuddle(w,basin,amount){
  if(w.entrances?.some(e=>Math.abs(e.mouth[0]-basin.x)<2))return;
  let p=w.patches.find(p=>p.kind==='water'&&p.origin==='puddle'&&Math.abs(p.cell[0]-basin.x)<3);
  if(!p){p={id:w.nextPatchID++,kind:'water',origin:'puddle',cell:[basin.x,w.surface(basin.x)-1],amount:0,left:basin.left,right:basin.right,capacity:18*Math.max(1,basin.right-basin.left+1)};w.patches.push(p);}
  addStock(w,p,amount);p.left=basin.left;p.right=basin.right;return p;
}
export function harvest(w,p,amount,time,pieceID){
  const taken=removeStock(w,p,amount,'harvested',pieceID);
  if(p.amount<.001)p.depletedAt=time;
  if(p.kind==='food'&&p.amount<.001){
    removeStock(w,p,p.amount,'decayed');
    if(p.origin==='grass'){p.stage='dead';p.growth=0;p.regrowAt=time+DAY*(.6+(terrainHash(p.cell[0],w.seed)%10)/10);w.changed([p.cell[0],w.baseSurface(p.cell[0])]);}
  }
  return taken;
}
export function tickHabitat(w,time){
  const elapsed=time-w.environmentAt;if(elapsed<2)return;w.environmentAt=time;
  const weather=w.weather;if(weather.raining)weather.lastRainAt=time;
  if(w.spaceReady&&w.resourceGeometryRevision!==w.revision){w.resourceGeometryRevision=w.revision;for(const p of w.patches)for(const i of [...(p.pieces??[])])if(densityAt(...i.pos,(x,y)=>w.solid([x,y]))>=.49){p.activePieceID=i.id;removeStock(w,p,i.amount,'buried');delete p.activePieceID;}}
  if(!weather.raining&&time>=weather.nextRain){weather.raining=true;weather.intensity=.5+w.ecologyRng.float()*.5;weather.until=time+70+w.ecologyRng.int(0,110);weather.storms++;}
  if(weather.raining&&time>=weather.until){weather.raining=false;weather.intensity=0;weather.nextRain=time+DAY*(2+w.ecologyRng.float()*4);}
  weather.wetness=clamp(weather.wetness+(weather.raining?.003:-.00022)*elapsed,.08,.9);
  for(const p of w.patches){
    if(p.origin==='seep')continue;const y=w.surface(p.cell[0])-1;if(p.cell[1]!==y){p.cell[1]=y;}
    const buried=w.surface(p.cell[0])<w.baseSurface(p.cell[0]);
    if(p.origin==='grass'){
      if(buried){removeStock(w,p,p.amount,'buried');p.stage='dead';p.growth=0;p.regrowAt=time+DAY;continue;}
      if(p.stage==='dead'&&time>=p.regrowAt){p.stage='sprout';p.growth=.02;w.changed([p.cell[0],w.baseSurface(p.cell[0])]);}
      if(p.stage==='sprout'){
        p.growth=clamp(p.growth+elapsed/(DAY*1.4)*(.3+weather.wetness));
        if(p.growth>=1){p.stage='seed';addStock(w,p,p.capacity);}
      }
    }else if(p.kind==='water'&&!weather.raining){removeStock(w,p,elapsed*(p.origin==='puddle'?.012:.008),'evaporated');}
  }
  // Loose grain can be placed by the player or migrated from older finite food sources.
  if(w.patches.some(p=>p.origin==='grain'&&p.amount===0))w.patches=w.patches.filter(p=>p.origin!=='grain'||p.amount>0);
  if(weather.raining){
    for(const region of w.habitatRegions)for(const basin of basins(w,region*32,(region+1)*32-1)){
      addPuddle(w,basin,elapsed*weather.intensity*(.12+Math.min(20,basin.right-basin.left)*.025));
    }
  }
  snapshotMoisture(w);
}
export function restoreHabitat(w,d){
  restoreLedger(w,d);w.moistureSources=d.moistureSources??w.patches.filter(p=>p.kind==='water'&&p.amount>0).map(p=>({cell:[...p.cell],amount:p.amount}));
  w.habitatRegions=new Set(d.habitatRegions??[]);delete w.nextPrey;w.ecologyRng=new Random(d.ecologyRng?.state??(w.seed^0x51a37));
  w.environmentAt=d.environmentAt??0;w.nextPatchID=d.nextPatchID??Math.max(0,...w.patches.map(p=>p.id))+1;
  w.weather=d.weather??{raining:false,until:0,nextRain:w.environmentAt+180,intensity:0,storms:0,wetness:.35};
  if(!d.weather){
    for(const p of w.patches){
      if(p.kind==='food')Object.assign(p,{origin:'grass',capacity:Math.max(12,p.amount),growth:p.amount>0?1:0,stage:p.amount>0?'seed':'dead',regrowAt:w.environmentAt+DAY});
      else p.origin='placed';
    }
  }
  // A change of food source keeps its finite stock, identity, and ground positions.
  for(const p of w.patches)if(p.kind==='food'){
    if(p.origin!=='grass')p.origin='grain';
    p.nutrition=NUTRITION.grain;
  }
  if(!d.weather)for(let x=-96;x<=96;x+=32)ensureHabitat(w,x);
}
