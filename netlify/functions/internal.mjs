// Data internal GeoSPAM Bakula (dilindungi password).
// - Password diatur di Netlify: Project configuration > Environment variables > INTERNAL_PASSWORD.
//   Tanpa variabel itu, semua akses internal ditolak (aman secara bawaan).
// - Data TIDAK disimpan di repo (repo publik), tetapi di Netlify Blobs store "internal-data",
//   diunggah lewat menu "Kelola data" setelah masuk.
// - Sesi: cookie HttpOnly berisi waktu kedaluwarsa + tanda tangan HMAC (berlaku 12 jam).
//   Mengganti password otomatis mengeluarkan semua sesi lama.
import { getStore } from "@netlify/blobs";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE = "gs_int";
const SESI_JAM = 12;
const MAKS_UKURAN = 5 * 1024 * 1024;      // 5 MB per layer
const MAKS_GAGAL = 10;                     // percobaan password salah per jam per alamat
const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

const json = (status, obj, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE, ...extra } });
const pw = () => process.env.INTERNAL_PASSWORD || "";
const sign = exp => createHmac("sha256", "geospam-internal:" + pw()).update(String(exp)).digest("base64url");
const sha = s => createHash("sha256").update(s).digest();
const samaRahasia = (a, b) => timingSafeEqual(sha(a), sha(b));

function sesiValid(req) {
  const c = (req.headers.get("cookie") || "").split(/;\s*/).find(x => x.startsWith(COOKIE + "="));
  if (!c) return false;
  const [exp, sig] = c.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return samaRahasia(sig, sign(exp));
}
const cookie = (val, maxAge) => `${COOKIE}=${val}; Path=/api/internal; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const idAman = s => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(s || "");

export default async (req, context) => {
  if (!pw()) return json(503, { error: "Akses internal belum diaktifkan (INTERNAL_PASSWORD belum diatur)." });
  const url = new URL(req.url);
  const rute = url.pathname.replace(/^\/api\/internal\/?/, "");
  const data = getStore({ name: "internal-data", consistency: "strong" });

  // ---- masuk
  if (rute === "login" && req.method === "POST") {
    const rl = getStore({ name: "internal-rl", consistency: "strong" });
    const ipKey = "ip/" + createHash("sha256").update((context.ip || "?") + new Date().toISOString().slice(0, 13)).digest("hex").slice(0, 24);
    const gagal = Number(await rl.get(ipKey)) || 0;
    if (gagal >= MAKS_GAGAL) return json(429, { error: "Terlalu banyak percobaan. Coba lagi dalam 1 jam." });
    let b = {}; try { b = await req.json(); } catch (e) {}
    if (typeof b.password !== "string" || !samaRahasia(b.password, pw())) {
      await rl.set(ipKey, String(gagal + 1));
      await new Promise(r => setTimeout(r, 800));
      return json(401, { error: "Password salah." });
    }
    const exp = Date.now() + SESI_JAM * 3600e3;
    return json(200, { masuk: true, sampai: exp }, { "Set-Cookie": cookie(`${exp}.${sign(exp)}`, SESI_JAM * 3600) });
  }
  if (rute === "logout") return json(200, { masuk: false }, { "Set-Cookie": cookie("", 0) });
  if (rute === "status") return json(200, { masuk: sesiValid(req) });

  // ---- semua rute di bawah ini wajib sudah masuk
  if (!sesiValid(req)) return json(401, { error: "Silakan masuk terlebih dahulu." });

  if (rute === "list" && req.method === "GET") {
    const { blobs } = await data.list({ prefix: "layer/" });
    const out = [];
    for (const b of blobs) {
      const m = await data.getMetadata(b.key);
      out.push({ id: b.key.slice(6), ...(m && m.metadata) });
    }
    out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return json(200, { layers: out });
  }
  if (rute === "layer" && req.method === "GET") {
    const id = url.searchParams.get("id");
    if (!idAman(id)) return json(400, { error: "id tidak sah" });
    const g = await data.get("layer/" + id, { type: "text" });
    if (g === null) return json(404, { error: "Layer tidak ditemukan" });
    return new Response(g, { headers: { "Content-Type": "application/geo+json; charset=utf-8", ...NO_STORE } });
  }
  if (rute === "upload" && req.method === "POST") {
    const id = url.searchParams.get("id"), nama = (url.searchParams.get("nama") || id || "").slice(0, 80);
    if (!idAman(id)) return json(400, { error: "Kode layer hanya boleh huruf kecil, angka, - dan _" });
    const teks = await req.text();
    if (teks.length > MAKS_UKURAN) return json(413, { error: "File terlalu besar (maks 5 MB)" });
    let g; try { g = JSON.parse(teks); } catch (e) { return json(400, { error: "Bukan file GeoJSON yang sah" }); }
    if (!g || g.type !== "FeatureCollection" || !Array.isArray(g.features)) return json(400, { error: "File harus GeoJSON FeatureCollection" });
    const meta = { nama, jumlah: g.features.length, sumber: (g.metadata && g.metadata.sumber) || "", diperbarui: new Date().toISOString() };
    await data.set("layer/" + id, teks, { metadata: meta });
    return json(200, { ok: true, id, ...meta });
  }
  if (rute === "hapus" && req.method === "POST") {
    const id = url.searchParams.get("id");
    if (!idAman(id)) return json(400, { error: "id tidak sah" });
    await data.delete("layer/" + id);
    return json(200, { ok: true });
  }
  return json(404, { error: "Rute tidak dikenal" });
};

export const config = { path: ["/api/internal", "/api/internal/*"] };
