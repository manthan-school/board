/* ==================================================================
   Teaching Board — offline cache  v3
   Goal: a NEW upload appears quickly, but the board NEVER stops
   working when the internet is slow, patchy or absent.

   • The board page: try the network for 3 seconds only.
       – answer arrives  → use it AND save it for offline use
       – slow / no line  → serve the saved copy at once
   • Everything else: saved copy first, refreshed quietly.
   • The saved copy is only ever replaced by a good download,
     so a bad connection can never leave a panel with nothing.
   ================================================================== */
var CACHE='board-v3';
var PAGE_TIMEOUT=3000;                 /* how long a slow line may hold us */

function base(){ return location.pathname.replace('sw.js','') }
function boardUrl(){ return base()+'teaching_board.html' }

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll([base(), boardUrl()])['catch'](function(){});
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k!==CACHE) return caches['delete'](k);
      }));
    }).then(function(){ return self.clients.claim() })
  );
});

self.addEventListener('message', function(e){
  if(e.data==='skipWaiting') self.skipWaiting();
  if(e.data==='clearCache')
    caches.keys().then(function(ks){ ks.forEach(function(k){ caches['delete'](k) }) });
});

function isPage(req){
  return req.mode==='navigate' || req.destination==='document' ||
         /\.html?($|\?)/i.test(req.url);
}
function saveCopy(req,res){
  if(!res || !res.ok) return;
  var copy=res.clone();
  caches.open(CACHE).then(function(c){ c.put(req,copy) })['catch'](function(){});
}
/* the saved board, whatever address it was saved under */
function cachedPage(req){
  return caches.match(req).then(function(hit){
    return hit || caches.match(boardUrl()).then(function(h2){
      return h2 || caches.match(base());
    });
  });
}

self.addEventListener('fetch', function(e){
  var u;
  try{ u=new URL(e.request.url) }catch(err){ return }
  if(u.origin!==location.origin) return;        /* Jitsi, sheets, fonts: straight to network */
  if(e.request.method!=='GET') return;

  if(isPage(e.request)){
    e.respondWith(new Promise(function(resolve){
      var settled=false;
      function done(r){ if(!settled && r){ settled=true; resolve(r) } }

      /* if the line is slow, don't make the teacher wait */
      var timer=setTimeout(function(){
        cachedPage(e.request).then(function(hit){ if(hit) done(hit) });
      }, PAGE_TIMEOUT);

      fetch(e.request, {cache:'no-store'}).then(function(res){
        clearTimeout(timer);
        if(res && res.ok){ saveCopy(e.request,res); done(res) }
        else cachedPage(e.request).then(function(hit){ done(hit||res) });
      })['catch'](function(){
        clearTimeout(timer);
        cachedPage(e.request).then(function(hit){
          done(hit || new Response(
            '<meta charset="utf-8"><body style="background:#0a0e14;color:#e5e7eb;'+
            'font-family:sans-serif;text-align:center;padding:40px">'+
            '<h2>બોર્ડ ખૂલી શક્યું નહીં</h2>'+
            '<p>એક વાર ઇન્ટરનેટ સાથે ખોલો — પછી ઇન્ટરનેટ વગર પણ ચાલશે.</p></body>',
            {headers:{'Content-Type':'text/html; charset=utf-8'}}));
        });
      });
    }));
    return;
  }

  /* other files: saved copy first (instant), refresh quietly */
  e.respondWith(
    caches.match(e.request).then(function(hit){
      var net=fetch(e.request).then(function(res){
        saveCopy(e.request,res);
        return res;
      })['catch'](function(){ return hit });
      return hit || net;
    })
  );
});
