/* Service worker: permite instalar o app no celular e abrir a tela mesmo com internet instável.
   Os dados sempre vêm da API (não ficam guardados aqui). Ao publicar uma versão nova, troque o número abaixo. */
const CACHE = 'associados-v1.6.0';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'modulos.js', 'cartao.js', 'recibo.js', 'qrcode.js', 'config.js', 'logo.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'privacidade.html', 'carteirinha.html', 'validar.html', 'publico.css'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // confere com o servidor a cada acesso (evita que o cache do navegador entregue a versão anterior por até 10 minutos)
  const req = e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
