// Byte-bounded LRU: revisiting terrain keeps its bitmap, including the previous LOD.
export class TerrainCache{
  constructor(maxBytes=24*1024*1024){this.maxBytes=maxBytes;this.bytes=0;this.items=new Map();}
  get(id){const e=this.items.get(id);if(e){this.items.delete(id);this.items.set(id,e);}return e;}
  put(id,e){this.delete(id);this.items.set(id,e);this.bytes+=e.bytes;while(this.bytes>this.maxBytes&&this.items.size>1)this.delete(this.items.keys().next().value);}
  delete(id){const e=this.items.get(id);if(e){this.bytes-=e.bytes;e.image?.close?.();this.items.delete(id);}}
  clear(){for(const id of this.items.keys())this.delete(id);}
  get size(){return this.items.size;}
}
