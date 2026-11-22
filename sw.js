const CACHE='scanly-v2.18';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./i18n.js','./book_sources.js','./assets/piece_canopee.jpg','./assets/piece_loft.jpg','./assets/piece_salon.jpg','./assets/piece_futur.jpg','./assets/piece_magie.jpg','./assets/piece_bnf.jpg','./assets/symbole.png','./assets/symbole_inverse.png','./assets/icon-64.png'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));});
