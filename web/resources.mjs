import {ITEM_UNIT,allocatePieces,consumePieces} from './item-space.mjs';
// Resource quantities are conserved when taken. Renewals are explicit ecological inputs.
export const RESOURCE_UNIT=ITEM_UNIT;
export const NUTRITION=Object.freeze({grass:{energy:.85,protein:.15},nectar:{energy:1,protein:0},prey:{energy:.15,protein:.85},mixed:{energy:.5,protein:.5}});
const row=()=>({created:0,harvested:0,evaporated:0,buried:0,decayed:0,drained:0,runoff:0});
export function initLedger(w){w.resourceLedger={food:row(),water:row()};}
export function restoreLedger(w,d){if(d.resourceLedger){w.resourceLedger=structuredClone(d.resourceLedger);return;}initLedger(w);for(const p of w.patches)w.resourceLedger[p.kind].created+=p.amount;}
export function addStock(w,p,amount){const n=Math.max(0,Math.min(amount,Math.max(0,(p.capacity??Infinity)-p.amount)));const placed=w.spaceReady?allocatePieces(w,p,n):n;p.amount+=placed;if(w.resourceLedger)w.resourceLedger[p.kind].created+=placed;return placed;}
export function removeStock(w,p,amount,why='harvested'){const n=Math.max(0,Math.min(amount,p.amount));consumePieces(w,p,n,p.activePieceID);p.amount=Math.max(0,p.amount-n);if(w.resourceLedger)w.resourceLedger[p.kind][why]=(w.resourceLedger[p.kind][why]??0)+n;return n;}
export function resourceBalance(w,kind){const l=w.resourceLedger[kind],available=w.patches.filter(p=>p.kind===kind).reduce((s,p)=>s+p.amount,0);return {available,...l,error:l.created-available-l.harvested-l.evaporated-l.buried-(l.decayed??0)-(l.drained??0)-(l.runoff??0)};}
export function resourceTiles(w,p){
  if(!(p.amount>1e-7))return [];
  if(p.pieces)return p.pieces.filter(i=>i.amount>1e-7).map(i=>({x:i.pos[0],y:i.pos[1],amount:i.amount,id:i.id}));
  const n=Math.ceil((p.amount-1e-7)/RESOURCE_UNIT),tiles=[];
  if(p.kind==='water'){
    const left=p.left??p.cell[0]-1,right=p.right??p.cell[0]+1,columns=[];
    for(let x=left;x<=right;x++)if(w.surface(x)===w.surface(p.cell[0]))for(let sub=0;sub<3;sub++)columns.push(x+(sub-1)/3);
    columns.sort((a,b)=>Math.abs(a-p.cell[0])-Math.abs(b-p.cell[0])||a-b);if(!columns.length)return [];
    for(let i=0;i<n;i++)tiles.push({x:columns[i%columns.length],y:w.surface(p.cell[0])-.5-(Math.floor(i/columns.length)+.5)/3,amount:Math.min(RESOURCE_UNIT,p.amount-i*RESOURCE_UNIT)});
  }else{
    for(let i=0;i<n;i++)tiles.push({x:p.cell[0]+(i%5-2)*.23,y:w.surface(p.cell[0])-.65-Math.floor(i/5)*.23,amount:Math.min(RESOURCE_UNIT,p.amount-i*RESOURCE_UNIT)});
  }return tiles;
}
