// Funziona anche senza rete: tiene in memoria i file dell'app.
const VERSIONE = 'repub-v49';
const FILE = ['./', 'index.html', 'stile.css', 'dati.js', 'dati2.js', 'motore.js', 'app.js', 'manifest.json', 'icone/icona-192.png', 'firebase-config.js', 'jszip.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // le librerie di Firebase: dalla copia salvata, così l'app parte anche senza rete
  if (url.host === 'www.gstatic.com') { e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { const k = r.clone(); caches.open(VERSIONE).then(x => x.put(e.request, k)); return r; }))); return; }
  if (url.origin !== location.origin) return;
  // prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(VERSIONE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
