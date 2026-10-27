/* GODofPLAYER: офлайн-оболочка. Страница берётся из сети (так обновления приходят сразу),
   а при отсутствии сети открывается из кеша. Аудио, запросы к облаку и чужие API не трогаем. */
var V = 'godofplayer-v3';
var WAIT = 4000; /* сеть молчит дольше — открываем из кеша (плохой интернет не должен вешать плеер) */
function netFirst(req, key) {
  return new Promise(function (ok) {
    var done = false;
    var t = setTimeout(function () { if (done) return; caches.match(key || req).then(function (h) { if (h && !done) { done = true; ok(h); } }); }, WAIT);
    fetch(req, { cache: 'no-cache' }).then(function (r) {
      if (r && r.ok) { var cp = r.clone(); caches.open(V).then(function (c) { c.put(key || req, cp); }); }
      clearTimeout(t); if (!done) { done = true; ok(r); }
    }).catch(function () { clearTimeout(t); caches.match(key || req).then(function (h) { if (!done) { done = true; ok(h || Response.error()); } }); });
  });
}
var SHELL = ['index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
var EXTRA = ['https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js', 'https://fonts.googleapis.com/css2?family=Exo+2:wght@500;700;800&family=Rubik:wght@400;500;600&family=Montserrat:wght@500;700;800&family=Nunito:wght@500;700;800&family=Comfortaa:wght@500;700&family=Russo+One&family=Jura:wght@500;700&display=swap'];
var CDN = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) {
      return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }).concat(EXTRA.map(function (u) { return c.add(new Request(u, { mode: 'no-cors' })).catch(function () {}); })));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('godofplayer-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  var url = new URL(req.url);
  if (req.mode === 'navigate') {
    /* адрес папки (…/) некоторые хостинги не отдают, поэтому открываем index.html напрямую */
    var nav = /\/$/.test(url.pathname) ? new Request(new URL('index.html', url).href) : req;
    e.respondWith(netFirst(nav, 'index.html'));
    return;
  }
  if (url.origin === self.location.origin || CDN.test(url.hostname)) {
    /* манифест и страницы всегда сначала из сети, чтобы обновления не залёживались в кеше */
    if (url.origin === self.location.origin && /(manifest\.webmanifest|\.html)$/.test(url.pathname)) {
      e.respondWith(netFirst(req));
      return;
    }
    e.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (r) {
          if (r && (r.ok || r.type === 'opaque')) { var cp = r.clone(); caches.open(V).then(function (c) { c.put(req, cp); }); }
          return r;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
  }
});
