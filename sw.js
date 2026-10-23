// Offline service worker for «متن‌یاب».
// App shell precached at install. The OCR engine (wasm), Persian/English models and PDF.js are cached
// cache-first on first use (the app warms them up right after the first visit), so everything works offline afterwards.
const VERSION = 'matn-yab-v1.0.0';
const ENGINE = 'matn-yab-engine-v1'; // big, rarely-changing files survive app updates
const KEEP = new Set([VERSION, ENGINE]);
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/ocr.js', './js/pdf.js', './js/store.js',
  './lib/normalize.js', './lib/pdftext.js', './lib/imageproc.js', './lib/docx.js',
  './fonts/Vazirmatn-Variable.woff2', './vendor/tesseract/tesseract.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];
const ENGINE_RE = /\/(vendor|tessdata)\//;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(VERSION)).addAll(ASSETS);
    // best effort: fetch the engine now too, so an "Add to Home Screen" user is offline-ready even before the first OCR
    const ec = await caches.open(ENGINE);
    const core = ['./vendor/tesseract/worker.min.js', './vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs', './tessdata/fas.traineddata', './tessdata/eng.traineddata', './tessdata/fas_fast.traineddata'];
    await Promise.all(core.map(async (u) => { if (!(await ec.match(u))) await ec.add(u).catch(() => {}); }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('matn-yab') && !KEEP.has(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  const cacheName = ENGINE_RE.test(url.pathname) ? ENGINE : VERSION;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true }); if (hit) return hit;
    try { const res = await fetch(req); if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(cacheName).then((c) => c.put(req, copy)); } return res; }
    catch { if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error(); return Response.error(); }
  })());
});
