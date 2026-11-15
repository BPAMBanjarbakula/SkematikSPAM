// Ambil nomor baru Register PBJ: diteruskan ke Apps Script yang terpasang di Google Sheet register.
// Nomor urut dihitung & dikunci di Apps Script (LockService), PIN juga diperiksa di sana.
// URL Apps Script: isi konstanta di bawah, atau env REGISTER_SCRIPT_URL di Netlify.
const SCRIPT_URL = "";

export default async (req) => {
  if (req.method !== "POST") return Response.json({ ok: false, err: "POST saja" }, { status: 405 });
  const url = process.env.REGISTER_SCRIPT_URL || SCRIPT_URL;
  if (!url) return Response.json({ ok: false, err: "Fitur tambah nomor belum diaktifkan (skrip Google Sheet belum dipasang)." }, { status: 503 });
  const body = await req.text();
  if (body.length > 8000) return Response.json({ ok: false, err: "Data terlalu besar" }, { status: 413 });
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow" });
    const t = await r.text();
    try { return Response.json(JSON.parse(t), { headers: { "Cache-Control": "no-store" } }); }
    catch (_) { return Response.json({ ok: false, err: "Balasan skrip tidak dikenali (cek izin Aplikasi web: Siapa saja)" }, { status: 502 }); }
  } catch (e) {
    return Response.json({ ok: false, err: "Gagal menghubungi Google Sheet: " + e.message }, { status: 502 });
  }
};

export const config = { path: "/api/register-add" };
