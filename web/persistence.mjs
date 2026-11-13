import {Colony} from './sim.mjs';
export const SAVE_KEY='little-colony.web.v1';
const BACKUP_KEY=SAVE_KEY+'.backup';
export function decodeSave(raw) {
  const envelope=JSON.parse(raw);
  if(![1,2].includes(envelope.version)) throw Error('Unsupported save version');
  return Colony.fromJSON(envelope.colony);
}
export class SaveStore {
  constructor(storage) { this.storage=storage; this.blocked=false; }
  load() {
    const primary=this.storage.getItem(SAVE_KEY), backup=this.storage.getItem(BACKUP_KEY);
    if(!primary && !backup) return null;
    try { return {colony:decodeSave(primary),recovered:false}; } catch {}
    try { return {colony:decodeSave(backup),recovered:true}; } catch {}
    this.blocked=true; throw Error('Your existing save could not be read. Autosave is paused until you start a new colony or save explicitly.');
  }
  save(colony,explicit=false) {
    if(this.blocked && !explicit) return false;
    const raw=JSON.stringify({version:2,savedAt:Date.now(),colony});
    const prior=this.storage.getItem(SAVE_KEY);
    if(prior) { try { decodeSave(prior); this.storage.setItem(BACKUP_KEY,prior); } catch(error) { if(error.name==='QuotaExceededError') throw error; } }
    this.storage.setItem(SAVE_KEY,raw); this.blocked=false; return true;
  }
}
