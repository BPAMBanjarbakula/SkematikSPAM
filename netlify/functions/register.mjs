// Data Register Nomor Dokumen PBJ BPAM Banjarbakula untuk aplikasi /register (hanya baca).
// Mengambil CSV tiap tab dari Google Sheet register, di-cache 60 detik di CDN Netlify.
const SHEET = "1B-pgWiwKd4OezpocJk3O063vaT7XblBA8ms8iX-5Xqg";
const GIDS = new Set(["0", "669272993", "1146793795", "1148303820", "1148303950", "1148304100", "1148303899", "555000111"]);

export default async (req) => {
  const gid = new URL(req.url).searchParams.get("gid") || "0";
  if (!GIDS.has(gid)) return new Response("tab tidak dikenal", { status: 400 });
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET}/export?format=csv&gid=${gid}`, { redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const csv = await r.text();
    if (csv.trimStart().startsWith("<")) throw new Error("Sheet tidak bisa dibaca (cek pengaturan berbagi)");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return new Response("Gagal mengambil register: " + e.message, { status: 502 });
  }
};

export const config = { path: "/api/register" };
