const CACHE='little-colony-__BUILD_ID__';
const ROOT=new URL('./',self.location.href);
const ASSETS=['./','index.html','app.mjs','sim.mjs','biology.mjs','materials.mjs','ecology.mjs','resources.mjs','fire-ant.mjs','geometry.mjs','architecture.mjs','signals.mjs','clock.mjs','persistence.mjs','render.mjs','style.css','manifest.webmanifest','icons/ant.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable.png','icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('little-colony-') && key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET' || url.origin!==ROOT.origin || !url.pathname.startsWith(ROOT.pathname))return;
  if(event.request.mode==='navigate'){
    // Serve one coherent installed build, including during offline navigation.
    // The browser checks the versioned worker for updates independently.
    event.respondWith(caches.open(CACHE).then(async cache=>
      (await cache.match(new URL('index.html',ROOT).href)) || fetch(event.request)));
  }else event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request);if(cached)return cached;
    const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;
  }));
});
