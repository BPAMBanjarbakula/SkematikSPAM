// Konektor data logger flowmeter Onpoint (Odoo 13) untuk GeoSPAM Bakula.
// Kredensial TIDAK disimpan di kode: isi di Netlify > Site configuration > Environment variables:
//   ONPOINT_USER, ONPOINT_PASS  (disarankan akun read-only)
// Opsional sementara: ONPOINT_DISCOVER=1 untuk mode ?mode=discover (hanya daftar nama model/field).
const BASE = "https://bpambanjarbakula.onpoint.co.id", DB = "bpambanjarbakula";

async function rpc(path, params, cookie) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params }),
  });
  const j = await r.json();
  if (j.error) throw new Error((j.error.data && j.error.data.message) || j.error.message);
  return { result: j.result, setCookie: r.headers.get("set-cookie") };
}
async function login() {
  const { ONPOINT_USER: u, ONPOINT_PASS: p } = process.env;
  if (!u || !p) throw new Error("Kredensial Onpoint belum diisi di Netlify (ONPOINT_USER / ONPOINT_PASS).");
  const { result, setCookie } = await rpc("/web/session/authenticate", { db: DB, login: u, password: p });
  if (!result || !result.uid) throw new Error("Login Onpoint gagal.");
  return (setCookie || "").split(";")[0];
}
const kw = (cookie, model, method, args = [], kwargs = {}) =>
  rpc("/web/dataset/call_kw", { model, method, args, kwargs }, cookie).then((x) => x.result);

const json = (code, body, maxAge = 0) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${maxAge}` },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const mode = (event.queryStringParameters || {}).mode || "latest";
  try {
    const cookie = await login();
    if (mode === "discover") {
      if (process.env.ONPOINT_DISCOVER !== "1") return json(403, { error: "Mode discover nonaktif." });
      const act = await kw(cookie, "ir.actions.act_window", "read", [[173]], { fields: ["name", "res_model"] }).catch(() => null);
      const models = await kw(cookie, "ir.model", "search_read", [["|", "|", ["model", "ilike", "logger"], ["model", "ilike", "onpoint"], ["name", "ilike", "logger"]]], { fields: ["model", "name"], limit: 60 });
      const out = { action173: act, models, fields: {}, samples: {} };
      for (const m of models.slice(0, 12)) {
        try {
          const f = await kw(cookie, m.model, "fields_get", [], { attributes: ["string", "type", "relation"] });
          out.fields[m.model] = Object.fromEntries(Object.entries(f).filter(([k]) => !/^(message_|activity_|website_|__)/.test(k)));
          out.samples[m.model] = await kw(cookie, m.model, "search_read", [[]], { limit: 2, order: "id desc" });
        } catch (e) { out.fields[m.model] = String(e.message || e); }
      }
      return json(200, out);
    }
    // mode latest: diisi setelah struktur model diketahui (lihat mode discover)
    return json(501, { error: "Belum dikonfigurasi." });
  } catch (e) {
    return json(502, { error: String(e.message || e) });
  }
};
