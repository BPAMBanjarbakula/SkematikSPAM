// OPS BAKULA: penghubung aplikasi operator (HP) ke Apps Script di Google Sheet logsheet.
// PIN, validasi, dan penulisan ke sheet dikerjakan di Apps Script (tools/apps-script/ops-logsheet.gs).
// URL Apps Script diisi di Netlify: Environment variables > OPS_SCRIPT_URL.
const AKSI = new Set(["masuk", "status_intake", "kirim_intake", "kirim_kejadian"]);

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
});

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, err: "POST saja" });
  const url = process.env.OPS_SCRIPT_URL;
  if (!url) return json(503, { ok: false, err: "Aplikasi belum tersambung ke Google Sheet (OPS_SCRIPT_URL belum diisi)." });
  const body = await req.text();
  if (body.length > 20000) return json(413, { ok: false, err: "Data terlalu besar" });
  let p;
  try { p = JSON.parse(body); } catch (_) { return json(400, { ok: false, err: "Data tidak terbaca" }); }
  if (!AKSI.has(p.aksi)) return json(400, { ok: false, err: "Aksi tidak dikenal" });
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow" });
    const t = await r.text();
    try { return json(200, JSON.parse(t)); }
    catch (_) { return json(502, { ok: false, err: "Balasan Google Sheet tidak dikenali (cek izin Aplikasi web: Siapa saja)." }); }
  } catch (e) {
    return json(502, { ok: false, err: "Gagal menghubungi Google Sheet: " + e.message });
  }
};

export const config = { path: "/api/ops" };
