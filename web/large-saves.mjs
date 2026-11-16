import {Colony} from './sim.mjs';
import {SaveStore,SAVE_KEY} from './persistence.mjs';
const MARKER=SAVE_KEY+'.database',BATCH=96;
export class ColonyStore{
  constructor(storage,database=globalThis.indexedDB){this.storage=storage;this.small=new SaveStore(storage);this.database=database;this.opening=null;this.queue=Promise.resolve();this.blocked=false;this.serial=0;}
  open(){if(!this.database)return Promise.reject(Error('Large-colony storage is unavailable in this browser.'));return this.opening??=new Promise((resolve,reject)=>{const r=this.database.open('little-colony-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('colonies');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async read(keys){const db=await this.open();return new Promise((resolve,reject)=>{const t=db.transaction('colonies','readonly'),s=t.objectStore('colonies'),requests=keys.map(k=>s.get(k));t.oncomplete=()=>resolve(requests.map(r=>r.result));t.onerror=()=>reject(t.error);});}
  async put(key,value){const db=await this.open();return new Promise((resolve,reject)=>{const t=db.transaction('colonies','readwrite');t.objectStore('colonies').put(value,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??Error('Save was interrupted.'));});}
  async restore(head){if(!head)return null;if(head.version===4)return Colony.fromJSON(head.colony);if(head.version!==5)return null;
    const [meta]=await this.read([head.id+':meta']);if(!meta)throw Error('Missing colony metadata');const ants=[],brood=[];
    for(const [kind,out,count] of [['ants',ants,head.ants],['brood',brood,head.brood]]){const keys=Array.from({length:Math.ceil(count/BATCH)},(_,i)=>head.id+':'+kind+':'+i);for(const group of await this.read(keys)){if(!Array.isArray(group))throw Error('Missing colony group');out.push(...group);}}
    if(ants.length!==head.ants||brood.length!==head.brood)throw Error('Incomplete colony');return Colony.fromJSON({...meta,ants,brood});
  }
  async load(){if(this.storage.getItem(MARKER)!=='1')return this.small.load();try{const heads=await this.read(['primary','backup']);for(const [i,h] of heads.entries())try{const colony=await this.restore(h);if(colony){this.validHead=h;return {colony,recovered:i===1};}}catch{}
    throw Error('Your large-colony save could not be read. Automatic saving is paused.');}catch(error){this.blocked=true;throw error;}
  }
  save(colony,explicit=false){const result=this.queue.then(()=>this.write(colony,explicit));this.queue=result.catch(()=>{});return result;}
  async write(colony,explicit){
    if(this.blocked&&!explicit)return false;
    if(colony.ants.length<600&&colony.brood.length<1000){const ok=this.small.save(colony,explicit);if(ok){this.storage.removeItem(MARKER);this.blocked=false;}return ok;}
    // The caller holds biology at a complete tick; each small transaction lets the camera draw.
    const id='g'+Date.now()+'-'+(++this.serial),{ants,brood,...meta}=colony.toJSON(),heads=await this.read(['primary']),previous=this.validHead??heads[0];
    await this.put(id+':meta',meta);
    for(const [kind,items] of [['ants',ants],['brood',brood]])for(let offset=0;offset<items.length;offset+=BATCH){await this.put(id+':'+kind+':'+Math.floor(offset/BATCH),items.slice(offset,offset+BATCH));await new Promise(resolve=>setTimeout(resolve,0));}
    const db=await this.open();await new Promise((resolve,reject)=>{const t=db.transaction('colonies','readwrite'),s=t.objectStore('colonies');if(previous)s.put(previous,'backup');s.put({version:5,id,ants:ants.length,brood:brood.length,savedAt:Date.now()},'primary');t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
    this.storage.setItem(MARKER,'1');this.validHead={version:5,id,ants:ants.length,brood:brood.length};this.blocked=false;
    // Retain two complete generations. Partial earlier attempts are disposable.
    const keep=[id,previous?.id].filter(Boolean);await new Promise((resolve,reject)=>{const t=db.transaction('colonies','readwrite'),s=t.objectStore('colonies'),cursor=s.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(typeof c.key==='string'&&c.key.startsWith('g')&&!keep.some(prefix=>c.key.startsWith(prefix+':')))c.delete();c.continue();};t.oncomplete=resolve;t.onerror=()=>reject(t.error);});return true;
  }
}
