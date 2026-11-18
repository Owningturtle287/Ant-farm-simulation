function paintGrain(ctx,x,y,size,id,remaining=1){
  const width=Math.max(.8,size)*(.65+.35*Math.sqrt(remaining)),height=Math.max(.65,width*.42);
  ctx.save();ctx.translate(x,y);ctx.rotate((((id*7)%13)-6)*.13);
  ctx.fillStyle='#9c6b33';ctx.beginPath();
  ctx.moveTo(-width*.57,0);ctx.quadraticCurveTo(-width*.24,-height,width*.52,-height*.16);
  ctx.quadraticCurveTo(width*.29,height*.88,-width*.57,0);ctx.fill();
  ctx.fillStyle='#e5b55c';ctx.beginPath();
  ctx.moveTo(-width*.44,-height*.04);ctx.quadraticCurveTo(-width*.16,-height*.75,width*.43,-height*.2);
  ctx.quadraticCurveTo(width*.10,height*.5,-width*.44,-height*.04);ctx.fill();
  ctx.strokeStyle='#fff0ac';ctx.lineWidth=Math.max(.35,height*.24);ctx.beginPath();
  ctx.moveTo(-width*.23,-height*.25);ctx.quadraticCurveTo(width*.02,-height*.41,width*.24,-height*.23);
  ctx.stroke();ctx.restore();
}

const GRAIN_ANGLES=13,GRAIN_TILE=32,GRAIN_WIDTH=20;
export function buildGrainAtlas(){
  const canvas=document.createElement('canvas');
  canvas.width=GRAIN_TILE*GRAIN_ANGLES;canvas.height=GRAIN_TILE;
  const context=canvas.getContext('2d');
  for(let id=0;id<GRAIN_ANGLES;id++)paintGrain(context,(id+.5)*GRAIN_TILE,GRAIN_TILE/2,GRAIN_WIDTH,id);
  return canvas;
}
export function drawGrain(ctx,atlas,x,y,size,id,remaining=1){
  const span=Math.max(.8,size)*(.65+.35*Math.sqrt(remaining))*GRAIN_TILE/GRAIN_WIDTH;
  ctx.drawImage(atlas,(id%GRAIN_ANGLES)*GRAIN_TILE,0,GRAIN_TILE,GRAIN_TILE,x-span/2,y-span/2,span,span);
}

const STEMS=[
  {root:-.33,lean:-.30,height:.83},
  {root:-.18,lean:-.17,height:1.12},
  {root:-.03,lean:.03,height:1.25},
  {root:.14,lean:.20,height:1.02},
  {root:.29,lean:.33,height:.80},
];
const SEEDS_PER_HEAD=3;

export function drawGrass(ctx,atlas,x,y,unit,patch,clock,wind=0){
  const alive=patch.stage!=='dead';
  const growth=alive?Math.max(.16,patch.growth??1):.32;
  const ripe=patch.stage==='seed';
  const sway=Math.sin(clock*1.15+patch.id*.79)*(.07+wind*.07)+Math.sin(clock*2.7+patch.id)*wind*.03;
  const stems=STEMS.map(({root,lean,height},i)=>{
    const bend=alive?lean+sway*(.8+i*.08):lean+.17;
    const start=x+unit*root;
    return t=>[start+unit*bend*t*t*growth,y-unit*height*growth*t];
  });
  for(const [i,at] of stems.entries()){
    const root=at(0),middle=at(.49),tip=at(1);
    ctx.lineWidth=Math.max(.65,unit*.061*growth);
    ctx.strokeStyle=alive?(i%2?'#648142':'#405f38'):'#8f7952';
    ctx.beginPath();ctx.moveTo(...root);ctx.quadraticCurveTo(root[0],middle[1],...tip);ctx.stroke();
    for(const [t,side] of [[.21,i%2?1:-1],[.42,i%2?-1:1]]){
      const [bx,by]=at(t),width=unit*growth,height=width*(alive?.38:.17);
      const reach=width*side*(t<.3?.35:.26);
      ctx.fillStyle=alive?(t<.3?'#4f7440':'#78964d'):'#9b8559';
      ctx.beginPath();ctx.moveTo(bx,by);
      ctx.quadraticCurveTo(bx+reach*.08,by-height*.9,bx+reach,by-height);
      ctx.quadraticCurveTo(bx+reach*.42,by-height*.51,bx,by+width*.035);ctx.fill();
    }
  }
  if(!ripe)return;
  // The stable kernel ID keeps surviving grains on their own stalk as ants collect them.
  for(const piece of patch.pieces??[]){
    if(piece.amount<=1e-9)continue;
    const slot=piece.id%(stems.length*SEEDS_PER_HEAD),row=Math.floor(slot/stems.length);
    const [sx,sy]=stems[slot%stems.length](.73+row*.115);
    const side=(slot+row)%2?1:-1,distance=unit*(.07-row*.009)*side;
    ctx.strokeStyle='#96a459';ctx.lineWidth=Math.max(.45,unit*.029);
    ctx.beginPath();ctx.moveTo(sx,sy+unit*.035);ctx.lineTo(sx+distance,sy-unit*.038);ctx.stroke();
    drawGrain(ctx,atlas,sx+distance,sy-unit*.037,unit*(.20-row*.018),side>0?8:6,piece.amount/2);
  }
}

export function paintWater(ctx,x,y,width,depth,phase){
  const left=x-width/2,right=x+width/2,top=y-depth/2,bottom=y+depth/2;
  const lift=Math.sin(phase)*depth*.2;
  ctx.beginPath();ctx.moveTo(left,y);
  ctx.quadraticCurveTo(left,top,x,top+lift);
  ctx.quadraticCurveTo(right,top,right,y);
  ctx.quadraticCurveTo(right,bottom,x,bottom);
  ctx.quadraticCurveTo(left,bottom,left,y);ctx.closePath();
  ctx.fillStyle='#3884a4c9';ctx.fill();
  ctx.strokeStyle='#8ed1dabb';ctx.lineWidth=Math.max(.55,depth*.17);ctx.beginPath();
  ctx.moveTo(left+width*.13,top+depth*.38);
  ctx.quadraticCurveTo(x,top+lift,right-width*.12,top+depth*.36);ctx.stroke();
  if(width>=4){
    ctx.strokeStyle='#c9f3ecb0';ctx.lineWidth=Math.max(.45,depth*.12);ctx.beginPath();
    ctx.moveTo(x-width*.21,y+depth*.04);ctx.quadraticCurveTo(x,y+lift*.4,x+width*.15,y+depth*.03);ctx.stroke();
  }
}
