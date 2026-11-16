export function advanceSimulation(colony,pending,wallDelta,speed,clock=()=>performance.now(),budget=6){
  const began=clock();pending=Math.min(pending+wallDelta*speed,Math.max(2,speed*.5));let ticks=0;
  while(pending+1e-9>=.1&&ticks<128&&clock()-began<budget){colony.step(.1);pending=Math.max(0,pending-.1);ticks++;}
  return {pending,ticks,simulated:ticks*.1,cost:clock()-began};
}
export class PerformanceMonitor{
  constructor(){this.values={fps:0,frameMs:0,tickMs:0,drawMs:0,effective:0};this.reset();}
  reset(now=performance.now()){this.started=now;this.frames=0;this.ticks=0;this.simulated=0;this.simCost=0;this.drawCost=0;}
  frame(now,stats,drawCost){
    this.frames++;this.ticks+=stats.ticks;this.simulated+=stats.simulated;this.simCost+=stats.cost;this.drawCost+=drawCost;
    const elapsed=now-this.started;if(elapsed<1000)return false;
    this.values={fps:this.frames*1000/elapsed,frameMs:elapsed/this.frames,tickMs:this.ticks?this.simCost/this.ticks:0,drawMs:this.drawCost/this.frames,effective:this.simulated*1000/elapsed};this.reset(now);return true;
  }
}


// Yield a large tick between small batches; synchronous Colony.step remains the reference.
export class SimulationRunner{
  constructor(){this.iterator=null;this.colony=null;this.pending=0;}
  reset(){this.iterator=null;this.colony=null;this.pending=0;}
  get busy(){return this.iterator!==null;}
  advance(colony,wallDelta,speed,paused=false,clock=()=>performance.now(),budget=5){
    const began=clock();let ticks=0,slices=0;if(this.colony&&this.colony!==colony)this.reset();this.colony=colony;
    this.pending=paused?0:Math.min(this.pending+wallDelta*speed,Math.max(2,speed*.5));
    do{if(!this.iterator){if(paused||this.pending+1e-9<.1||ticks>=128)break;this.pending=Math.max(0,this.pending-.1);this.iterator=colony.tick(.1);}
      const result=this.iterator.next();slices++;if(result.done){this.iterator=null;ticks++;}
    }while(clock()-began<budget&&slices<4096);
    return {pending:this.pending,ticks,simulated:ticks*.1,cost:clock()-began,slices};
  }
  async finish(colony){while(this.busy&&this.colony===colony){this.advance(colony,0,1,true);if(this.busy)await new Promise(resolve=>setTimeout(resolve,0));}}
}
