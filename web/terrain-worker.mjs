import {rasterTerrain} from './terrain-raster.mjs';
function paint(job){const began=performance.now(),result=rasterTerrain(job.snapshot);return {id:job.id,epoch:job.epoch,version:job.version,size:result.size,pixels:result.data.buffer,cost:performance.now()-began};}
self.onmessage=({data:job})=>{try{if(job.batch){const batch=job.batch.map(paint);self.postMessage({epoch:job.epoch,batch},batch.map(r=>r.pixels));}else{const result=paint(job);self.postMessage(result,[result.pixels]);}}catch(error){self.postMessage({id:job.id,epoch:job.epoch,error:error.message});}};
