// Service worker GeoSPAM Bakula (v4, ringan):
// - halaman: jaringan dulu, tapi kalau sinyal lambat (>3,5 dtk) langsung pakai cache
// - data statis & gambar: pakai cache, diperbarui diam-diam di belakang
const C = "geospam-v4";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const put = (req, r) => { if (r && r.ok) { const c = r.clone(); caches.open(C).then(x => x.put(req, c)); } return r; };
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/.netlify/") || u.pathname.endsWith(".pdf")) return;
  const isPage = req.mode === "navigate" || u.pathname === "/" || u.pathname.endsWith(".html");
  if (isPage) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => put(req, r));
      if (!hit) return net.catch(() => caches.match("/"));
      return Promise.race([net, new Promise(res => setTimeout(() => res(hit), 3500))]).catch(() => hit);
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => put(req, r)).catch(() => hit);
    return hit || net;
  }));
});
