/* Service worker: makes the app work offline.
   - Our own files: try the network first (so weekly updates arrive), fall back to the saved copy.
   - Google Fonts: saved copy first.
   Bump VERSION only if this file's logic changes; new card sets need no change here. */
const VERSION = "v1";
const CACHE = "italian-cards-" + VERSION;
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "data/index.json"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    try {
      const idx = await (await fetch("data/index.json", { cache: "no-cache" })).json();
      await cache.addAll(idx.sets.map(s => "data/" + s.file));
    } catch (e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); cache.put(req, res.clone()); return res; }
      catch (e) { return new Response("", { status: 504 }); }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await Promise.race([fetch(req), timeout(4000)]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(req, { ignoreSearch: true })
        || (req.mode === "navigate" ? await cache.match("index.html") : null);
      return hit || new Response("Offline and not saved yet.", { status: 503 });
    }
  })());
});
