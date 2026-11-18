export function paintGrain(ctx,x,y,size,id,remaining=1){
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
