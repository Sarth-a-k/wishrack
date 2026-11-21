// Wishrack service worker: keeps the app shell for offline opening, and receives the Android share sheet.
const SHELL = "wr-shell-v9";
const FILES = ["/", "/styles.css", "/app.js", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/fonts/bricolage-grotesque-latin.woff2", "/fonts/figtree-latin.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("wr-shell-") && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Share target: stash the shared screenshots and text, then open the app to read them.
  if (url.pathname === "/share" && e.request.method === "POST") {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll("shots").filter((f) => f && typeof f === "object" && f.size);
        const text = [form.get("title"), form.get("text"), form.get("url")].filter(Boolean).join(" ");
        const cache = await caches.open("wr-share");
        await Promise.all(files.map((f, i) => cache.put("/shared/" + i, new Response(f, { headers: { "content-type": f.type || "image/png" } }))));
        await cache.put("/shared/meta", new Response(JSON.stringify({ files: files.length, text }), { headers: { "content-type": "application/json" } }));
      } catch { /* fall through to the app */ }
      return Response.redirect("/?shared=1", 303);
    })());
    return;
  }

  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  // App shell: network first so updates land, cache when offline.
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      if (r.ok && FILES.includes(url.pathname)) (await caches.open(SHELL)).put(e.request, r.clone());
      return r;
    } catch {
      return (await caches.match(e.request, { ignoreSearch: url.pathname === "/" })) || Response.error();
    }
  })());
});
