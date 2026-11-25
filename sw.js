// Offline support, and PDFs shared from other apps (Android share target).
//
// Bump VERSION with every change to the app files. The browser then installs
// this worker again with the new files, and the page reloads into them
// (see the controllerchange handler in js/app.js).
const VERSION = 'v5';
const APP_CACHE = `lektor-app-${VERSION}`;
const SHARE_CACHE = 'lektor-share';
const APP_FILES = [
  './',
  'index.html',
  'styles.css',
  'js/app.js',
  'js/i18n.js',
  'js/pdfread.js',
  'js/layout.js',
  'js/speech.js',
  'js/navigate.js',
  'js/player.js',
  'js/library.js',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      // 'reload' skips the HTTP cache, which could still hold the old files.
      .then((cache) => cache.addAll(APP_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// A shared PDF arrives as a POST; it waits in a cache until the page takes it.
async function receiveShare(request) {
  const form = await request.formData();
  const file = form.getAll('pdf').find((f) => f && typeof f !== 'string');
  if (file) {
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(
      'shared.pdf',
      new Response(file, { headers: { 'content-type': 'application/pdf', 'x-name': encodeURIComponent(file.name || 'dokument.pdf') } }),
    );
    return Response.redirect('./?shared=1', 303);
  }
  // A shared link instead of a file.
  const text = [form.get('url'), form.get('text'), form.get('title')].filter(Boolean).join(' ');
  const url = text.match(/https?:\/\/\S+/)?.[0];
  return Response.redirect(url ? `./?url=${encodeURIComponent(url)}` : './', 303);
}

// Pages opened with parameters are all the same page, stored as './'.
async function staleWhileRevalidate(request, key) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(key, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(key, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method === 'POST' && url.pathname.endsWith('/share')) {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== 'GET') return;
  const key = request.mode === 'navigate' ? new URL('./', self.registration.scope).href : request;
  event.respondWith(staleWhileRevalidate(request, key));
});
