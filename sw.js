/*
 * Service worker de Mes heures.
 *
 * L'application est utilisable hors ligne : les fichiers nécessaires sont
 * conservés dans un cache versionné. Changer CACHE force le remplacement de
 * l'ancienne version après un déploiement.
 */
const CACHE='mes-heures-v58-contextual-help';
const ASSETS=['./','./index.html','./styles.css','./week-history.css','./core.js','./domain.js','./v17.js','./actual-day.js','./ui.js','./reprise.js','./projection-detail.js','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

/*
 * Cache d'abord pour un démarrage immédiat, puis mise à jour en arrière-plan.
 * En mode avion, la copie locale est donc suffisante pour ouvrir l'application.
 */
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  event.respondWith((async()=>{
    const cached=await caches.match(event.request);

    if(cached){
      event.waitUntil(
        fetch(event.request)
          .then(response=>{
            if(response && response.ok){
              return caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
            }
          })
          .catch(()=>{})
      );
      return cached;
    }

    try{
      const response=await fetch(event.request);
      if(response && response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(event.request,response.clone());
      }
      return response;
    }catch(error){
      if(event.request.mode==='navigate'){
        const fallback=await caches.match('./index.html');
        if(fallback) return fallback;
      }
      throw error;
    }
  })());
});
