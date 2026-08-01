/* Teaching Board offline cache — caches the board page on first visit,
   serves it from cache afterwards (works with no internet). */
var CACHE='board-v1';
self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll([location.pathname.replace('sw.js',''), location.pathname.replace('sw.js','')+'teaching_board.html']).catch(function(){});
  }));
});
self.addEventListener('activate',function(e){ e.waitUntil(self.clients.claim()) });
self.addEventListener('fetch',function(e){
  var u=new URL(e.request.url);
  if(u.origin!==location.origin) return;         /* Jitsi, fonts, APIs: network */
  e.respondWith(
    caches.match(e.request).then(function(hit){
      var net=fetch(e.request).then(function(res){
        if(res.ok) caches.open(CACHE).then(function(c){ c.put(e.request,res.clone()) });
        return res;
      }).catch(function(){ return hit });
      return hit||net;
    })
  );
});
