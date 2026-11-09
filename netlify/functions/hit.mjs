// Penghitung kunjungan anonim GeoSPAM Bakula (tanpa cookie, tanpa IP, tanpa identitas)
import { getStore } from "@netlify/blobs";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const EV = new Set(["view","nrc","xlsx","tour","prof","share","tv","rm","kti","lite","dark"]);
export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });
  let b = {}; try { b = await req.json(); } catch (e) {}
  const ev = EV.has(b.e) ? b.e : null; if (!ev) return new Response("x", { status: 400, headers: CORS });
  const now = new Date(Date.now() + 8 * 3600e3), day = now.toISOString().slice(0, 10), hr = now.getUTCHours();
  const store = getStore({ name: "statistik", consistency: "strong" });
  const k = "d/" + day, d = (await store.get(k, { type: "json" })) || { v: 0, u: 0, h: Array(24).fill(0), dev: {}, ref: {}, kota: {}, ev: {}, situs: {} };
  const inc = (o, key) => { if (key) o[key] = (o[key] || 0) + 1; };
  if (ev === "view") {
    d.v++; d.h[hr]++; if (b.n) d.u++;
    inc(d.dev, b.dev === "hp" ? "HP" : b.dev === "tab" ? "Tablet" : "Laptop/PC");
    inc(d.ref, ["wa","google","telegram","langsung","lain","aplikasi"].includes(b.ref) ? b.ref : "lain");
    const c = context.geo && context.geo.city; inc(d.kota, c ? String(c).slice(0, 40) : "Tidak diketahui");
    inc(d.situs, ["geospambakula","geospambanjarbakula","skematik"].includes(b.s) ? b.s : "lain");
  } else inc(d.ev, ev);
  await store.setJSON(k, d);
  return new Response("ok", { headers: CORS });
};
export const config = { path: "/api/hit" };
