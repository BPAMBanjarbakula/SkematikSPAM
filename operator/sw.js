// Service worker OPS Bakula: aplikasi tetap terbuka walau sinyal hilang.
// File aplikasi: jaringan dulu (agar pembaruan langsung masuk), cadangan dari cache.
// Panggilan /api/ tidak pernah disimpan; kiriman saat offline disimpan di antrean aplikasi.
const C = "ops-bakula-v1";
const INTI = ["./", "index.html", "app.css?v=1", "app.js?v=1", "manifest.webmanifest", "icon-192.png", "icon-512.png", "logo-bpam-light.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(C).then(c => c.addAll(INTI)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("ops-bakula-") && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith("/operator/")) return;
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const k = r.clone(); caches.open(C).then(c => c.put(req, k)); }
    return r;
  }).catch(() => caches.match(req).then(hit => hit || caches.match("./"))));
});
