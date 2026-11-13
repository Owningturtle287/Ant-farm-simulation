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
