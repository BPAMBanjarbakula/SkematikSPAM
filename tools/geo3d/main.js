/* GeoSPAM Bakula — Mode 3D (relief DEMNAS + jaringan pipa), dimuat hanya saat dibuka */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import META from "./meta.json";
import CSS from "./style.css";

const [BW, BS, BE, BN] = META.bbox;
const LAT0 = (BS + BN) / 2, LON0 = (BW + BE) / 2;
const KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
const SX = (BE - BW) * KX, SZ = (BN - BS) * KY;                 // km
const X = lon => (lon - LON0) * KX, Z = lat => -(lat - LAT0) * KY;
const LON = x => x / KX + LON0, LAT = z => -z / KY + LAT0;
const DEG = Math.PI / 180, LIFT = 0.004;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (v, d = 0) => (+v).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const sv = (p, f) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${f ? "currentColor" : "none"}" stroke="${f ? "none" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  back: sv('<path d="M15 6l-6 6 6 6"/>'), x: sv('<path d="M6 6l12 12M18 6 6 18"/>'),
  rot: sv('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>'),
  play: sv('<path d="M8 5v14l11-7z"/>', 1), pause: sv('<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>', 1),
  prev: sv('<path d="M15 6l-6 6 6 6"/>'), next: sv('<path d="M9 6l6 6-6 6"/>'),
  flow: sv('<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2V12M12 12H7a2 2 0 0 0-2 2v2.8M12 12h5a2 2 0 0 1 2 2v2.8"/>'),
  home: sv('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>'),
  map: sv('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>'),
  zoom: sv('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6M11 8v6"/>'),
  cam: sv('<path d="M4 8.5h3.2L8.8 6h6.4l1.6 2.5H20V19H4z"/><circle cx="12" cy="13.3" r="3.4"/>'),
  mount: sv('<path d="M3 19 9.5 8l4 6.5 2.2-3.2L21 19z"/>'), sat: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'),
  cmp: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 15.2 12H8.8z" fill="#ff6b6b"/><path d="M12 21.5 15.2 12H8.8z" fill="#cfe0ef"/><circle cx="12" cy="12" r="1.6" fill="#06121f"/></svg>'
};
const KAT = {
  intake: { c: "#22d3ee", s: "IN", t: "Intake", pr: 0 }, ipa: { c: "#38d9a9", s: "IPA", t: "Instalasi pengolahan air", pr: 1 },
  offtake: { c: "#b197fc", s: "OT", t: "Offtake (titik serah)", pr: 2 }, bgt: { c: "#ff8787", s: "BGT", t: "Booster Ground Transfer", pr: 3 },
  booster: { c: "#ff8787", s: "B", t: "Booster distribusi", pr: 3 }, reservoir: { c: "#66d9e8", s: "R", t: "Reservoir", pr: 4 }
};
const DOTC = { air_valve: "#ffa94d", wash_out: "#f06595", av_wo: "#f06595", valve: "#748ffc", meter: "#38d9a9", pergantian: "#ced4da", patokan: "#868e96", titik_pipa: "#adb5bd", lainnya: "#868e96" };
const TOWNS = [["BANJARMASIN", 114.592, -3.322], ["MARTAPURA", 114.853, -3.411], ["BANJARBARU", 114.812, -3.468], ["LAUT JAWA", 114.566, -3.705, "sea"], ["PEG. MERATUS", 114.955, -3.672], ["S. BARITO", 114.548, -3.30, "sea"]];
const shortName = n => n.replace(/ – PTAM.*$/, "").replace(/ \(.*\)$/, "").replace(/ & Kantor.*$/, "");
const liveKey = n => /^Intake Karang/.test(n) ? "intake" : /^IPA Pinus/.test(n) ? "ipa" : /^Offtake Pematang/.test(n) ? "pematang" : /^Offtake Pinus –/.test(n) ? "prased" : null;
function lineStyle(p) {
  if (p.lanjutan) return { c: 0xd0bfff, w: 2.4, dash: true };
  if (p.kode && p.kode[0] === "D") return { c: 0x9775fa, w: 3.4 };
  if (p.kode === "T-06") return { c: 0xffa94d, w: 3 };
  if (p.material === "GRP") return { c: 0xff7a3d, w: 4.8 };
  if (p.diameter && p.diameter.indexOf("1.200") >= 0) return { c: 0x4dabf7, w: 4.8 };
  return { c: 0x22d3ee, w: 4 };
}

let S = null, O = null, root = null;

function shell() {
  root = document.getElementById("g3d");
  if (!root) { root = document.createElement("div"); root.id = "g3d"; document.body.appendChild(root); }
  if (root.dataset.built) return;
  root.dataset.built = "1";
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Mode 3D jaringan SPAM Regional Banjarbakula");
  root.innerHTML = `
<canvas tabindex="0" aria-label="Tampilan 3D relief dan jaringan pipa"></canvas>
<div class="g3-lb"></div>
<div class="g3-probe off"><i></i><span></span></div>
<div class="g3-load"><div class="bx">
  <svg class="mesh" width="132" height="92" viewBox="0 0 132 92"><path d="M4 70 34 52 60 62 92 40 128 58"/><path d="M4 82 36 66 62 76 96 56 128 72"/><path d="M4 56 30 34 58 46 88 20 128 42"/><path d="M34 52 36 66M60 62 62 76M92 40 96 56M30 34 34 52M58 46 60 62M88 20 92 40"/></svg>
  <b>MODE 3D</b><p class="ms">Menyiapkan relief DEMNAS…</p><div class="g3pb"><i></i></div>
  <div class="er"><button data-a="close">Kembali ke peta 2D</button></div></div></div>
<div class="g3-top">
  <button class="g3-pill" data-a="close" title="Kembali ke peta 2D (Esc)">${IC.back}<span>Peta 2D</span></button>
  <div class="g3-ttl"><b>MODE 3D</b><span>Relief DEMNAS · jaringan SPAM Regional Banjarbakula</span></div>
  <span class="g3-live off"><i></i><span>LIVE</span><span class="tm"></span></span>
  <button class="g3-cmp" data-a="north" title="Arah utara · klik untuk menghadap utara">${IC.cmp}</button>
</div>
<div class="g3-leg g3-glass"><h4>LEGENDA</h4>
  <div><i style="--c:#ff7a3d"></i>GRP DN 1.200 mm</div><div><i style="--c:#4dabf7"></i>HDPE DN 1.200 mm</div><div><i style="--c:#22d3ee"></i>HDPE Ø 710 mm</div>
  <div><i style="--c:#9775fa"></i>Distribusi air curah (JDU)</div><div><i class="d" style="--c:#d0bfff"></i>Jaringan lanjutan PTAM</div>
  <div><i class="p" style="--c:#ffa94d"></i>Air valve · wash out · katup</div>
  <div class="el" style="display:block"><span class="ramp"></span><div class="rl"><span>0 m</span><span>Elevasi</span><span>${nf(Math.round(META.zmax / 100) * 100)} m</span></div></div>
</div>
<aside class="g3-flow g3-glass off" aria-label="Alur sistem"><div class="g3-fh"><b>ALUR SISTEM · LIVE</b><button class="g3-x" data-a="flowx" aria-label="Tutup">${IC.x}</button></div><div class="g3-fb"></div></aside>
<div class="g3-card g3-glass off"></div>
<div class="g3-tour g3-glass off"><div class="k"><i class="n"></i><span class="kt"></span></div><h3></h3><p></p>
  <div class="c"><button data-a="tprev" aria-label="Sebelumnya">${IC.prev}</button><button data-a="tplay" aria-label="Jeda">${IC.pause}</button><button data-a="tnext" aria-label="Berikutnya">${IC.next}</button><div class="pg"><i></i></div><button class="end" data-a="tend">Selesai</button></div></div>
<div class="g3-hint off"></div><div class="g3-toast off"></div>
<div class="g3-bar g3-glass">
  <div class="g3-seg" role="group" aria-label="Tekstur permukaan"><button data-tex="elev" class="on">${IC.mount}Elevasi</button><button data-tex="sat">${IC.sat}Satelit</button></div>
  <label class="g3-rel" title="Perbesaran tinggi relief"><span>Relief</span><input type="range" min="1" max="12" step="0.5" value="5" aria-label="Perbesaran relief"><b>5×</b></label>
  <span class="g3-sep"></span>
  <button class="g3-b" data-a="rot" aria-pressed="false" title="Putar otomatis">${IC.rot}<span>Putar</span></button>
  <button class="g3-b" data-a="tour" title="Tur 3D sepanjang jaringan">${IC.play}<span>Tur 3D</span></button>
  <button class="g3-b" data-a="flow" aria-pressed="false" title="Skema alur sistem dengan angka live">${IC.flow}<span>Alur</span></button>
  <button class="g3-b" data-a="snap" title="Simpan tampilan ini sebagai gambar PNG">${IC.cam}<span>Gambar</span></button>
  <button class="g3-b" data-a="reset" title="Kembali ke tampilan awal">${IC.home}<span>Reset</span></button>
</div>
<div class="g3-att">Relief DEMNAS (BIG)</div>`;
  root.addEventListener("click", onClick);
  root.querySelector(".g3-rel input").addEventListener("input", e => setEx(+e.target.value));
  root.addEventListener("contextmenu", e => e.preventDefault());
}
const $ = s => root.querySelector(s);
const prog = (p, msg) => { $(".g3-load .g3pb i").style.width = Math.round(p * 100) + "%"; if (msg) $(".g3-load .ms").textContent = msg; };
function toast(msg, ms = 3200) { const t = $(".g3-toast"); t.textContent = msg; t.classList.remove("off"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add("off"), ms); }
const loadImg = (src, cors) => new Promise((ok, no) => { const im = new Image(); if (cors) im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => no(new Error("img " + src)); im.src = src; });

// ---------- ketinggian
async function loadDem(base, step) {
  const img = await loadImg(base + "dem3d.png");
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, fw = img.width, fh = img.height;
  const F = new Float32Array(fw * fh);
  for (let k = 0, n = fw * fh; k < n; k++) F[k] = ((d[k * 4] << 8) | d[k * 4 + 1]) * META.unit / 1000;
  // buang lonjakan satu piksel (mis. derau anti-sidik-jari kanvas di sebagian browser)
  for (let j = 1; j < fh - 1; j++) for (let i = 1; i < fw - 1; i++) {
    const k = j * fw + i, a = F[k - 1], b = F[k + 1], e = F[k - fw], f = F[k + fw], mn = Math.min(a, b, e, f), mx = Math.max(a, b, e, f), m = (a + b + e + f) / 4;
    if (mx - mn < .004 && Math.abs(F[k] - m) > .008) F[k] = m;
  }
  const gw = Math.floor((fw - 1) / step) + 1, gh = Math.floor((fh - 1) / step) + 1, H = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) H[j * gw + i] = F[(j * step) * fw + i * step];
  return { H, gw, gh };
}
function hAt(x, z) {                                             // km, tepat di permukaan segitiga mesh
  const { H, gw, gh } = S.dem;
  let fi = (x + SX / 2) / SX * (gw - 1), fj = (z + SZ / 2) / SZ * (gh - 1);
  fi = Math.max(0, Math.min(gw - 1.0001, fi)); fj = Math.max(0, Math.min(gh - 1.0001, fj));
  const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, k = j * gw + i, a = H[k], b = H[k + 1], c = H[k + gw], d = H[k + gw + 1];
  return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
}

// ---------- adegan
async function build() {
  const lite = !!O.lite, base = O.base || "data/";
  const canvas = $("canvas");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { throw new Error("nowebgl"); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1 : 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x06121f, 150, 420);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: .09, rotateSpeed: .55, zoomSpeed: .9, panSpeed: .8, minDistance: 3.5, maxDistance: 300, maxPolarAngle: 86 * DEG, autoRotateSpeed: .55, screenSpacePanning: false });
  S = { lite, base, renderer, scene, camera, controls, ex: 5, vw: 1, vh: 1, mats: [], flows: [], marks: [], towns: [], anim: null, need: true, running: false, tex: {}, texMode: "elev", lastDecl: 0, tour: null, sel: null };

  prog(.12, "Memuat grid ketinggian DEMNAS…");
  S.dem = await loadDem(base, lite ? 2 : 1);
  prog(.4, "Membentuk permukaan 3D…");
  const { H, gw, gh } = S.dem;
  const world = S.world = new THREE.Group(); world.scale.y = S.ex; scene.add(world);

  // permukaan
  const pos = new Float32Array(gw * gh * 3), uv = new Float32Array(gw * gh * 2), idx = new Uint32Array((gw - 1) * (gh - 1) * 6);
  for (let j = 0, p = 0, q = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    pos[p++] = -SX / 2 + i / (gw - 1) * SX; pos[p++] = H[j * gw + i]; pos[p++] = -SZ / 2 + j / (gh - 1) * SZ;
    uv[q++] = i / (gw - 1); uv[q++] = 1 - j / (gh - 1);
  }
  for (let j = 0, t = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) { const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1; idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d; }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); tg.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); tg.setIndex(new THREE.BufferAttribute(idx, 1));
  tg.computeBoundingSphere();
  const tl = new THREE.TextureLoader();
  const prepTex = t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(lite ? 2 : 8, renderer.capabilities.getMaxAnisotropy()); t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; return t; };
  S.prepTex = prepTex;
  prog(.55, "Memuat tekstur elevasi…");
  S.tex.elev = prepTex(await tl.loadAsync(base + "relief3d.webp"));
  const tmat = S.tmat = new THREE.MeshBasicMaterial({ map: S.tex.elev, fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const terrain = S.terrain = new THREE.Mesh(tg, tmat); terrain.frustumCulled = false; world.add(terrain);

  // dinding tepi + alas
  const rim = []; for (let i = 0; i < gw; i++) rim.push(i); for (let j = 1; j < gh; j++) rim.push(j * gw + gw - 1); for (let i = gw - 2; i >= 0; i--) rim.push((gh - 1) * gw + i); for (let j = gh - 2; j >= 0; j--) rim.push(j * gw);
  const n = rim.length, sp = new Float32Array(n * 6), sc = new Float32Array(n * 6), si = new Uint32Array(n * 6);
  const cT = new THREE.Color(0x163a52), cB = new THREE.Color(0x050c16);
  rim.forEach((k, r) => { const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2]; sp.set([x, y, z, x, -1, z], r * 6); sc.set([cT.r, cT.g, cT.b, cB.r, cB.g, cB.b], r * 6);
    const a = r * 2, b = ((r + 1) % n) * 2; si.set([a, b, a + 1, b, b + 1, a + 1], r * 6); });
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("color", new THREE.BufferAttribute(sc, 3)); sg.setIndex(new THREE.BufferAttribute(si, 1));
  S.skirt = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); S.skirt.frustumCulled = false; world.add(S.skirt);
  setEx(S.ex);
  const grid = new THREE.GridHelper(900, 150, 0x1d4566, 0x10283d); grid.material.transparent = true; grid.material.opacity = .55; grid.position.y = -1.02; scene.add(grid); S.grid = grid;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(SX * 1.5, SZ * 1.5), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, fog: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -1.0; scene.add(glow);

  // pipa
  prog(.72, "Menggambar jaringan pipa…");
  const D = O.data, fit = [];
  const addLines = fc => fc.features.forEach(f => {
    const st = lineStyle(f.properties), parts = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    parts.forEach(cs => {
      const P = [];
      for (let i = 0; i < cs.length; i++) {
        const x = X(cs[i][0]), z = Z(cs[i][1]);
        if (i) { const px = X(cs[i - 1][0]), pz = Z(cs[i - 1][1]), m = Math.ceil(Math.hypot(x - px, z - pz) / .12);
          for (let k = 1; k < m; k++) { const u = k / m, xx = px + (x - px) * u, zz = pz + (z - pz) * u; P.push(xx, hAt(xx, zz) + LIFT, zz); } }
        P.push(x, hAt(x, z) + LIFT, z);
        if (i % 6 === 0 || i === cs.length - 1) fit.push(new THREE.Vector3(x, 0, z));
      }
      if (P.length < 6) return;
      const geo = new LineGeometry(); geo.setPositions(P);
      const mk = (o, ro) => { const m = new LineMaterial(Object.assign({ fog: false, worldUnits: false }, o)); S.mats.push(m); const l = new Line2(geo, m); l.computeLineDistances(); l.renderOrder = ro; l.frustumCulled = false; world.add(l); return m; };
      mk({ color: 0x04121f, linewidth: st.w + 2.4, depthWrite: false }, 1);
      mk(st.dash ? { color: st.c, linewidth: st.w, dashed: true, dashSize: .34, gapSize: .26, depthWrite: false } : { color: st.c, linewidth: st.w, depthWrite: false }, 2);
      if (!st.dash) S.flows.push(mk({ color: 0xffffff, linewidth: Math.max(1.6, st.w * .42), dashed: true, dashSize: .16, gapSize: 1.0, transparent: true, opacity: .95, depthWrite: false }, 3));
    });
  });
  addLines(D.jaringan_distribusi); addLines(D.transmisi_air_baku);
  S.fit = fit;

  // titik aset kecil
  const feats = [...D.titik_air_baku.features, ...D.titik_distribusi.features];
  const small = feats.filter(f => !KAT[f.properties.kategori]);
  if (small.length) {
    const pp = new Float32Array(small.length * 3), pc = new Float32Array(small.length * 3), col = new THREE.Color();
    small.forEach((f, i) => { const x = X(f.geometry.coordinates[0]), z = Z(f.geometry.coordinates[1]); pp.set([x, hAt(x, z) + LIFT * 2, z], i * 3); col.set(DOTC[f.properties.kategori] || "#adb5bd"); pc.set([col.r, col.g, col.b], i * 3); });
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pp, 3)); pg.setAttribute("color", new THREE.BufferAttribute(pc, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: lite ? 4.5 : 5.5, sizeAttenuation: false, vertexColors: true, map: dotTex(), alphaTest: .35, transparent: true, fog: false, depthWrite: false }));
    pts.renderOrder = 4; pts.frustumCulled = false; world.add(pts);
  }

  // penanda + label
  const lb = $(".g3-lb"); lb.innerHTML = "";
  feats.filter(f => KAT[f.properties.kategori]).forEach(f => {
    const p = f.properties, k = KAT[p.kategori], x = X(f.geometry.coordinates[0]), z = Z(f.geometry.coordinates[1]);
    const el = document.createElement("div"); el.className = "g3l"; el.style.setProperty("--c", k.c); el.style.setProperty("--cb", k.c + "99");
    el.innerHTML = `<u></u><div class="b"><span>${esc(shortName(p.nama))}</span></div><s title="${esc(p.nama)}"></s>`;
    lb.appendChild(el);
    const m = { f, p, k, x, z, y: hAt(x, z), el, name: p.nama, short: shortName(p.nama), lk: liveKey(p.nama), pr: k.pr, w: 120, h: 24, st: 30, state: "" };
    el.querySelector(".b").onclick = el.querySelector("s").onclick = e => { e.stopPropagation(); select(m, true); };
    S.marks.push(m);
  });
  S.marks.sort((a, b) => a.pr - b.pr);
  // tinggi tangkai berbeda untuk titik yang berdekatan (kompleks IPA Pinus)
  TOWNS.forEach(([t, lon, lat, cls]) => { const el = document.createElement("div"); el.className = "g3t" + (cls ? " " + cls : ""); el.innerHTML = `<span>${t}</span>`; lb.appendChild(el);
    const x = X(lon), z = Z(lat); S.towns.push({ el, x, z, y: hAt(x, z) + .01, w: t.length * 9 + 10, h: 16, state: "", label: t, sea: !!cls }); });

  // ukuran & kamera
  const ro = new ResizeObserver(resize); ro.observe(root); resize();
  S.home = homeView(); setCam({ t: S.home.t, r: S.home.r * 1.55, phi: 6 * DEG, theta: S.home.theta - .9 });
  controls.addEventListener("start", () => { S.anim = null; if (controls.autoRotate) setRot(false); if (S.tour && S.tour.playing) tourPlay(false); hint(false); });
  controls.addEventListener("change", () => { const t = controls.target; t.x = Math.max(-SX / 2, Math.min(SX / 2, t.x)); t.z = Math.max(-SZ / 2, Math.min(SZ / 2, t.z)); t.y = Math.max(0, Math.min(8, t.y)); S.need = true; });
  canvas.addEventListener("pointerdown", e => { S.pd = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener("pointerup", e => { const d = S.pd; S.pd = null; if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 450) return; probe(e.clientX, e.clientY); });
  canvas.addEventListener("dblclick", e => { const h = pick(e.clientX, e.clientY); if (h) { const c = camState(); fly({ t: new THREE.Vector3(h.x, h.h * S.ex, h.z), r: Math.max(6, c.r * .5), phi: c.phi, theta: c.theta }, 900); } });
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); S.running = false; toast("Tampilan 3D terhenti oleh perangkat. Tutup lalu buka kembali Mode 3D.", 8000); });
  document.addEventListener("visibilitychange", () => { if (S && root.classList.contains("on")) { if (document.hidden) S.running = false; else start(); } });
  prog(1, "Siap");
  refreshLive(); S.liveT = setInterval(refreshLive, 30000);
  measure();
}
function glowTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), r = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  r.addColorStop(0, "rgba(34,211,238,.34)"); r.addColorStop(.55, "rgba(28,126,214,.12)"); r.addColorStop(1, "rgba(28,126,214,0)"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); }
function dotTex() { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 7; g.strokeStyle = "rgba(4,18,31,.9)"; g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

function pads() {
  const mob = S.vw <= 820, low = S.vh < 480, bar = $(".g3-bar"), flow = !$(".g3-flow").classList.contains("off"), side = mob ? 30 : 76;
  return { T: (mob ? 54 : 64) + (low ? 26 : mob ? 96 : 104), B: (bar.offsetHeight || 52) + (mob ? 8 : 16) + 22, L: side, R: side + (!mob && flow ? 332 : 0) };
}
function voBase() { const p = pads(), mob = S.vw <= 820, flow = !$(".g3-flow").classList.contains("off"); return [!mob && flow ? 166 : 0, Math.max(-44, Math.min(70, (p.B - p.T) / 2))]; }
function voTarget() {
  const mob = S.vw <= 820, fl = $(".g3-flow"), cd = $(".g3-card"), b = voBase();
  if (S.tour) b[1] -= mob ? 56 : 40;
  if (!mob) return b;
  const el = !fl.classList.contains("off") ? fl : !cd.classList.contains("off") ? cd : null;
  return [0, el ? Math.min(S.vh * .3, el.offsetHeight / 2 + 12) : b[1]];
}
function syncVO() { S.voT = voTarget(); S.need = true; }
function applyVO(x, y) { S.vo = [x, y]; S.camera.setViewOffset(S.vw, S.vh, x, y, S.vw, S.vh); S.need = true; }
function resize() {
  if (!S) return; const w = root.clientWidth || 1, h = root.clientHeight || 1; S.vw = w; S.vh = h;
  S.renderer.setSize(w, h, false); S.camera.aspect = w / h; S.voT = voTarget(); applyVO(S.voT[0], S.voT[1]);
  S.mats.forEach(m => m.resolution.set(w, h)); S.need = true;
  const hv = S.fit && homeView(); if (hv) S.home = hv;
}
function sph(c) { return new THREE.Vector3().setFromSphericalCoords(c.r, c.phi, c.theta).add(c.t); }
function setCam(c) { S.controls.target.copy(c.t); S.camera.position.copy(sph(c)); S.camera.lookAt(c.t); S.need = true; }
function camState() { const o = S.camera.position.clone().sub(S.controls.target), s = new THREE.Spherical().setFromVector3(o); return { t: S.controls.target.clone(), r: s.radius, phi: s.phi, theta: s.theta }; }
function homeView() {
  const port = S.vw / S.vh < .9, bx = new THREE.Box3().setFromPoints(S.fit), t = bx.getCenter(new THREE.Vector3()); t.y = 0;
  const c = { t, r: 100, phi: (port ? 40 : 50) * DEG, theta: -14 * DEG }, cam = S.camera, v = new THREE.Vector3(), old = cam.position.clone(), oq = cam.quaternion.clone();
  const P = pads(), vb = voBase(), w = S.vw, h = S.vh, cx = w / 2 - vb[0], cy = h / 2 - vb[1];
  const aL = Math.max(40, cx - P.L), aR = Math.max(40, w - P.R - cx), aT = Math.max(40, cy - P.T), aB = Math.max(40, h - P.B - cy);
  const vo = S.vo; cam.setViewOffset(w, h, vb[0], vb[1], w, h);
  for (let it = 0; it < 6; it++) {
    cam.position.copy(sph(c)); cam.lookAt(c.t); cam.updateMatrixWorld();
    let m = 0; for (const p of S.fit) { v.copy(p).project(cam); const dx = (v.x * .5 + .5) * w - cx, dy = (-v.y * .5 + .5) * h - cy; m = Math.max(m, dx > 0 ? dx / aR : -dx / aL, dy > 0 ? dy / aB : -dy / aT); }
    c.r *= m;
  }
  if (vo) cam.setViewOffset(w, h, vo[0], vo[1], w, h); else cam.clearViewOffset();
  cam.position.copy(old); cam.quaternion.copy(oq); cam.updateMatrixWorld();
  return c;
}
function fly(to, ms = 1700) { const a = camState(); let d = to.theta - a.theta; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; S.anim = { a, to, d, t0: performance.now(), ms: S.reduce ? 1 : ms }; S.need = true; }
function setEx(v) {
  S.ex = v; S.world.scale.y = v; $(".g3-rel b").textContent = nf(v, v % 1 ? 1 : 0) + "×";
  const p = S.skirt.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) p.setY(i + 1, -1 / v); p.needsUpdate = true;
  S.lastDecl = 0; S.need = true;
}
function setRot(on) { S.controls.autoRotate = on; $('[data-a="rot"]').setAttribute("aria-pressed", on); S.need = true; }
function hint(on) { const h = $(".g3-hint"); if (on) { h.textContent = matchMedia("(pointer:coarse)").matches ? "Geser: putar · cubit: zoom · dua jari: geser peta · ketuk: elevasi" : "Seret: putar · scroll: zoom · klik kanan: geser · klik: elevasi"; h.classList.remove("off"); clearTimeout(hint.t); hint.t = setTimeout(() => h.classList.add("off"), 7000); } else h.classList.add("off"); }

// ---------- citra satelit (Esri World Imagery) + bayangan relief
async function buildSat(z, quiet) {
  const n = 2 ** z, tx = lon => (lon + 180) / 360 * n, ty = lat => (1 - Math.log(Math.tan(lat * DEG) + 1 / Math.cos(lat * DEG)) / Math.PI) / 2 * n;
  const lonOf = x => x / n * 360 - 180, latOf = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) / DEG;
  const x0 = Math.floor(tx(BW)), x1 = Math.floor(tx(BE)), y0 = Math.floor(ty(BN)), y1 = Math.floor(ty(BS));
  const cw = Math.round((BE - BW) / 360 * n * 256), ch = Math.round(cw * SZ / SX);
  const c = document.createElement("canvas"); c.width = cw; c.height = ch; const g = c.getContext("2d");
  g.fillStyle = "#0b2c47"; g.fillRect(0, 0, cw, ch);
  const jobs = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) jobs.push([x, y]);
  let fail = 0, done = 0; const btn = $('[data-tex="sat"]');
  const one = async ([x, y]) => {
    let im = null; try { im = await loadImg(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, true); } catch (e) { fail++; }
    if (im) { const lL = lonOf(x), lR = lonOf(x + 1), aT = latOf(y), aB = latOf(y + 1);
      g.drawImage(im, (lL - BW) / (BE - BW) * cw - .5, (BN - aT) / (BN - BS) * ch - .5, (lR - lL) / (BE - BW) * cw + 1, (aT - aB) / (BN - BS) * ch + 1); }
    done++; if (!quiet) btn.style.setProperty("opacity", String(.55 + .45 * done / jobs.length));
  };
  let qi = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (qi < jobs.length) await one(jobs[qi++]); }));
  btn.style.removeProperty("opacity");
  if (fail > jobs.length * .3) throw new Error("tiles");
  try { const sh = await loadImg(S.base + "shade3d.webp"); g.globalCompositeOperation = "hard-light"; g.globalAlpha = .62; g.drawImage(sh, 0, 0, cw, ch); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; } catch (e) {}
  const t = S.prepTex(new THREE.CanvasTexture(c)); t.needsUpdate = true; return t;
}
async function setTex(mode) {
  if (mode === S.texMode || S.texBusy) return;
  const bs = root.querySelectorAll(".g3-seg button"), mark = () => bs.forEach(b => b.classList.toggle("on", b.dataset.tex === S.texMode));
  if (mode === "sat" && !S.tex.sat) {
    S.texBusy = true; const b = $('[data-tex="sat"]'); b.classList.add("busy");
    try { S.tex.sat = await buildSat(S.lite ? 11 : 12); }
    catch (e) { toast("Citra satelit gagal dimuat. Periksa koneksi, lalu coba lagi."); b.classList.remove("busy"); S.texBusy = false; return; }
    b.classList.remove("busy"); S.texBusy = false;
    if (!S.lite && S.vw > 820) setTimeout(async () => { try { const hd = await buildSat(13, true); const old = S.tex.sat; S.tex.sat = hd; if (S.texMode === "sat") { S.tmat.map = hd; S.tmat.needsUpdate = true; S.need = true; } old.dispose(); } catch (e) {} }, 2500);
  }
  S.texMode = mode; S.tmat.map = S.tex[mode]; S.tmat.needsUpdate = true; S.need = true; mark();
  $(".g3-leg .el").style.display = mode === "elev" ? "block" : "none";
  $(".g3-ttl span").textContent = (mode === "sat" ? "Citra satelit + relief DEMNAS" : "Relief DEMNAS") + " · jaringan SPAM Regional Banjarbakula";
  $(".g3-att").textContent = "Relief DEMNAS (BIG)" + (mode === "sat" ? " · citra Esri World Imagery" : "");
}

// ---------- label
function measure() { S.marks.forEach(m => { const b = m.el.querySelector(".b"); m.w = b.offsetWidth || m.w; m.h = b.offsetHeight || 24; }); S.lastDecl = 0; S.need = true; }
const V = new THREE.Vector3();
function labels() {
  const cam = S.camera, w = S.vw, h = S.vh, ex = S.ex, decl = performance.now() - S.lastDecl > 130;
  const put = (o, yk) => { V.set(o.x, o.y * ex + (yk || 0), o.z).project(cam); o.vis = V.z > -1 && V.z < 1 && Math.abs(V.x) < 1.2 && Math.abs(V.y) < 1.25; o.sx = (V.x * .5 + .5) * w; o.sy = (-V.y * .5 + .5) * h;
    if (o.vis) o.el.style.transform = `translate3d(${o.sx.toFixed(1)}px,${o.sy.toFixed(1)}px,0)`; };
  S.marks.forEach(m => { put(m); if (!m.vis) return; const hw = m.w / 2 + 8, dx = Math.round(Math.max(hw - m.sx, Math.min(w - hw - m.sx, 0))); if (dx !== m.dx) { m.dx = dx; m.el.style.setProperty("--dx", dx + "px"); } });
  S.towns.forEach(t => put(t));
  if (!decl) return; S.lastDecl = performance.now();
  const taken = [], hit = r => taken.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
  const rb = root.getBoundingClientRect();
  taken.push([0, 0, w, w <= 820 ? 70 : 60]);
  [".g3-bar", ".g3-leg", ".g3-flow", ".g3-card", ".g3-tour"].forEach(q => { const e = $(q); if (!e || e.classList.contains("off")) return; const b = e.getBoundingClientRect(); if (b.width && b.height) taken.push([b.left - rb.left - 4, b.top - rb.top - 4, b.right - rb.left + 4, b.bottom - rb.top + 4]); });
  const setState = (o, s) => { if (o.state !== s) { o.state = s; o.el.classList.toggle("off", s === "off"); o.el.classList.toggle("min", s === "min"); } };
  const order = S.sel ? [S.sel, ...S.marks.filter(m => m !== S.sel)] : S.marks;
  order.forEach(m => { if (!m.vis) return setState(m, "off");
    const cx = m.sx + (m.dx || 0);
    for (let k = 0; k < 5; k++) { const st = 30 + k * 29, r = [cx - m.w / 2 - 4, m.sy - st - 6 - m.h - 2, cx + m.w / 2 + 4, m.sy - st - 4];
      if (hit(r)) continue; taken.push(r); if (m.st !== st) { m.st = st; m.el.style.setProperty("--st", st + "px"); }
      const zi = m === S.sel ? 9999 : Math.max(1, Math.round(m.sy - st)); if (zi !== m.zi) { m.zi = zi; m.el.style.zIndex = zi; } return setState(m, ""); }
    setState(m, "min"); });
  S.marks.forEach(m => { if (m.vis) taken.push([m.sx - 7, m.sy - 7, m.sx + 7, m.sy + 7]); });
  S.towns.forEach(t => { if (!t.vis) return setState(t, "off"); const r = [t.sx - t.w / 2, t.sy - t.h / 2, t.sx + t.w / 2, t.sy + t.h / 2]; if (hit(r)) setState(t, "off"); else { taken.push(r); setState(t, ""); } });
}
function refreshLive() {
  if (!S || !root.classList.contains("on")) return; let L = null; try { L = O.live && O.live(); } catch (e) {}
  S.live = L; const it = (L && L.items) || {};
  S.marks.forEach(m => { const v = m.lk && it[m.lk], b = m.el.querySelector(".b");
    b.innerHTML = `<span>${esc(m.short)}</span>` + (v ? `<b>${esc(v.v)} ${esc(v.u)}</b>` : "");
    m.el.classList.toggle("live", !!v && !v.est && !v.old); });
  const lv = $(".g3-live"); const any = Object.values(it).some(v => v && !v.est);
  lv.classList.toggle("off", !any); lv.querySelector(".tm").textContent = L && L.t ? L.t + " WITA" : "";
  flowPanel(); if (S.sel) card(S.sel);
  requestAnimationFrame(measure);
}

// ---------- pilih titik / kartu info
function select(m, flyTo) {
  if (S.sel) S.sel.el.classList.remove("sel"); S.sel = m; if (!m) { $(".g3-card").classList.add("off"); S.lastDecl = 0; syncVO(); return; }
  m.el.classList.add("sel"); card(m); $(".g3-card").classList.remove("off");
  if (S.vw <= 820) setFlow(false);
  syncVO();
  if (flyTo) { const c = camState(); fly({ t: new THREE.Vector3(m.x, m.y * S.ex, m.z), r: Math.min(c.r, S.vw / S.vh < .9 ? 34 : 24), phi: Math.max(c.phi, 52 * DEG), theta: c.theta + .35 }, 1500); }
  S.lastDecl = 0; S.need = true;
}
function card(m) {
  const p = m.p, it = (S.live && S.live.items) || {}, lv = m.lk && it[m.lk], aw = m.lk === "intake" && it.awlr;
  const lat = p && m.f.geometry.coordinates[1], src = lat < -3.75 ? "Copernicus GLO-30" : "DEMNAS";
  const sub = [m.k.t, p.ptam || (p.detail && p.detail.Offtaker) || p.jaringan].filter(Boolean).join(" · ");
  const rows = Object.entries(p.detail || {}).filter(([k]) => !/^Catatan|^Nama di/.test(k)).slice(0, 4).map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
  const sta = p.sta_m != null && p.jaringan === "Air baku" ? `<div><span>STA dari intake</span><span>${nf(p.sta_m / 1000, 2)} km</span></div>` : "";
  $(".g3-card").innerHTML = `<div class="g3-ch"><span class="g3-ci" style="--c:${m.k.c}">${m.k.s}</span><div style="flex:1;min-width:0"><h3>${esc(m.short)}</h3><p>${esc(sub)}</p></div><button class="g3-x" data-a="cardx" aria-label="Tutup">${IC.x}</button></div>
<div class="g3-ck" style="--c:${m.k.c}"><div><b>${nf(m.y * 1000)} m</b><span>Elevasi tanah · ${src}</span></div>${lv ? `<div><b class="g3v">${esc(lv.v)} ${esc(lv.u)}</b><span>${esc(lv.l || "Telemetri")}</span></div>` : ""}${aw ? `<div><b class="g3v">${esc(aw.v)} ${esc(aw.u)}</b><span>Muka air · ${esc(aw.st || "")}</span></div>` : ""}</div>
<div class="g3-ct">${sta}${rows}</div>
<div class="g3-ca"><button data-a="near">${IC.zoom}Dekati</button><button class="pri" data-a="to2d">${IC.map}Buka di peta 2D</button></div>`;
}

// ---------- panel alur sistem
function setFlow(on) { $(".g3-flow").classList.toggle("off", !on); $('[data-a="flow"]').setAttribute("aria-pressed", on); if (on && S.vw <= 820) select(null); S.voT = voTarget(); if (S.fit && S.vw > 820) S.home = homeView(); S.need = true; }
function flowPanel() {
  const it = (S.live && S.live.items) || {}, R = (O.data && O.data.ringkasan) || {}, sp = S.live && S.live.split;
  const km = m => nf((m || 0) / 1000, 1) + " km", find = re => (S.marks.find(m => re.test(m.name)) || {}).name;
  const val = (k, fb) => it[k] ? `<div class="v"><b>${esc(it[k].v)}</b><span>${esc(it[k].u)}${it[k].est ? " · est." : it[k].old ? " · tertunda" : ""}</span></div>` : (fb ? `<div class="v"><span>${fb}</span></div>` : "");
  const node = (re, t, s, c, v, big) => { const n = find(re); return `<button class="g3n${big ? " big" : ""}" ${n ? `data-n="${esc(n)}"` : "disabled"} style="--c:${c};--cb:${c}55"><div class="t"><b>${t}</b><span>${s}</span></div>${v || ""}</button>`; };
  const t12 = (R.transmisi_per_material || {}), l1200 = (t12["GRP DN 1.200 mm"] || 0) + (t12["HDPE DN 1.200 mm"] || 0), l710 = t12["HDPE Ø 710 mm"] || 0;
  const aw = it.awlr ? `Muka air bendung ${esc(it.awlr.v)} ${esc(it.awlr.u)} · ${esc(it.awlr.st || "")}` : "Sungai Riam Kanan · Bendung Karang Intan";
  let bar = "";
  if (sp) { const tot = sp.dn + sp.pr + sp.pm, pc = v => nf(v / tot * 100) + "%";
    bar = `<div class="g3bar"><i style="flex:${sp.dn};background:#38d9a9"></i><i style="flex:${sp.pr};background:#ffa94d"></i><i style="flex:${sp.pm};background:#b197fc"></i></div><div class="g3bl"><span><i style="background:#38d9a9"></i>IPA Pinus ${pc(sp.dn)}</span><span><i style="background:#ffa94d"></i>Prased ${pc(sp.pr)}</span><span><i style="background:#b197fc"></i>Pematang ${pc(sp.pm)}</span></div>`; }
  $(".g3-fb").innerHTML =
    node(/^Intake Karang/, "Intake Karang Intan", aw, "#22d3ee", val("intake"), 1) +
    `<div class="g3c">Transmisi GRP–HDPE DN 1.200 mm · ${km(l1200)}</div>` +
    `<div class="g3h" style="--c:#ffa94d">AIR BAKU</div><div class="g3s">` +
    node(/^Offtake Pinus –/, "Offtake Pinus · Prased", "PTAM Intan Banjar", "#ffa94d", val("prased")) +
    node(/^BGT 1/, "BGT 1 → BGT 2", "Booster · HDPE Ø 710 mm · " + km(l710), "#ff8787") +
    node(/^Offtake Pematang/, "Offtake Pematang", "PTAM Bandarmasih", "#b197fc", val("pematang")) + `</div>` +
    `<div class="g3h" style="--c:#38d9a9">PRODUKSI &amp; AIR CURAH</div><div class="g3s">` +
    node(/^IPA Pinus/, "IPA Pinus", "Air baku masuk (DN900) · kapasitas 750 L/dtk", "#38d9a9", val("ipa"), 1) + `</div>` +
    `<div class="g3c cu">JDU air curah · ${km(R.jdu_m)} · 4 titik serah</div><div class="g3s two">` +
    node(/^Offtake Pinus II/, "Pinus II", "PTAM Intan Banjar", "#9775fa") + node(/^Offtake Muslimin/, "Muslimin", "PTAM Intan Banjar", "#9775fa") +
    node(/^Offtake Guntung/, "Guntung Manggis", "PTAM Intan Banjar", "#9775fa") + node(/^Offtake Bati/, "Bati-Bati", "PTAM Berkah Banua", "#9775fa") + `</div>` +
    (bar ? `<div class="g3h">PEMBAGIAN DEBIT AIR BAKU</div>` + bar : "") +
    `<div class="g3h lgd">LEGENDA</div><div class="g3lg"><div><i style="--c:#ff7a3d"></i>GRP DN 1.200</div><div><i style="--c:#4dabf7"></i>HDPE DN 1.200</div><div><i style="--c:#22d3ee"></i>HDPE Ø 710</div><div><i style="--c:#9775fa"></i>JDU air curah</div><div><i class="d" style="--c:#d0bfff"></i>Jaringan lanjutan</div></div>` +
    `<div class="g3note">Angka berwarna = telemetri live (logger) atau estimasi neraca. Titik serah air curah belum memiliki logger. Ketuk baris untuk terbang ke lokasinya.</div>`;
}

// ---------- elevasi di titik klik
const RAY = new THREE.Raycaster(), NDC = new THREE.Vector2();
function pick(cx, cy) {
  const b = root.getBoundingClientRect(); NDC.set((cx - b.left) / S.vw * 2 - 1, -((cy - b.top) / S.vh) * 2 + 1); RAY.setFromCamera(NDC, S.camera);
  const o = RAY.ray.origin, d = RAY.ray.direction, ex = S.ex, at = t => [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t];
  const inside = p => Math.abs(p[0]) <= SX / 2 && Math.abs(p[2]) <= SZ / 2, under = p => p[1] <= hAt(p[0], p[2]) * ex;
  for (let t = 1; t < 600; t += .25) { const p = at(t); if (p[1] < -2) break;
    if (inside(p) && under(p)) { let a = t - .25, c = t; for (let k = 0; k < 14; k++) { const m = (a + c) / 2; if (under(at(m)) && inside(at(m))) c = m; else a = m; }
      const q = at(c); return inside(q) ? { x: q[0], z: q[2], h: hAt(q[0], q[2]) } : null; } }
  return null;
}
function probe(cx, cy) {
  const h = pick(cx, cy), el = $(".g3-probe"); if (!h) { el.classList.add("off"); return; }
  if (S.sel && S.vw <= 820) select(null);
  showProbe(h);
}

// ---------- simpan tampilan sebagai gambar PNG (relief + pipa + label + legenda)
function snap() {
  const r = S.renderer, pr0 = r.getPixelRatio(), pr = Math.min(3, Math.max(2, pr0)), w = S.vw, h = S.vh;
  const c = document.createElement("canvas"); c.width = Math.round(w * pr); c.height = Math.round(h * pr); const g = c.getContext("2d"); g.scale(pr, pr);
  const bg = g.createRadialGradient(w / 2, h * .36, 0, w / 2, h * .36, Math.max(w, h) * .85); bg.addColorStop(0, "#0f3654"); bg.addColorStop(.5, "#081a2c"); bg.addColorStop(1, "#040b14"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  try { r.setPixelRatio(pr); r.setSize(w, h, false); r.render(S.scene, S.camera); g.drawImage(r.domElement, 0, 0, w, h); }
  finally { r.setPixelRatio(pr0); r.setSize(w, h, false); S.need = true; }
  const F = (wt, px, it) => `${it ? "italic " : ""}${wt} ${px}px "Plus Jakarta Sans",system-ui,sans-serif`;
  const rr = (x, y, wd, ht, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + wd, y, x + wd, y + ht, rad); g.arcTo(x + wd, y + ht, x, y + ht, rad); g.arcTo(x, y + ht, x, y, rad); g.arcTo(x, y, x + wd, y, rad); g.closePath(); };
  const it = (S.live && S.live.items) || {};
  g.textBaseline = "middle"; g.textAlign = "center";
  S.towns.forEach(t => { if (!t.vis || t.state === "off") return; g.font = F(600, 10.5, 1); g.shadowColor = "rgba(0,0,0,.9)"; g.shadowBlur = 4; g.fillStyle = t.sea ? "rgba(116,192,252,.85)" : "rgba(235,245,255,.78)"; g.fillText(t.label.split("").join("\u200a"), t.sx, t.sy); });
  g.shadowBlur = 0; g.shadowColor = "transparent";
  S.marks.filter(m => m.vis && m.state !== "off").sort((a, b) => a.sy - b.sy).forEach(m => {
    const col = m.k.c, full = m.state === "";
    if (full) { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(m.sx, m.sy - 6); g.lineTo(m.sx, m.sy - 6 - m.st); g.stroke(); }
    g.beginPath(); g.arc(m.sx, m.sy, full ? 5 : 4, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke();
    if (!full) return;
    const v = m.lk && it[m.lk], t2 = v ? v.v + " " + v.u : "";
    g.font = F(700, 11.5); const w1 = g.measureText(m.short).width; g.font = F(800, 11.5); const w2 = t2 ? g.measureText(t2).width + 6 : 0;
    const wd = w1 + w2 + 20, x0 = m.sx + (m.dx || 0) - wd / 2, y0 = m.sy - m.st - 6 - 24;
    rr(x0, y0, wd, 24, 12); g.fillStyle = "rgba(6,18,31,.92)"; g.fill(); g.strokeStyle = col; g.lineWidth = 1; g.stroke();
    g.textAlign = "left"; g.font = F(700, 11.5); g.fillStyle = "#fff"; g.fillText(m.short, x0 + 10, y0 + 12.5);
    if (t2) { g.font = F(800, 11.5); g.fillStyle = col; g.fillText(t2, x0 + 16 + w1, y0 + 12.5); }
  });
  // judul
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  const gr = g.createLinearGradient(22, 0, 250, 0); gr.addColorStop(0, "#66d9e8"); gr.addColorStop(.5, "#38d9a9"); gr.addColorStop(1, "#b197fc");
  g.font = '900 21px Orbitron,"Plus Jakarta Sans",sans-serif'; g.fillStyle = gr; g.fillText("GeoSPAM BAKULA", 22, 40);
  const d = new Date(), tgl = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Makassar" }) + ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }) + " WITA";
  g.font = F(600, 12); g.fillStyle = "#b9cde0"; g.fillText("Jaringan SPAM Regional Banjarbakula · tampilan 3D", 22, 60);
  g.font = F(500, 11); g.fillStyle = "#8fb3cf"; g.fillText(tgl, 22, 77);
  // legenda
  const LG = [["#ff7a3d", "GRP DN 1.200 mm"], ["#4dabf7", "HDPE DN 1.200 mm"], ["#22d3ee", "HDPE Ø 710 mm"], ["#9775fa", "Distribusi air curah (JDU)"], ["#d0bfff", "Jaringan lanjutan PTAM", 1]];
  const ly = h - 26 - LG.length * 17; rr(14, ly - 14, 208, LG.length * 17 + 20, 12); g.fillStyle = "rgba(6,18,31,.78)"; g.fill();
  g.textBaseline = "middle"; LG.forEach(([col, t, dash], i) => { const y = ly + 4 + i * 17; g.strokeStyle = col; g.lineWidth = 3.5; g.setLineDash(dash ? [5, 4] : []); g.beginPath(); g.moveTo(26, y); g.lineTo(50, y); g.stroke(); g.setLineDash([]); g.font = F(600, 11); g.fillStyle = "#dbe8f5"; g.fillText(t, 60, y + .5); });
  g.textAlign = "right"; g.font = F(500, 10.5); g.fillStyle = "rgba(200,220,240,.75)";
  g.fillText("Relief DEMNAS (BIG)" + (S.texMode === "sat" ? " · citra Esri World Imagery" : "") + " · tinggi diperbesar " + nf(S.ex, S.ex % 1 ? 1 : 0) + "× · geospambakula.netlify.app", w - 18, h - 16);
  const name = "GeoSPAM-3D-" + new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-") + ".png";
  c.toBlob(b => { if (!b) return toast("Gambar gagal dibuat.");
    const save = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); toast("Gambar disimpan: " + name); };
    let file = null; try { file = new File([b], name, { type: "image/png" }); } catch (e) {}
    if (file && matchMedia("(pointer:coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] }))
      navigator.share({ files: [file], title: "GeoSPAM Bakula · tampilan 3D" }).catch(e => { if (!e || e.name !== "AbortError") save(); });
    else save(); }, "image/png");
}

// ---------- tur 3D
function tourShow(i) {
  const T = S.tour, L = T.list; T.i = i = (i + L.length) % L.length; const s = L[i], el = $(".g3-tour");
  el.querySelector(".n").textContent = (i + 1) + "/" + L.length; el.querySelector(".kt").textContent = s.kat; el.querySelector("h3").textContent = s.t; el.querySelector("p").textContent = s.d;
  el.querySelector(".pg i").style.width = ((i + 1) / L.length * 100) + "%";
  const port = S.vw / S.vh < .9;
  if (s.ll) { const x = X(s.ll[1]), z = Z(s.ll[0]), m = S.marks.find(q => Math.hypot(q.x - x, q.z - z) < .05);
    if (S.sel) S.sel.el.classList.remove("sel"); S.sel = m || null; if (m) m.el.classList.add("sel"); $(".g3-card").classList.add("off");
    fly({ t: new THREE.Vector3(x, hAt(x, z) * S.ex, z), r: port ? 30 : 19, phi: 60 * DEG, theta: S.home.theta + .55 * Math.sin(i * 1.3) + (i % 2 ? .35 : -.25) }, 2600);
  } else if (s.b) { const cx = X((s.b[0][1] + s.b[1][1]) / 2), cz = Z((s.b[0][0] + s.b[1][0]) / 2), sz = Math.max(Math.abs(X(s.b[1][1]) - X(s.b[0][1])), Math.abs(Z(s.b[1][0]) - Z(s.b[0][0])));
    select(null); const whole = sz > 40; fly(whole ? { ...S.home, theta: S.home.theta + .5 } : { t: new THREE.Vector3(cx, 0, cz), r: Math.max(30, sz * (port ? 3.4 : 2.1)), phi: 52 * DEG, theta: S.home.theta - .5 }, 2800); }
  clearTimeout(T.timer); if (T.playing) T.timer = setTimeout(() => { if (T.i < L.length - 1) tourShow(T.i + 1); else tourPlay(false); }, 7500);
}
function tourPlay(p) { const T = S.tour; if (!T) return; T.playing = p; const b = $('[data-a="tplay"]'); b.innerHTML = p ? IC.pause : IC.play; b.setAttribute("aria-label", p ? "Jeda" : "Putar"); clearTimeout(T.timer); if (p) T.timer = setTimeout(() => tourShow(T.i + 1), 7500); }
function tourStart() { const list = (O.tour || []).filter(s => s.ll || s.b); if (!list.length) return; const fw = !$(".g3-flow").classList.contains("off"); setRot(false); setFlow(false); select(null); S.tour = { list, i: 0, playing: true, timer: null, fw }; syncVO(); $(".g3-tour").classList.remove("off"); $('[data-a="tplay"]').innerHTML = IC.pause; tourShow(0); }
function tourEnd() { if (!S.tour) return; clearTimeout(S.tour.timer); const fw = S.tour.fw; S.tour = null; $(".g3-tour").classList.add("off"); if (S.sel) { S.sel.el.classList.remove("sel"); S.sel = null; } if (fw && S.vw > 1100) setFlow(true); else syncVO(); }

// ---------- perulangan gambar
function start() { if (S.running) return; S.running = true; S.last = S.lastFlow = performance.now(); S.lastDraw = 0; requestAnimationFrame(frame); }
function frame(now) {
  if (!S || !S.running) return; requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - S.last) / 1000); S.last = now;
  if (S.anim) { const A = S.anim, k = Math.min(1, (now - A.t0) / A.ms), e = ease(k), a = A.a, to = A.to;
    setCam({ t: a.t.clone().lerp(to.t, e), r: a.r * Math.pow(to.r / a.r, e), phi: a.phi + (to.phi - a.phi) * e, theta: a.theta + A.d * e }); if (k >= 1) S.anim = null; }
  else if (S.controls.update()) S.need = true;
  if (S.voT && (Math.abs(S.vo[0] - S.voT[0]) > .5 || Math.abs(S.vo[1] - S.voT[1]) > .5)) { const k = Math.min(1, dt * 7); applyVO(S.vo[0] + (S.voT[0] - S.vo[0]) * k, S.vo[1] + (S.voT[1] - S.vo[1]) * k); }
  const flowing = !S.lite && !S.reduce && !S.noFlow && S.flows.length;
  if (flowing && now - S.lastFlow >= 30) { const off = (S.fo = ((S.fo || 0) - Math.min(.1, (now - S.lastFlow) / 1000) * 1.5) % 1.16); S.lastFlow = now; S.flows.forEach(m => m.dashOffset = off); S.need = true; }
  if (S.controls.autoRotate) S.need = true;
  if (!S.need) return; S.need = false;
  if (flowing && !S.anim && now - S.lastDraw < 400) { S.slow = (S.slow || 0) * .9 + (now - S.lastDraw > 55 ? 1 : 0); if (S.slow > 7) degrade(); }
  S.lastDraw = now;
  S.renderer.render(S.scene, S.camera); labels();
  const az = Math.atan2(S.camera.position.x - S.controls.target.x, S.camera.position.z - S.controls.target.z); $(".g3-cmp svg").style.transform = `rotate(${(az / DEG).toFixed(1)}deg)`;
  if (S.probe) { V.set(S.probe.x, S.probe.h * S.ex, S.probe.z).project(S.camera); const px = (V.x * .5 + .5) * S.vw, pe = $(".g3-probe"); pe.style.transform = `translate3d(${px.toFixed(1)}px,${((-V.y * .5 + .5) * S.vh).toFixed(1)}px,0)`; pe.classList.toggle("l", px > S.vw * .52); }
}

function degrade() {
  S.slow = 0; const pr = S.renderer.getPixelRatio();
  if (pr > 1.05) { S.renderer.setPixelRatio(Math.max(1, pr * .7)); S.renderer.setSize(S.vw, S.vh, false); }
  else { S.noFlow = true; S.flows.forEach(m => m.visible = false); }
  S.need = true;
}

// ---------- aksi UI
function onClick(e) {
  const tx = e.target.closest("[data-tex]"); if (tx && S) return setTex(tx.dataset.tex);
  const nd = e.target.closest("[data-n]"); if (nd && S) { const m = S.marks.find(q => q.name === nd.dataset.n); if (m) select(m, true); return; }
  const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
  if (a === "close") return close();
  if (!S) return;
  if (a === "rot") setRot(!S.controls.autoRotate);
  else if (a === "reset") { tourEnd(); select(null); setRot(false); fly(S.home, 1400); }
  else if (a === "north") { const c = camState(); fly({ ...c, theta: 0 }, 900); }
  else if (a === "flow") setFlow($(".g3-flow").classList.contains("off"));
  else if (a === "flowx") setFlow(false);
  else if (a === "cardx") select(null);
  else if (a === "near" && S.sel) { const m = S.sel; fly({ t: new THREE.Vector3(m.x, m.y * S.ex, m.z), r: 9, phi: 62 * DEG, theta: camState().theta + .5 }, 1500); }
  else if (a === "to2d" && S.sel) { const n = S.sel.name; close(); O.focus && setTimeout(() => O.focus(n), 250); }
  else if (a === "snap") snap();
  else if (a === "tour") S.tour ? tourEnd() : tourStart();
  else if (a === "tend") tourEnd();
  else if (a === "tnext") tourShow(S.tour.i + 1);
  else if (a === "tprev") tourShow(S.tour.i - 1);
  else if (a === "tplay") tourPlay(!S.tour.playing);
}
function onKey(e) { if (!root || !root.classList.contains("on")) return; if (e.key === "Escape") { e.stopPropagation(); if (S && S.tour) tourEnd(); else if (S && S.sel) select(null); else close(); } }
function onPop() { if (root && root.classList.contains("on") && !(history.state && history.state.g3d)) close(true); }

function showProbe(h, label) {
  const el = $(".g3-probe"), la = LAT(h.z), lo = LON(h.x); S.probe = h;
  el.querySelector("span").innerHTML = (label ? `<b>${esc(label)}</b> · ${nf(h.h * 1000)} m dpl` : `<b>${nf(h.h * 1000)} m dpl</b> · ${nf(Math.abs(la), 4)}° ${la < 0 ? "LS" : "LU"}, ${nf(lo, 4)}° BT`);
  el.classList.remove("off"); clearTimeout(probe.t); probe.t = setTimeout(() => { el.classList.add("off"); S.probe = null; }, label ? 12000 : 6000); S.need = true;
}
function goAt(at) {
  const m = S.marks.find(q => q.name === at.name); if (m) return select(m, true);
  const x = X(at.ll[1]), z = Z(at.ll[0]); if (Math.abs(x) > SX / 2 || Math.abs(z) > SZ / 2) return fly(S.home, 1600);
  const h = hAt(x, z); select(null); fly({ t: new THREE.Vector3(x, h * S.ex, z), r: S.vw / S.vh < .9 ? 20 : 13, phi: 58 * DEG, theta: S.home.theta + .4 }, 1900);
  showProbe({ x, z, h }, shortName(at.name || ""));
}
export async function open(opts) {
  O = opts || O || {}; shell();
  const at = O.at; O.at = null;
  if (root.classList.contains("on")) return;
  root.classList.add("on"); document.body.classList.add("g3on");
  try { if (!(history.state && history.state.g3d)) { const u = location.pathname + location.search; if (location.hash === "#3d") history.replaceState(history.state, "", u); history.pushState({ g3d: 1 }, "", u + "#3d"); } } catch (e) {}
  if (!open.bound) { open.bound = true; document.addEventListener("keydown", onKey, true); window.addEventListener("popstate", onPop); }
  const ld = $(".g3-load");
  if (!S) {
    try { ld.classList.remove("err"); root.classList.remove("fail"); await build(); }
    catch (e) { S = null; ld.classList.add("err"); root.classList.add("fail"); $(".g3-load .ms").textContent = e.message === "nowebgl" ? "Perangkat atau browser ini tidak mendukung tampilan 3D (WebGL)." : "Gagal memuat data 3D. Periksa koneksi lalu coba lagi."; console.warn("[3D]", e); return; }
    S.reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (S.vw > 1100) setFlow(true);
    try { $('[data-a="close"]').focus({ preventScroll: true }); } catch (e) {}
    start(); S.renderer.render(S.scene, S.camera);
    requestAnimationFrame(() => { root.classList.add("ready"); setTimeout(() => { if (at) goAt(at); else fly(S.home, 2600); hint(true); }, 250); });
  } else { resize(); refreshLive(); start(); S.need = true; if (at) goAt(at); }
  if (O.onOpen) try { O.onOpen(); } catch (e) {}
}
export function close(fromPop) {
  if (!root || !root.classList.contains("on")) return;
  root.classList.remove("on"); document.body.classList.remove("g3on");
  if (S) { S.running = false; tourEnd(); setRot(false); select(null); S.anim = null; }
  if (!fromPop) try { if (history.state && history.state.g3d) history.back(); } catch (e) {}
}
window.Geo3D = { open, close, refresh: () => { try { refreshLive(); } catch (e) {} }, isOpen: () => !!(root && root.classList.contains("on")), _s: () => S };
