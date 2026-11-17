// Rekap kualitas air BPAM Banjarbakula dari Google Sheet publik Lab BPAM (satu file per bulan).
// Setiap file berisi lembar Air Baku (BBLKM), Air Curah Bulanan (Sucofindo), Air Curah Mingguan,
// dan Air Curah Harian (Lab BPAM). CSV diambil di sisi server (ekspor Google tidak mengizinkan CORS)
// lalu diteruskan ke WebGIS; diurai di peramban. Cache 10 menit.
// Bulan baru: tambahkan baris {b:"YYYY-MM", id:"<ID sheet>"} di FILES (sheet harus "siapa saja yang punya link dapat melihat").
const FILES = [
  { b: "2026-06", id: "1rXplhdV1Ltvoiaja1MLBJc3d5ONfdWf_U2JUIEZGQuA" },
  { b: "2026-07", id: "1gXbL3ge2Y4dffEVHQsV7fyfXnsfu3NYZ9f4P-qw3UbE" },
  { b: "2026-08", id: "1iCh__1vtx1SnhFWAf7dH6w490beyi3nRgoXgVVktZmc" },
  { b: "2026-09", id: "1s8GZRvmzvLLZObLUIRXMRlBMdD3E6MR_ZvWGmJKcvbc" },
];
const GID = { baku: "815383184", curah: "230532481", mingguan: "1285107319", harian: "982205590" };
const H = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600" };
export default async () => {
  const out = { t: Date.now(), files: [] };
  await Promise.all(FILES.map(async (f) => {
    const o = { b: f.b, id: f.id, csv: {}, err: {} };
    await Promise.all(Object.entries(GID).map(async ([k, g]) => {
      try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${f.id}/export?format=csv&gid=${g}`, { redirect: "follow" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        o.csv[k] = await r.text();
      } catch (e) { o.err[k] = String(e.message || e); }
    }));
    out.files.push(o);
  }));
  out.files.sort((a, b) => (a.b < b.b ? -1 : 1));
  return new Response(JSON.stringify(out), { headers: H });
};
