// Ringkasan statistik kunjungan (angka agregat saja)
import { getStore } from "@netlify/blobs";
export default async (req) => {
  const n = Math.min(Number(new URL(req.url).searchParams.get("hari")) || 30, 366);
  const store = getStore({ name: "statistik", consistency: "strong" });
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(Date.now() + 8 * 3600e3 - i * 864e5).toISOString().slice(0, 10);
    const d = await store.get("d/" + day, { type: "json" });
    out.push({ tgl: day, ...(d || { v: 0, u: 0 }) });
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
};
export const config = { path: "/api/stat" };
