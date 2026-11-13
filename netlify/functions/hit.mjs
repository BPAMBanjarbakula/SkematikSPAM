// Penghitung kunjungan anonim GeoSPAM Bakula (tanpa cookie, tanpa IP, tanpa identitas)
// v2: kunjungan bot/perayap, uji otomatis, salinan deploy Netlify dan akses luar negeri
//     dicatat terpisah (bot, luar) sehingga angka utama hanya pengunjung nyata dari Indonesia.
import { getStore } from "@netlify/blobs";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const EV = new Set(["view","nrc","xlsx","tour","prof","share","tv","rm","kti","lite","dark","3d","turun"]);
const SITUS = ["geospambakula","geospambanjarbakula","skematik"];
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|screenshot|puppeteer|playwright|phantom|facebookexternalhit|whatsapp\/|telegrambot|python|curl|wget|node-fetch|axios/i;
export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });
  let b = {}; try { b = await req.json(); } catch (e) {}
  const ev = EV.has(b.e) ? b.e : null; if (!ev) return new Response("x", { status: 400, headers: CORS });
  const now = new Date(Date.now() + 8 * 3600e3), day = now.toISOString().slice(0, 10), hr = now.getUTCHours();
  const store = getStore({ name: "statistik", consistency: "strong" });
  const k = "d/" + day, d = (await store.get(k, { type: "json" })) || { v: 0, u: 0, h: Array(24).fill(0), dev: {}, ref: {}, kota: {}, ev: {}, situs: {} };
  d.ver = 2;
  const inc = (o, key) => { if (key) o[key] = (o[key] || 0) + 1; };
  const ua = req.headers.get("user-agent") || "";
  const geo = context.geo || {}, negara = geo.country && geo.country.code, kota = geo.city ? String(geo.city).slice(0, 40) : "Tidak diketahui";
  // 1) bot, uji otomatis, atau dibuka dari salinan deploy (bukan 3 alamat resmi) → hanya dihitung sebagai "bot"
  if (b.wd || BOT.test(ua) || !SITUS.includes(b.s)) {
    if (ev === "view") d.bot = (d.bot || 0) + 1;
  // 2) akses dari luar Indonesia → dicatat terpisah
  } else if (negara && negara !== "ID") {
    if (ev === "view") { d.luar = (d.luar || 0) + 1; d.kotaLuar = d.kotaLuar || {}; inc(d.kotaLuar, kota + " (" + negara + ")"); }
  // 3) pengunjung nyata
  } else if (ev === "view") {
    d.v++; d.h[hr]++; if (b.n) d.u++;
    inc(d.dev, b.dev === "hp" ? "HP" : b.dev === "tab" ? "Tablet" : "Laptop/PC");
    inc(d.ref, ["wa","google","telegram","langsung","lain","aplikasi"].includes(b.ref) ? b.ref : "lain");
    inc(d.kota, kota);
    inc(d.situs, b.s);
    if (b.p === 0 || b.p === 1 || b.p === 2) { d.perf = d.perf || {}; inc(d.perf, ["Penuh","Hemat","Ringan"][b.p]); }
  } else inc(d.ev, ev);
  await store.setJSON(k, d);
  return new Response("ok", { headers: CORS });
};
export const config = { path: "/api/hit" };
