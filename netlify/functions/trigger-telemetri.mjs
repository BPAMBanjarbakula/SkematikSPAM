// Pemicu cadangan: tiap jam menjalankan workflow "Telemetri flowmeter" di GitHub.
// Butuh env var Netlify: GH_TOKEN (fine-grained token, repo SkematikSPAM, izin Actions: Read and write).
export default async () => {
  const token = process.env.GH_TOKEN;
  if (!token) { console.log("GH_TOKEN belum diisi"); return new Response("GH_TOKEN belum diisi", { status: 200 }); }
  const r = await fetch("https://api.github.com/repos/BPAMBanjarbakula/SkematikSPAM/actions/workflows/telemetri-flowmeter.yml/dispatches", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "geospam-bakula", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  console.log("dispatch", r.status, await r.text());
  return new Response("ok " + r.status);
};
export const config = { schedule: "26 * * * *" };
