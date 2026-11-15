/* Register PBJ BPAM Banjarbakula — aplikasi lihat & ambil nomor (PC + HP) */
const SHEET = "https://docs.google.com/spreadsheets/d/1B-pgWiwKd4OezpocJk3O063vaT7XblBA8ms8iX-5Xqg/edit";
const TABS = [
  ["Bon", 0, "Bon Permintaan & Pesanan", "#f59e0b"],
  ["Berita Acara", 669272993, "BA Serah Terima / Pemeriksaan", "#22d3ee"],
  ["E-Katalog", 1146793795, "Surat Pesanan & Kontrak E-Katalog", "#38bdf8"],
  ["PL", 1148303820, "Pengadaan Langsung & ST PPK", "#60a5fa"],
  ["Penunjukan", 1148303950, "Penunjukan Langsung", "#818cf8"],
  ["FHO", 1148304100, "Serah Terima Akhir (FHO)", "#a78bfa"],
  ["Surat PP", 1148303899, "Surat Pejabat Pengadaan", "#c084fc"],
  ["< 50 Jt", 555000111, "Berkas Kuitansi < Rp50 Jt", "#e879f9"],
];
const J50 = { ND: "Nota Dinas", SPPBJ: "Surat Penunjukan Penyedia Barang/Jasa", SP: "Surat Pesanan", SPK: "Surat Perintah Kerja",
  BAST: "Berita Acara Serah Terima Pekerjaan", BAPHP: "Berita Acara Pemeriksaan Hasil Pekerjaan", BAP: "Berita Acara Pembayaran", BASTT: "Berita Acara Serah Terima Barang Titipan" };
// isian per dokumen (boleh beda tiap nomor) + templat ambil sekaligus
const ITEM = {
  0: { col: "JENIS DOKUMEN", opts: ["BON PERMINTAAN", "BON PESANAN"], tpl: [["Bon Permintaan + Pesanan", ["BON PERMINTAAN", "BON PESANAN"]]] },
  669272993: { col: "KEGIATAN", label: "Uraian berita acara", tpl: [["BA Pemeriksaan + Serah Terima", ["Berita Acara Pemeriksaan Barang Belanja ", "Berita Acara Serah Terima Barang Belanja "]]] },
  1146793795: { part: "J", tpl: [["SP + SPJ", ["SP", "SPJ"]], ["Paket lengkap (7)", ["SP", "SPJ", "BAPB", "BAST", "BAPP", "BAP", "BAPAHP"]]] },
  1148303820: { col: "SURAT", label: "Jenis surat", dyn: true },
  1148303950: { col: "SURAT", label: "Jenis surat", dyn: true },
  1148304100: {},
  1148303899: { col: "SURAT", label: "Jenis surat" },
  555000111: { part: "J", auto: { col: "JENIS DOKUMEN", map: J50 }, first: ["PAKET", "PENYEDIA", "NILAI"],
    tpl: [["Paket lengkap (7)", ["ND", "SPPBJ", "SP", "SPK", "BAST", "BAPHP", "BAP"]]] },
};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cache = {};
let cur = +(lsGet("tab") ?? 0), rows = [], shown = 80, F = null, flash = new Set();
if (!TABS.some(t => t[1] === cur)) cur = 0;

function lsGet(k) { try { return localStorage.getItem("reg_" + k) } catch (e) { return null } }
function lsSet(k, v) { try { localStorage.setItem("reg_" + k, v) } catch (e) {} }
function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), 1800) }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])) }
const uniq = a => [...new Set(a.filter(Boolean))];
const tabOf = g => TABS.find(t => t[1] === g);
async function copy(t) { try { await navigator.clipboard.writeText(t); toast("Disalin: " + t) } catch (_) { toast(t) } }

/* ---------- data ---------- */
function csv(t) { const R = []; let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c == '"') { if (t[i + 1] == '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c == '"') q = true; else if (c == ",") { r.push(f); f = "" } else if (c == "\n") { r.push(f); R.push(r); r = []; f = "" } else if (c != "\r") f += c }
  if (f || r.length) { r.push(f); R.push(r) } return R }
function parse(t) { const R = csv(t); let hdr = null, yr = "", out = []; out.hdr = null;
  for (const r0 of R) { const r = r0.map(x => x.trim()), a = r[0] || "", filled = r.filter(Boolean).length;
    if (!filled) continue;
    const ym = a.match(/TAHUN ANGGARAN\s+(\d{4})/i); if (ym && filled <= 2) { yr = ym[1]; continue }
    if (/^NOMOR/i.test(a) && filled >= 3) { hdr = r.map(h => h.toUpperCase()); continue }
    if (!hdr || !a.includes("/") || a.length > 80) continue;
    out.hdr = hdr; const o = { no: a, yr, f: {} }; hdr.forEach((h, i) => { if (i && r[i] && h) o.f[h] = r[i] });
    const y = a.match(/\/(20\d\d)\s*$/); if (y) o.yr = y[1]; else if (!o.yr) o.yr = "";
    out.push(o) }
  return out }
const pick = (f, ...ks) => { for (const k of ks) for (const h in f) if (h.includes(k)) return f[h]; return "" };
async function fetchTab(gid, fresh) {
  const r = await fetch("/api/register?gid=" + gid + (fresh ? "&t=" + Date.now() : "")); if (!r.ok) throw new Error(await r.text());
  const t = await r.text(); const p = parse(t); cache[gid] = p; lsSet("d" + gid, t); if (p.hdr) lsSet("h" + gid, JSON.stringify(p.hdr)); return p }
function fromLocal(gid) { if (cache[gid]) return cache[gid]; const c = lsGet("d" + gid); if (c) { const p = parse(c); cache[gid] = p; return p } return null }
async function load(fresh, quiet) { const gid = cur; spin(1);
  const loc = fromLocal(gid); if (loc) { rows = loc; years(); render() } else $("#m").innerHTML = '<div class="sk"></div>'.repeat(6);
  try { const p = await fetchTab(gid, fresh); if (gid !== cur) return; rows = p; years(); render(); counts(); if (fresh && !quiet) toast("Data diperbarui") }
  catch (e) { if (gid === cur && !rows.length) $("#m").innerHTML = `<div class="err">Gagal memuat data.<br><small>${esc(e.message)}</small></div>`; else if (!quiet) toast("Offline – menampilkan data tersimpan") }
  finally { spin(0) } }
function spin(on) { $$("#rf,#rf2").forEach(b => b.classList.toggle("spin", !!on)) }
async function prefetch() { for (const t of TABS) if (t[1] !== cur && !cache[t[1]]) { try { await fetchTab(t[1]) } catch (_) {} } counts() }

/* ---------- tampilan ---------- */
const seqOf = o => { const m = o.no.match(/(\d{3,})/g); return m ? +m[m.length > 1 && /^900/.test(o.no) ? 1 : 0] : 0 };
function lastOf(L) { const ly = L.reduce((a, o) => o.yr > a ? o.yr : a, ""); return L.filter(o => o.yr === ly).reduce((a, o) => !a || seqOf(o) >= seqOf(a) ? o : a, null) }
function nextFor(o) { const c = CFG[cur], p = partsFrom(o.no); const Y = String(new Date().getFullYear());
  return c.num(Object.fromEntries(c.parts.map(d => [d.k, p[d.k] || "…"])), nextSeq(rows.map(r => r.no), c, p, Y), Y) }
function partsFrom(no) { const c = CFG[cur], p = {};
  c.parts.forEach(d => { if (d.opts) p[d.k] = d.opts.find(o => no.includes("/" + o + "/") || no.includes("/" + o + "-")) || d.opts[0];
    else { const m = no.match(d.kode); p[d.k] = m ? m[1] : "" } });
  if (p.T && /\/ST\/PPK/.test(no)) p.T = "ST PPK"; return p }
function jenisOf(f) { return pick(f, "JENIS", "SURAT", "METODE") }
function card(o) { const f = o.f, tgl = pick(f, "TANGGAL"), keg = pick(f, "PAKET", "KEGIATAN"), jn = jenisOf(f), nil = pick(f, "NILAI", "ANGGARAN"),
  py = pick(f, "PENYEDIA"), ct = pick(f, "CATATAN"), rel = pick(f, "SPK DAN"), mati = /TIDAK DIPAKAI|BATAL/i.test(ct);
  return `<div class="it${flash.has(o.no) ? " new" : ""}"${mati ? ' style="opacity:.62"' : ""}>
  <div class="no"><code>${esc(o.no)}</code><button class="cp only-m" data-c="${esc(o.no)}">Salin</button></div>
  <div class="c-tg">${esc(tgl)}</div>
  <div class="k">${esc(keg)}${py ? ` <span style="color:var(--mut)">· ${esc(py)}</span>` : ""}</div>
  <div class="c-jn">${esc(jn !== keg ? jn : "")}</div>
  <div class="c-nl">${nil ? esc(nil) : ""}</div>
  <div class="acts only-d"><button class="cp" data-c="${esc(o.no)}" title="Salin nomor">Salin</button><button class="dup" data-dup="${esc(o.no)}" title="Ambil nomor baru dengan isian seperti ini">＋ Serupa</button></div>
  <div class="tags">${tgl ? `<span class="tg d">📅 ${esc(tgl)}</span>` : ""}${jn && jn !== keg ? `<span class="tg">${esc(jn)}</span>` : ""}${nil ? `<span class="tg v">Rp ${esc(nil)}</span>` : ""}
   <button class="dup only-m" data-dup="${esc(o.no)}" style="margin-left:auto">＋ Serupa</button></div>
  ${rel ? `<div class="nt r">${esc(rel)}</div>` : ""}${ct ? `<div class="nt">⚑ ${esc(ct)}</div>` : ""}</div>` }
function render() { const q = $("#q").value.trim().toLowerCase(), y = $("#yr").value, t = tabOf(cur);
  let L = rows.filter(o => (!y || o.yr === y) && (!q || (o.no + " " + Object.values(o.f).join(" ") + " " + o.yr).toLowerCase().includes(q))).slice().reverse();
  const last = lastOf(rows), m = $("#m"); let h = "";
  if (last && !q) { const tg = pick(last.f, "TANGGAL"), kg = pick(last.f, "PAKET", "KEGIATAN"), nx = nextFor(last);
    h += `<div class="hero"><div class="hx"><div class="l">NOMOR TERAKHIR · ${esc(t[2].toUpperCase())}</div>
    <div class="n">${esc(last.no)}</div><div class="d">${esc([tg, kg].filter(Boolean).join(" · "))}</div></div>
    <div class="nx">Nomor berikutnya<b>${esc(nx)}</b><button class="btn" id="takeNext">＋ Ambil nomor ini</button></div></div>` }
  h += `<div class="meta"><span>${L.length} entri${q || y ? " ditemukan" : ""}</span><span>terbaru di atas</span></div>`;
  h += `<div class="thead only-d"><span>NOMOR</span><span>TANGGAL</span><span>KEGIATAN / PAKET</span><span>JENIS</span><span style="text-align:right">NILAI (Rp)</span><span></span></div>`;
  if (!L.length) h += `<div class="empty">Tidak ada entri yang cocok.</div>`;
  let py = null; L.slice(0, shown).forEach(o => { if (!y && o.yr !== py) { py = o.yr; h += `<div class="yr">TAHUN ${esc(o.yr || "-")}</div>` } h += card(o) });
  if (L.length > shown) h += `<button class="more" id="more">Tampilkan ${Math.min(80, L.length - shown)} lagi</button>`;
  h += `<div class="foot">Data langsung dari Google Sheet register · <a href="${SHEET}#gid=${cur}" target="_blank" rel="noopener">Buka sheet ↗</a></div>`;
  m.innerHTML = h; $("#open").href = SHEET + "#gid=" + cur }
function years() { const ys = uniq(rows.map(o => o.yr)).sort().reverse(), s = $("#yr"), v = s.value;
  s.innerHTML = `<option value="">Semua tahun</option>` + ys.map(y => `<option${y === v ? " selected" : ""}>${y}</option>`).join("") }
function tabsUI() { $("#tabs").innerHTML = TABS.map((t, i) => `<button class="tab${t[1] === cur ? " on" : ""}" data-g="${t[1]}" style="--c:${t[3]}" title="${esc(t[2])} (${i + 1})"><span class="dt"></span>${esc(t[0])}<span class="ct" data-ct="${t[1]}"></span></button>`).join("") }
function counts() { TABS.forEach(t => { const c = cache[t[1]], el = $(`[data-ct="${t[1]}"]`); if (el && c) el.textContent = c.length }) }
function goTab(g) { if (g === cur) return; cur = g; lsSet("tab", cur); shown = 80; $("#q").value = ""; $("#yr").value = "";
  $$(".tab").forEach(x => x.classList.toggle("on", +x.dataset.g === g)); $(".tab.on")?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  rows = []; load(!cache[g], true) }

/* ---------- form ambil nomor ---------- */
const BULAN_ = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const fmtTgl = d => { const [y, m, dd] = d.split("-"); return +dd + " " + BULAN_[+m - 1] + " " + y };
const parseTgl = s => { const m = String(s || "").match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/); if (!m) return ""; const b = BULAN_.findIndex(x => x.toLowerCase() === m[2].toLowerCase()); return b < 0 ? "" : `${m[3]}-${String(b + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` };
const today = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 10) };
const nice = H => (H.charAt(0) + H.slice(1).toLowerCase()).replace("(rp)", "(Rp)");
function colVals(h) { return uniq(rows.map(o => o.f[h]).reverse()).slice(0, 40) }
function dynTpl(c) { // urutan dokumen dari paket-paket terakhir (PL/PNT)
  const d = c.parts.find(x => x.kode), ic = ITEM[cur].col, g = new Map(); if (!d) return [];
  rows.forEach(o => { const m = o.no.match(d.kode); if (!m || /TIDAK DIPAKAI|BATAL/i.test(pick(o.f, "CATATAN"))) return; const v = o.f[ic]; if (!v) return;
    if (!g.has(m[1])) g.set(m[1], []); g.get(m[1]).push(v); g.set(m[1], g.get(m[1])) });
  return [...g.entries()].filter(([, v]) => v.length > 1).slice(-3).reverse().map(([k, v]) => ["Urutan seperti " + k + " (" + v.length + ")", v]) }
function openForm(pre) { const c = CFG[cur]; if (!c) return;
  const hdr = rows.hdr || JSON.parse(lsGet("h" + cur) || "null"); if (!hdr) { toast("Tunggu data selesai dimuat"); return }
  const it = ITEM[cur] || {}, src = pre || lastOf(rows) || { no: "", f: {} };
  F = { c, hdr, it, p: partsFrom(src.no), items: [] };
  if (!pre) c.parts.forEach(d => { if (d.opts && d.k !== it.part) F.p[d.k] = F.p[d.k] || d.opts[0] });
  const first = it.part ? (pre ? F.p[it.part] : "") : (it.col ? (pre ? pre.f[it.col] || "" : "") : "");
  F.items = [{ v: first || (it.opts ? it.opts[0] : it.part ? (c.parts.find(d => d.k === it.part).opts[0]) : "") }];
  const pin = lsGet("pin"), tpls = (it.tpl || []).concat(it.dyn ? dynTpl(c) : []);
  let h = `<div class="grab"></div><h2>Ambil Nomor Baru</h2><div class="sub">${esc(tabOf(cur)[2])} · nomor urut otomatis & terkunci</div>`;
  // bagian nomor yang boleh dipilih/diisi
  const shared = c.parts.filter(d => d.k !== it.part);
  if (shared.length) { h += `<div class="sec">FORMAT NOMOR</div>`;
    shared.forEach(d => { h += `<label class="fl" data-part="${d.k}"><span>${esc(d.label)}</span>`;
      if (d.opts) h += `<div class="seg">${d.opts.map(o => `<button type="button" data-k="${d.k}" data-v="${esc(o)}" class="${F.p[d.k] === o ? "on" : ""}">${esc(o)}</button>`).join("")}</div>`;
      else { const sug = uniq(rows.slice().reverse().map(o => (o.no.match(d.kode) || [])[1]));
        h += `<input data-pk="${d.k}" value="${esc(F.p[d.k] || "")}" list="dl_${d.k}" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="mis. ${esc(sug[0] || "KODE-PAKET")}"><datalist id="dl_${d.k}">${sug.slice(0, 40).map(v => `<option value="${esc(v)}">`).join("")}</datalist>` }
      h += `</label>` }) }
  // daftar dokumen (satu atau beberapa nomor)
  h += `<div class="sec">NOMOR YANG DIAMBIL</div>`;
  if (tpls.length) h += `<div class="tpl">${tpls.map((t, i) => `<button type="button" data-tpl="${i}">⚡ ${esc(t[0])}</button>`).join("")}</div>`;
  h += `<div class="dl" id="dl"></div><button type="button" class="addrow" id="addrow">＋ Tambah nomor berikutnya</button>
  <div class="lockinfo">🔒 Nomor urut ditetapkan saat disimpan, jadi tidak bisa dobel walau diambil bersamaan.</div>`;
  // isian bersama
  h += `<div class="sec">KETERANGAN</div><div class="grid2">`;
  hdr.forEach((H, i) => { if (!i || !H || H === it.col || (it.auto && H === it.auto.col)) return; const id = "f" + i, pv = pre ? pre.f[H] || "" : "";
    if (H.includes("TANGGAL")) h += `<label class="fl"><span>Tanggal</span><input type="date" id="${id}" data-h="${esc(H)}" data-tgl="1" value="${today()}"></label>`;
    else if (H.includes("CATATAN")) h += `<label class="fl full"><span>Catatan (opsional)</span><textarea id="${id}" data-h="${esc(H)}" rows="2"></textarea></label>`;
    else if (/ANGGARAN|NILAI/.test(H)) h += `<label class="fl"><span>${esc(nice(H))} (opsional)</span><input id="${id}" data-h="${esc(H)}" data-rp="1" inputmode="numeric" placeholder="0" value="${esc(pv)}"></label>`;
    else { const v = colVals(H), wide = /KEGIATAN|PAKET|SPK DAN/.test(H);
      h += `<label class="fl${wide ? " full" : ""}"><span>${esc(nice(H))}</span><input id="${id}" data-h="${esc(H)}" list="dl${i}" autocomplete="off" value="${esc(pv)}"><datalist id="dl${i}">${v.map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>` } });
  h += `</div>`;
  h += pin ? "" : `<label class="fl"><span>PIN register</span><input id="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="6 digit"></label>`;
  h += `<div class="ferr" id="ferr"></div><button class="go" id="go">Simpan & Ambil Nomor</button><button class="cancel" id="cx">Batal <span class="only-d"><kbd>Esc</kbd></span></button>`;
  $("#sh").innerHTML = h; F.tpls = tpls; drawItems(); metode(); preview();
  $("#ov").classList.add("on"); $("#sh").classList.add("on"); $("#sh").scrollTop = 0;
  setTimeout(() => { const f = $$("#sh input:not([type=date]),#sh textarea").find(e => !e.value && e.offsetParent); if (f && matchMedia("(min-width:980px)").matches) f.focus() }, 260) }
function drawItems() { const it = F.it, c = F.c; let h = "";
  const opts = it.part ? c.parts.find(d => d.k === it.part).opts : it.opts;
  F.items.forEach((x, i) => { h += `<div class="row"><div class="nn" data-nn="${i}"></div>`;
    if (opts) h += `<select data-iv="${i}">${opts.map(o => `<option${o === x.v ? " selected" : ""} value="${esc(o)}">${esc(it.auto ? o + " · " + it.auto.map[o] : o)}</option>`).join("")}</select>`;
    else if (it.col) h += `<input data-iv="${i}" value="${esc(x.v)}" list="dli" placeholder="${esc(it.label || nice(it.col))}" autocomplete="off">`;
    else h += `<span style="flex:1;font-size:13px;color:var(--mut)">Nomor ke-${i + 1}</span>`;
    h += F.items.length > 1 ? `<button type="button" class="x" data-rm="${i}" title="Hapus">✕</button>` : "";
    h += `</div>` });
  if (it.col && !opts) h += `<datalist id="dli">${colVals(it.col).map(v => `<option value="${esc(v)}">`).join("")}</datalist>`;
  $("#dl").innerHTML = h; preview() }
function tahun() { const t = $("#sh [data-tgl]"); return t && t.value ? t.value.slice(0, 4) : String(new Date().getFullYear()) }
function metode() { if (!F.p.M) return; const m = $$("#sh [data-h]").find(e => e.dataset.h.includes("METODE")); if (m && !m.dataset.manual) m.value = F.p.M === "PNT" ? "Penunjukan Langsung" : "Pengadaan Langsung" }
function partsFor(i) { const p = Object.assign({}, F.p); if (F.it.part) p[F.it.part] = F.items[i].v; return p }
function preview() { if (!F) return; const c = F.c, Y = tahun(), n0 = +nextSeq(rows.map(o => o.no), c, partsFor(0), Y);
  c.parts.forEach(d => { const el = $(`#sh [data-part="${d.k}"]`); if (el) el.style.display = d.hide && d.hide(F.p) ? "none" : "" });
  F.items.forEach((x, i) => { const p = partsFor(i), ph = {}; c.parts.forEach(d => ph[d.k] = p[d.k] || "…");
    const full = c.num(ph, "\u0001" + pad3(n0 + i) + "\u0002", Y), el = $(`[data-nn="${i}"]`);
    if (el) el.innerHTML = `<small>🔒 ${i ? "BERIKUTNYA" : "NOMOR"}</small>` + esc(full).replace("\u0001", "<i>").replace("\u0002", "</i>") }) }
function pad3(x) { x = String(x); while (x.length < 3) x = "0" + x; return x }
function closeForm() { $("#ov").classList.remove("on"); $("#sh").classList.remove("on"); F = null }
async function simpan() { const err = $("#ferr"), go = $("#go"); err.textContent = ""; const it = F.it;
  for (let i = 0; i < F.items.length; i++) { const m = cekParts(F.c, partsFor(i)); if (m) { err.textContent = m; return } if (it.col && !F.items[i].v.trim()) { err.textContent = (it.label || nice(it.col)) + " nomor ke-" + (i + 1) + " belum diisi"; return } }
  const shared = {}; $$("#sh [data-h]").forEach(el => { let v = el.value.trim(); if (el.dataset.tgl && v) v = fmtTgl(v); if (v) shared[el.dataset.h] = v });
  const kg = Object.keys(shared).length ? null : 1; const keg = F.hdr.find(H => /PAKET|KEGIATAN/.test(H) && H !== it.col);
  if (keg && !shared[keg]) { err.textContent = nice(keg) + " wajib diisi"; $(`#sh [data-h="${keg}"]`)?.focus(); return }
  const pin = lsGet("pin") || ($("#pin") && $("#pin").value.trim()); if (!pin) { err.textContent = "Masukkan PIN register"; $("#pin")?.focus(); return }
  const items = F.items.map((x, i) => { const f = Object.assign({}, shared);
    if (i && it.first) Object.keys(f).forEach(k => { if (it.first.some(w => k.includes(w))) delete f[k] });
    if (it.col) f[it.col] = x.v.trim(); if (it.auto) f[it.auto.col] = it.auto.map[x.v] || x.v; return { parts: partsFor(i), fields: f } });
  go.disabled = true; go.textContent = "Menyimpan…";
  try { const r = await fetch("/api/register-add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gid: cur, pin, tahun: tahun(), items }) });
    const j = await r.json(); if (!j.ok) { if (/PIN/.test(j.err || "")) lsSet("pin", ""); throw new Error(j.err || "Gagal menyimpan") }
    lsSet("pin", pin); const hasil = j.hasil || [{ nomor: j.nomor }];
    hasil.forEach((x, i) => { rows.push({ no: x.nomor, yr: tahun(), f: items[i].fields }); flash.add(x.nomor) }); render();
    $("#sh").innerHTML = `<div class="grab"></div><div class="ok"><div class="ck">✅</div><h2>${hasil.length > 1 ? hasil.length + " nomor" : "Nomor"} berhasil diambil</h2>
    <div class="sub">Sudah tercatat di Google Sheet register</div><div class="oklist">${hasil.map((x, i) => `<div class="r"><code>${esc(x.nomor)}</code><button class="cp" data-c="${esc(x.nomor)}">Salin</button></div>`).join("")}</div>
    ${hasil.length > 1 ? `<button class="go" data-c="${esc(hasil.map(x => x.nomor).join("\n"))}">Salin semua nomor</button>` : `<button class="go" data-c="${esc(hasil[0].nomor)}">Salin nomor</button>`}
    <button class="cancel" id="tutup">Selesai</button></div>`;
    setTimeout(() => fetchTab(cur, true).then(p => { if (!F) { rows = p; render(); counts() } }).catch(() => {}), 2500) }
  catch (x) { err.textContent = x.message; go.disabled = false; go.textContent = "Simpan & Ambil Nomor" } }

/* ---------- event ---------- */
$("#tabs").onclick = e => { const b = e.target.closest(".tab"); if (b) goTab(+b.dataset.g) };
$("#q").oninput = () => { shown = 80; render() }; $("#yr").onchange = () => { shown = 80; render() };
$$("#rf,#rf2").forEach(b => b.onclick = () => load(true));
$$("#fab,#add2").forEach(b => b.onclick = () => openForm());
$("#ov").onclick = closeForm;
$("#m").onclick = e => { const c = e.target.closest("[data-c]"); if (c) return copy(c.dataset.c);
  const d = e.target.closest("[data-dup]"); if (d) return openForm(rows.find(o => o.no === d.dataset.dup));
  if (e.target.id === "takeNext") return openForm(); if (e.target.id === "more") { shown += 80; render() } };
$("#sh").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.c) return copy(b.dataset.c);
  if (b.id === "cx" || b.id === "tutup") return closeForm();
  if (b.id === "go") return simpan();
  if (b.dataset.k) { F.p[b.dataset.k] = b.dataset.v; $$("button", b.parentNode).forEach(x => x.classList.toggle("on", x === b)); metode(); return preview() }
  if (b.dataset.tpl) { F.items = F.tpls[+b.dataset.tpl][1].map(v => ({ v })); return drawItems() }
  if (b.id === "addrow") { const l = F.items[F.items.length - 1]; F.items.push({ v: F.it.col && !F.it.opts ? "" : l.v }); drawItems(); $$("#dl [data-iv]").pop()?.focus(); return }
  if (b.dataset.rm) { F.items.splice(+b.dataset.rm, 1); return drawItems() } });
$("#sh").addEventListener("input", e => { const t = e.target;
  if (t.dataset.pk) { const pos = t.selectionStart; t.value = t.value.toUpperCase().replace(/[\/\s]+/g, "-"); try { t.setSelectionRange(pos, pos) } catch (_) {} F.p[t.dataset.pk] = t.value.trim(); preview() }
  if (t.dataset.iv) { F.items[+t.dataset.iv].v = t.value; preview() }
  if (t.dataset.tgl) preview();
  if (t.dataset.h && t.dataset.h.includes("METODE")) t.dataset.manual = 1;
  if (t.dataset.rp) { const d = t.value.replace(/\D/g, ""); t.value = d ? (+d).toLocaleString("id-ID") : "" } });
$("#sh").addEventListener("change", e => { if (e.target.dataset.iv) { F.items[+e.target.dataset.iv].v = e.target.value; preview() } });
document.addEventListener("keydown", e => { const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
  if (e.key === "Escape") { if (F || $("#sh").classList.contains("on")) closeForm(); else if (typing) document.activeElement.blur(); return }
  if (F && (e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); return simpan() }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || $("#sh").classList.contains("on")) return;
  if (e.key === "n" || e.key === "N") { e.preventDefault(); openForm() }
  else if (e.key === "/") { e.preventDefault(); $("#q").focus() }
  else if (e.key === "r" || e.key === "R") load(true);
  else if (/^[1-8]$/.test(e.key)) goTab(TABS[+e.key - 1][1]) });
document.addEventListener("visibilitychange", () => { if (!document.hidden && !F) load(true, true) });

tabsUI(); load(true, true).then(() => setTimeout(prefetch, 800));
$(".tab.on")?.scrollIntoView({ inline: "center", block: "nearest" });
