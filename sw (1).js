/* GODofPLAYER: офлайн-оболочка. Страница берётся из сети (так обновления приходят сразу),
   а при отсутствии сети открывается из кеша. Аудио, запросы к облаку и чужие API не трогаем. */
var V = 'godofplayer-v1';
var SHELL = ['index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
var CDN = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) {
      return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
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
    e.respondWith(
      fetch(nav).then(function (r) {
        if (r && r.ok) { var cp = r.clone(); caches.open(V).then(function (c) { c.put('index.html', cp); }); }
        return r;
      }).catch(function () {
        return caches.match('index.html');
      })
    );
    return;
  }
  if (url.origin === self.location.origin || CDN.test(url.hostname)) {
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
