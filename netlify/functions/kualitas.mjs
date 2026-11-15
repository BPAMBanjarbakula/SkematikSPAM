// Rekap kualitas air BPAM Banjarbakula dari Google Sheet publik (Lab BPAM, BBLKM, Sucofindo).
// Mengambil CSV lembar rekap di sisi server (ekspor Google tidak mengizinkan CORS) lalu
// meneruskannya ke WebGIS apa adanya; diurai di peramban. Cache 10 menit.
const ID = "1rXplhdV1Ltvoiaja1MLBJc3d5ONfdWf_U2JUIEZGQuA";
const GID = { baku: "815383184", curah: "230532481", mingguan: "1285107319", harian: "982205590" };
const H = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600" };
export default async () => {
  const out = { t: Date.now(), csv: {}, err: {} };
  await Promise.all(Object.entries(GID).map(async ([k, g]) => {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=${g}`, { redirect: "follow" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      out.csv[k] = await r.text();
    } catch (e) { out.err[k] = String(e.message || e); }
  }));
  return new Response(JSON.stringify(out), { headers: H });
};
