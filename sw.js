// Service worker GeoSPAM Bakula (v4, ringan):
// - halaman: jaringan dulu, tapi kalau sinyal lambat (>3,5 dtk) langsung pakai cache
// - data statis & gambar: pakai cache, diperbarui diam-diam di belakang
const C = "geospam-v9", T = "geospam-tiles-v1", TMAX = 900;
let puts = 0;
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== T).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const put = (req, r) => { if (r && r.ok) { const c = r.clone(); caches.open(C).then(x => x.put(req, c)); } return r; };
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  // ubin peta Esri: simpan di HP agar kunjungan berikutnya hemat kuota & cepat
  if (req.method === "GET" && u.hostname === "server.arcgisonline.com" && u.pathname.includes("/tile/")) {
    e.respondWith(caches.open(T).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok && r.type !== "opaque") { c.put(req, r.clone()); if (++puts % 60 === 0) c.keys().then(k => { if (k.length > TMAX) k.slice(0, k.length - TMAX).forEach(x => c.delete(x)); }); }
      return r; }))));
    return;
  }
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
