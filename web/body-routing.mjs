// Search body configurations, not merely empty cell centres. Static geometry is shared across ants.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const pointKey=p=>p[0].toFixed(4)+','+p[1].toFixed(4);
const HEADINGS=Array.from({length:8},(_,i)=>i*Math.PI/4);
const STEPS=[[.5,0],[-.5,0],[0,.5],[0,-.5],[.5,.5],[.5,-.5],[-.5,.5],[-.5,-.5]];
function boundedSet(map,key,value,limit){if(map.size>=limit)map.delete(map.keys().next().value);map.set(key,value);return value;}
class Heap{
  constructor(){this.values=[];}
  push(node){const v=this.values;v.push(node);let i=v.length-1;while(i){const p=(i-1)>>1;if(v[p].f<node.f||v[p].f===node.f&&v[p].order<node.order)break;v[i]=v[p];i=p;}v[i]=node;}
  pop(){const v=this.values,first=v[0],last=v.pop();if(v.length){let i=0;while(i*2+1<v.length){let j=i*2+1;if(j+1<v.length&&(v[j+1].f<v[j].f||v[j+1].f===v[j].f&&v[j+1].order<v[j].order))j++;if(last.f<v[j].f||last.f===v[j].f&&last.order<v[j].order)break;v[i]=v[j];i=j;}v[i]=last;}return first;}
  get length(){return this.values.length;}
}
function compact(path){const out=[];for(const p of path){const b=out.at(-1),a=out.at(-2);if(a&&b&&p[2]===b[2]&&b[2]===a[2]&&distance(a,b)>0&&distance(b,p)>0){const cross=(b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]),dot=(b[0]-a[0])*(p[0]-b[0])+(b[1]-a[1])*(p[1]-b[1]);if(Math.abs(cross)<1e-8&&dot>0){out[out.length-1]=p;continue;}}out.push(p);}return out;}
function anchor(w,p){const rounded=p.map(n=>Math.round(n)||0);if(w.walkable(rounded))return rounded;const candidates=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const q=[rounded[0]+x,rounded[1]+y];if(w.walkable(q))candidates.push(q);}candidates.sort((a,b)=>distance(a,p)-distance(b,p));return candidates[0]??null;}
export function bodyRoute(w,a,target,physics,dynamic=false,local=false){
  const {canOccupy,sweptFree}=physics,start=a.pos.slice(0,2),goal=target.slice(0,2),initial=wrap(a.motion?.angle??0);
  if(distance(start,goal)<.06)return [];
  const shared=dynamic?{valid:new Map(),edges:new Map(),positions:new Map()}:(w.traffic.bodyNavigation??={valid:new Map(),edges:new Map(),positions:new Map()});
  const queen=w.traffic.colony.ants.find(b=>b.caste==='queen'),stamp=(queen&&queen.id!==a.id?queen.pos.join(',')+':'+queen.motion?.angle:'none')+':'+a.caste+':'+a.bodySize;
  const valid=(p,angle)=>{const id=stamp+':'+pointKey(p)+':'+angle;return shared.valid.has(id)?shared.valid.get(id):boundedSet(shared.valid,id,canOccupy(w,a,p,angle,null,!dynamic),15000);};
  const edge=(from,to,angle,oldAngle)=>{const id=stamp+':'+pointKey(from)+'>'+pointKey(to)+':'+oldAngle+'>'+angle;return shared.edges.has(id)?shared.edges.get(id):boundedSet(shared.edges,id,sweptFree(w,a,from,to,angle,oldAngle,false,!dynamic),40000);};
  // A free direct movement keeps arbitrary, natural headings. Rotate in place only when needed.
  const heading=Math.atan2(goal[1]-start[1],goal[0]-start[0]);
  if(valid(goal,heading)&&edge(start,start,heading,initial)&&edge(start,goal,heading,heading))return [[...start,heading,.02],[...goal,heading,.02]];
  const startCell=anchor(w,start),goalCell=anchor(w,goal);if(!startCell||!goalCell)return null;
  const coarse=w.path(startCell,goalCell);if(!coarse)return null;
  const raw=coarse.map(p=>p.slice(0,2));if(!raw.length||distance(raw.at(-1),goal)>.001)raw.push(goal);
  let prior=start,angle=initial,clear=true;
  for(const p of raw){const nextAngle=Math.atan2(p[1]-prior[1],p[0]-prior[0]);if(!valid(p,nextAngle)||!edge(prior,prior,nextAngle,angle)||!edge(prior,p,nextAngle,nextAngle)){clear=false;break;}prior=p;angle=nextAngle;}
  if(clear)return raw; // Ordinary open corridors retain the steered gait and rounded turns.
  // Repair short portions of a long terrain corridor independently. A distant food
  // pile must not exhaust the search budget before a returning forager reaches it.
  if(!local&&raw.length>6){
    const path=[];let cursor=0,position=start,orientation=initial,complete=true;
    while(cursor<raw.length){
      let index=Math.min(raw.length-1,cursor+4);
      while(index>=cursor&&!HEADINGS.some(angle=>valid(raw[index],angle)))index--;
      if(index<cursor){complete=false;break;}
      const actor={...a,pos:position,motion:{...a.motion,angle:orientation}},part=bodyRoute(w,actor,raw[index],physics,dynamic,true);
      if(!part){complete=false;break;}
      for(const p of part){orientation=p[2]??Math.atan2(p[1]-position[1],p[0]-position[0]);position=p.slice(0,2);path.push(p);}cursor=index+1;
    }
    if(complete)return compact(path);
  }
  const bounds={minX:Math.min(start[0],goal[0]),maxX:Math.max(start[0],goal[0]),minY:Math.min(start[1],goal[1]),maxY:Math.max(start[1],goal[1])};
  for(const p of coarse){bounds.minX=Math.min(bounds.minX,p[0]);bounds.maxX=Math.max(bounds.maxX,p[0]);bounds.minY=Math.min(bounds.minY,p[1]);bounds.maxY=Math.max(bounds.maxY,p[1]);}
  for(const k of ['minX','minY'])bounds[k]-=2;for(const k of ['maxX','maxY'])bounds[k]+=2;
  const angles=[...HEADINGS];let initialIndex=angles.findIndex(v=>Math.abs(wrap(v-initial))<.001);if(initialIndex<0){initialIndex=angles.length;angles.push(initial);}
  const candidates=p=>{const x=Math.round(p[0]*2)/2,y=Math.round(p[1]*2)/2;if(Math.abs(x-p[0])<.0001&&Math.abs(y-p[1])<.0001)return STEPS.map(([dx,dy])=>[x+dx,y+dy]);const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)out.push([x+dx*.5,y+dy*.5]);return out;};
  const heap=new Heap(),best=new Map(),closed=new Set();let order=0,expanded=0;
  const make=(p,ori,g,parent)=>({p,ori,g,parent,id:pointKey(p)+'@'+ori,f:g+distance(p,goal)*1.8,order:order++});
  const first=make(start,initialIndex,0,null);heap.push(first);best.set(first.id,0);
  const limit=dynamic?80:Math.min(800,Math.max(160,coarse.length*25));
  while(heap.length&&expanded++<limit){
    const node=heap.pop();if(closed.has(node.id)||node.g>best.get(node.id)+1e-8)continue;closed.add(node.id);const orientation=angles[node.ori];
    const goalHeading=Math.atan2(goal[1]-node.p[1],goal[0]-node.p[0]);
    if(distance(node.p,goal)<2.5&&valid(goal,goalHeading)&&edge(node.p,node.p,goalHeading,orientation)&&edge(node.p,goal,goalHeading,goalHeading)){
      const path=[[...goal,null,.04]];let n=node;while(n.parent){path.push([...n.p,null,.04]);n=n.parent;}path.reverse();return compact(path);
    }
    const offer=(p,ori,cost)=>{const g=node.g+cost,id=pointKey(p)+'@'+ori;if(g+1e-8>=(best.get(id)??Infinity))return;best.set(id,g);heap.push(make(p,ori,g,node));};

    const nearby=candidates(node.p).filter(p=>{const d=distance(p,node.p);return d>.035&&d<=1.12&&p[0]>=bounds.minX&&p[0]<=bounds.maxX&&p[1]>=bounds.minY&&p[1]<=bounds.maxY;}).sort((a,b)=>distance(a,node.p)-distance(b,node.p)||a[0]-b[0]||a[1]-b[1]);
    const directions=new Set();for(const p of nearby){const dx=p[0]-node.p[0],dy=p[1]-node.p[1],heading=Math.atan2(dy,dx),direction=(Math.round(heading/(Math.PI/4))+8)%8;if(directions.has(direction)||!valid(p,heading)||!edge(node.p,node.p,heading,orientation)||!edge(node.p,p,heading,heading))continue;directions.add(direction);let ori=angles.findIndex(v=>Math.abs(wrap(v-heading))<.001);if(ori<0){ori=angles.length;angles.push(heading);}offer(p,ori,distance(p,node.p)+Math.abs(wrap(heading-orientation))*.045);if(directions.size===8)break;}
  }
  return null;
}
