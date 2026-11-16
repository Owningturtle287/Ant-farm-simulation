import {rasterTerrain} from './terrain-raster.mjs';
self.onmessage=({data:job})=>{try{const began=performance.now(),result=rasterTerrain(job.snapshot);self.postMessage({id:job.id,epoch:job.epoch,version:job.version,size:result.size,pixels:result.data.buffer,cost:performance.now()-began},[result.data.buffer]);}catch(error){self.postMessage({id:job.id,epoch:job.epoch,error:error.message});}};
