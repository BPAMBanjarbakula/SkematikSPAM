// OPS Bakula – aplikasi logsheet operator (tahap 1: Intake Mandi Kapau)
// Data dikirim ke /api/ops (Netlify) → Apps Script → Google Sheet "Logsheet Operasional Intake dan BGT".
// Bila sinyal hilang, kiriman disimpan di antrean HP dan dikirim otomatis saat sinyal kembali.
(function () {
  "use strict";
  var API = "/api/ops";
  var JAM_MULAI = 7;                       // hari laporan intake mulai 07.00
  var URUT_JAM = []; for (var h = 0; h < 24; h++) URUT_JAM.push((h + JAM_MULAI) % 24);
  var STATUS = ["ON", "OFF", "STANDBY", "RUSAK"];
  var ASET = [["INT-PLN", "Sambungan PLN 1000 kVA"], ["INT-PNL", "Panel utama"], ["INT-P1", "Pompa intake 1"], ["INT-P2", "Pompa intake 2"],
    ["INT-P3", "Pompa intake 3"], ["INT-P4", "Pompa intake 4"], ["", "Lainnya / tidak spesifik"]];
  var JENIS = ["Trip pompa", "PLN padam", "Penggantian pompa", "Perbaikan / pemeliharaan", "Kebocoran pipa",
    "Gangguan panel / kelistrikan", "Kualitas air baku (keruh)", "Lainnya"];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $("#app");
  var simpan = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var ambil = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var dua = function (n) { return ("0" + n).slice(-2); };
  var num = function (s) { if (s == null || String(s).trim() === "") return null; var n = Number(String(s).replace(",", ".")); return isFinite(n) ? n : NaN; };
  var fmt = function (n) { return n == null || n === "" ? "–" : String(n).replace(".", ","); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };
  var isoTgl = function (d) { return d.getFullYear() + "-" + dua(d.getMonth() + 1) + "-" + dua(d.getDate()); };
  var tglLaporanSekarang = function () { var d = new Date(); if (d.getHours() < JAM_MULAI) d.setDate(d.getDate() - 1); return isoTgl(d); };
  var kunci = function (tgl, jam) { return Number(String(tgl).replace(/-/g, "")) * 100 + (jam < JAM_MULAI ? jam + 24 : jam); };
  var shift = function (jam) { return jam >= 16 ? "Siang" : jam >= 8 ? "Pagi" : "Malam"; };
  var tglIndo = function (s) { var p = s.split("-"); var b = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]; return Number(p[2]) + " " + b[Number(p[1]) - 1] + " " + p[0]; };

  // ---------- umum ----------
  function toast(t, ms) { var e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, ms || 2800); }
  function sheet(html) {
    $("#sheet").innerHTML = '<div class="in">' + html + "</div>"; $("#sheet").classList.add("on"); $("#ov").classList.add("on");
  }
  function tutupSheet() { $("#sheet").classList.remove("on"); $("#ov").classList.remove("on"); }
  $("#ov").onclick = tutupSheet;
  function net() { var on = navigator.onLine; var e = $("#net"); e.textContent = on ? "● Online" : "● Offline"; e.classList.toggle("off", !on); }
  window.addEventListener("online", function () { net(); kirimAntrean(); });
  window.addEventListener("offline", net);

  function panggil(data) {
    var akun = ambil("ops_akun", null);
    data.pin = data.pin || (akun && akun.pin);
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok && j.kode === "PIN" && data.aksi !== "masuk") { keluar(true); } return j; });
  }

  // ---------- antrean offline ----------
  function antrean() { return ambil("ops_antrean", []); }
  function kirimAntrean() {
    if (kirimAntrean.jalan || !navigator.onLine) return;
    var q = antrean(); if (!q.length) return;
    kirimAntrean.jalan = true;
    var item = q[0];
    panggil(item.req).then(function (j) {
      var q2 = antrean().filter(function (x) { return x.req.id !== item.req.id; });
      simpan("ops_antrean", q2);
      if (!j.ok) { var g = ambil("ops_gagal", []); g.push({ ket: item.ket, err: j.err, req: item.req }); simpan("ops_gagal", g); toast("Kiriman " + item.ket + " ditolak: " + j.err, 6000); }
      else toast("Terkirim dari antrean: " + item.ket);
      kirimAntrean.jalan = false; perbaruiInfoAntrean(); kirimAntrean();
    }).catch(function () { kirimAntrean.jalan = false; });
  }
  setInterval(kirimAntrean, 60000);
  function perbaruiInfoAntrean() { var e = $("#infoAntrean"); if (e) e.innerHTML = infoAntreanHtml(); }
  function infoAntreanHtml() {
    var q = antrean().length, g = ambil("ops_gagal", []).length, s = "";
    if (q) s += '<div class="note wr">⏳ ' + q + " kiriman menunggu sinyal. Akan terkirim otomatis.</div>";
    if (g) s += '<div class="note er">⚠ ' + g + ' kiriman ditolak server. <button class="btn sm sec" data-act="lihatGagal">Lihat</button></div>';
    return s;
  }
  function kirim(req, ket) {
    req.id = req.id || uid();
    if (!navigator.onLine) { var q = antrean(); q.push({ req: req, ket: ket }); simpan("ops_antrean", q); return Promise.resolve({ ok: true, antre: true }); }
    return panggil(req).catch(function () { var q = antrean(); q.push({ req: req, ket: ket }); simpan("ops_antrean", q); return { ok: true, antre: true }; });
  }

  // ---------- masuk ----------
  function layarMasuk() {
    $("#sub").textContent = "Logsheet operator SPAM";
    var pin = "";
    app.innerHTML = '<div class="card" style="text-align:center"><h2>Masuk</h2><p class="muted">Masukkan PIN operator Anda</p>' +
      '<div class="pin" id="dots"></div><div class="pad" id="pad"></div><p class="muted" id="pesan" style="margin-top:14px"></p></div>' +
      '<p class="muted" style="text-align:center">PIN diberikan oleh koordinator. Lupa PIN? Hubungi koordinator.</p>';
    var tombol = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];
    $("#pad").innerHTML = tombol.map(function (t) { return "<button>" + t + "</button>"; }).join("");
    var gambar = function () { var s = ""; for (var i = 0; i < 6; i++) s += '<span class="' + (i < pin.length ? "f" : "") + '"></span>'; $("#dots").innerHTML = s; };
    gambar();
    $("#pad").onclick = function (e) {
      var t = e.target.textContent; if (e.target.tagName !== "BUTTON") return;
      if (t === "⌫") pin = pin.slice(0, -1);
      else if (t === "OK") return coba();
      else if (pin.length < 8) pin += t;
      gambar();
      if (pin.length === 6) coba();
    };
    function coba() {
      if (pin.length < 4) return;
      $("#pesan").textContent = "Memeriksa…";
      panggil({ aksi: "masuk", pin: pin }).then(function (j) {
        if (!j.ok) { $("#pesan").textContent = j.err || "Gagal masuk"; pin = ""; gambar(); return; }
        simpan("ops_akun", { pin: pin, nama: j.nama, peran: j.peran, lokasi: j.lokasi });
        toast("Selamat bertugas, " + j.nama); beranda();
      }).catch(function () { $("#pesan").textContent = "Tidak ada sinyal. Masuk pertama kali perlu internet."; pin = ""; gambar(); });
    }
  }
  function keluar(paksa) {
    localStorage.removeItem("ops_akun");
    if (paksa) toast("PIN tidak berlaku lagi. Silakan masuk ulang.", 5000);
    layarMasuk();
  }

  // ---------- beranda ----------
  function beranda() {
    var akun = ambil("ops_akun", null); if (!akun) return layarMasuk();
    $("#sub").textContent = akun.nama + " · " + (akun.peran || "Operator");
    app.innerHTML = '<h2>Selamat bertugas</h2><div id="infoAntrean">' + infoAntreanHtml() + "</div>" +
      '<div class="tiles">' +
      '<button class="tile" data-act="intake"><span class="ic">💧</span><span><b>Logsheet Intake</b><small>Intake Mandi Kapau · pembacaan per jam</small></span></button>' +
      '<button class="tile" data-act="kejadian"><span class="ic">⚠️</span><span><b>Lapor Kejadian</b><small>Trip pompa, PLN padam, kebocoran, perbaikan</small></span></button>' +
      '<button class="tile dis" disabled><span class="ic">🔁</span><span><b>Logsheet BGT</b><small>Booster Ground Transfer</small></span><span class="badge">Segera</span></button>' +
      '<button class="tile dis" disabled><span class="ic">📊</span><span><b>Analisa Mingguan</b><small>Kondisi pompa & M/E</small></span><span class="badge">Segera</span></button>' +
      "</div>" +
      '<div style="margin-top:22px" class="row"><button class="btn sec sm" data-act="keluar">Keluar</button><span class="muted">Versi 1 · Intake</span></div>';
    kirimAntrean();
  }

  // ---------- logsheet intake ----------
  var F = null;   // isian form
  var ST = ambil("ops_status_intake", null);  // status terakhir dari sheet (juga dipakai saat offline)

  function formBaru() {
    var d = new Date();
    return { tanggal: tglLaporanSekarang(), jam: d.getHours(), lwbp: "", wbp: "", kvarh: "", v: "", a: "", hz: "", cos: "",
      pompa: [0, 1, 2, 3].map(function () { return { st: "", tek: "", v: "", a: "", hz: "" }; }), tekJar: "", debit: "", catatan: "" };
  }
  function simpanDraf() { simpan("ops_draf_intake", F); }

  function intake() {
    F = ambil("ops_draf_intake", null) || formBaru();
    gambarIntake();
    muatStatus();
  }
  function muatStatus() {
    if (!navigator.onLine) return;
    panggil({ aksi: "status_intake", tanggal: F.tanggal }).then(function (j) {
      if (!j.ok) return;
      j.tanggal = F.tanggal; ST = j; simpan("ops_status_intake", j); gambarChips(); cekLangsung();
    }).catch(function () {});
  }
  function inp(id, label, val, opt) {
    opt = opt || {};
    return '<label class="f" id="w_' + id + '">' + label + '<input id="' + id + '" inputmode="decimal" autocomplete="off" value="' + esc(val) + '"' +
      (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : "") + '><span class="hint" id="h_' + id + '">' + (opt.hint || "") + "</span></label>";
  }
  function gambarIntake() {
    var t = ST && ST.terakhir;
    var opsJam = URUT_JAM.map(function (h) { return '<option value="' + h + '"' + (h === Number(F.jam) ? " selected" : "") + ">" + dua(h) + ".00</option>"; }).join("");
    var h = '<button class="back" data-act="beranda">‹ Beranda</button><h2>Logsheet Intake Mandi Kapau</h2>' +
      '<div id="infoAntrean">' + infoAntreanHtml() + "</div>" +
      '<div class="card"><div class="grid"><label class="f">Tanggal laporan<input type="date" id="tanggal" value="' + F.tanggal + '"></label>' +
      '<label class="f">Jam pembacaan<select id="jam">' + opsJam + "</select></label></div>" +
      '<p class="muted" style="margin-top:8px"><b id="tglTx">' + tglIndo(F.tanggal) + '</b> · Shift <b id="shiftTx">' + shift(Number(F.jam)) + "</b>. Pembacaan 00.00–06.00 tetap memakai tanggal laporan hari sebelumnya, sama seperti form kertas.</p>" +
      '<div style="margin-top:10px"><div class="muted" style="margin-bottom:6px">Jam yang sudah terisi:</div><div class="chips" id="chips"></div></div></div>' +
      (t ? '<button class="btn sec" data-act="salin" style="margin-bottom:12px">↻ Salin kondisi pompa dari jam terakhir (' + dua(t.jam) + ".00)</button>" : "") +
      '<div class="card"><h3>⚡ PLN 1000 kVA <span class="tag">stan meter</span></h3><div class="grid g3">' +
      inp("lwbp", "LWBP", F.lwbp, { hint: t ? "lalu: " + fmt(t.lwbp) : "" }) + inp("wbp", "WBP", F.wbp, { hint: t ? "lalu: " + fmt(t.wbp) : "" }) +
      inp("kvarh", "kVARh", F.kvarh, { hint: t ? "lalu: " + fmt(t.kvarh) : "" }) + "</div></div>" +
      '<div class="card"><h3>🔌 Panel utama</h3><div class="grid">' + inp("v", "Tegangan (V)", F.v) + inp("a", "Arus (A)", F.a) +
      inp("hz", "Frekuensi (Hz)", F.hz) + inp("cos", "Cos φ", F.cos) + "</div></div>";
    for (var i = 0; i < 4; i++) {
      var p = F.pompa[i];
      h += '<div class="card pompa st-' + (p.st || "x") + '" id="pc' + i + '"><h3>Pompa air baku ' + (i + 1) +
        '<span class="tag">' + (t && t.pompa[i].st ? "lalu: " + esc(t.pompa[i].st) : "") + '</span></h3><div class="seg" data-i="' + i + '">' +
        STATUS.map(function (s) { return '<button data-v="' + s + '" class="' + (p.st === s ? "on" : "") + '">' + s + "</button>"; }).join("") +
        '</div><div class="isi" id="pi' + i + '" style="display:' + (p.st === "ON" ? "block" : "none") + '"><div class="grid">' +
        inp("p" + i + "tek", "Tekanan (kg/cm²)", p.tek) + inp("p" + i + "a", "Arus (A)", p.a) + inp("p" + i + "v", "Tegangan (V)", p.v) + inp("p" + i + "hz", "Frekuensi (Hz)", p.hz) +
        "</div></div></div>";
    }
    h += '<div class="card"><h3>🚰 Jaringan</h3><div class="grid">' + inp("tekJar", "Tekanan jaringan (kg/cm²)", F.tekJar) + inp("debit", "Debit (L/dtk)", F.debit, { hint: "isi bila flowmeter terbaca" }) + "</div></div>" +
      '<div class="card"><label class="f">Catatan (opsional)<textarea id="catatan" placeholder="Kondisi khusus, bunyi tidak normal, dsb.">' + esc(F.catatan) + "</textarea></label></div>" +
      '<div class="bar"><div class="in"><button class="btn sec" data-act="bersihkan" style="flex:0 0 32%">Kosongkan</button><button class="btn" data-act="kirimIntake">Kirim jam ' + dua(Number(F.jam)) + ".00</button></div></div>";
    app.innerHTML = h;
    gambarChips(); cekLangsung();
  }
  function gambarChips() {
    var e = $("#chips"); if (!e) return;
    var isi = {};
    if (ST && ST.tanggal === F.tanggal) (ST.terisi || []).forEach(function (x) { isi[x.jam] = x; });
    antrean().forEach(function (q) { if (q.req.aksi === "kirim_intake" && q.req.data.tanggal === F.tanggal) isi[q.req.data.jam] = { antre: true }; });
    e.innerHTML = URUT_JAM.map(function (h) {
      var x = isi[h], c = x ? (x.antre ? "wr" : (x.cekStan === "OK" && x.cekArus === "OK") ? "ok" : "wr") : "";
      return '<span class="chip ' + c + (h === Number(F.jam) ? " sel" : "") + '" title="' + (x && x.operator ? esc(x.operator) : "") + '">' + dua(h) + "</span>";
    }).join("");
  }
  function baca() {
    if (!$("#tanggal")) return;
    F.tanggal = $("#tanggal").value; F.jam = Number($("#jam").value);
    ["lwbp", "wbp", "kvarh", "v", "a", "hz", "cos", "tekJar", "debit"].forEach(function (k) { F[k] = $("#" + k).value.trim(); });
    F.catatan = $("#catatan").value;
    for (var i = 0; i < 4; i++) ["tek", "v", "a", "hz"].forEach(function (k) { F.pompa[i][k] = $("#p" + i + k).value.trim(); });
  }
  // pemeriksaan: kembalikan {galat:[...], peringatan:[...]}
  function periksa() {
    var g = [], w = [], tandai = {};
    var wajib = [["lwbp", "Stan LWBP"], ["wbp", "Stan WBP"], ["kvarh", "Stan kVARh"], ["v", "Tegangan panel"], ["a", "Arus panel"], ["hz", "Frekuensi panel"]];
    if (!F.tanggal) g.push("Tanggal laporan belum diisi");
    wajib.forEach(function (x) { var n = num(F[x[0]]); if (n === null) { g.push(x[1] + " belum diisi"); tandai[x[0]] = "err"; } else if (isNaN(n)) { g.push(x[1] + " bukan angka"); tandai[x[0]] = "err"; } });
    ["cos", "tekJar", "debit"].forEach(function (k) { if (isNaN(num(F[k]))) { g.push("Isian " + k + " bukan angka"); tandai[k] = "err"; } });
    var on = 0;
    F.pompa.forEach(function (p, i) {
      if (!p.st) g.push("Status pompa " + (i + 1) + " belum dipilih");
      if (p.st !== "ON") return;
      on++;
      [["tek", "tekanan"], ["a", "arus"], ["v", "tegangan"], ["hz", "frekuensi"]].forEach(function (x) {
        var n = num(p[x[0]]);
        if (n === null || isNaN(n)) { g.push("Pompa " + (i + 1) + ": " + x[1] + " belum diisi"); tandai["p" + i + x[0]] = "err"; }
      });
      var a = num(p.a);
      if (ST && ST.batas && a != null && !isNaN(a) && (a < ST.batas.arusMin || a > ST.batas.arusMax)) {
        w.push("Arus pompa " + (i + 1) + " = " + fmt(a) + " A, di luar batas " + ST.batas.arusMin + "–" + ST.batas.arusMax + " A");
        tandai["p" + i + "a"] = "warn";
      }
    });
    if (F.pompa.every(function (p) { return p.st; }) && on === 0) w.push("Tidak ada pompa yang ON");
    var t = ST && ST.terakhir;
    if (t && F.tanggal && kunci(t.tanggal, t.jam) < kunci(F.tanggal, Number(F.jam))) {
      [["lwbp", "LWBP"], ["wbp", "WBP"], ["kvarh", "kVARh"]].forEach(function (x) {
        var n = num(F[x[0]]), lalu = Number(t[x[0]]);
        if (n != null && !isNaN(n) && t[x[0]] !== "" && n < lalu) { w.push("Stan " + x[1] + " " + fmt(n) + " lebih kecil dari pembacaan lalu (" + fmt(lalu) + ")"); tandai[x[0]] = "warn"; }
        if (n != null && !isNaN(n) && t[x[0]] !== "" && n - lalu > 50) { w.push("Stan " + x[1] + " naik " + fmt(Math.round((n - lalu) * 100) / 100) + " sejak pembacaan lalu, periksa angka"); tandai[x[0]] = "warn"; }
      });
    }
    return { galat: g, peringatan: w, tandai: tandai };
  }
  function cekLangsung() {
    if (!$("#tanggal")) return;
    var r = periksa();
    document.querySelectorAll("label.f").forEach(function (l) { l.classList.remove("warn"); });
    Object.keys(r.tandai).forEach(function (k) { if (r.tandai[k] === "warn") { var l = $("#w_" + k); if (l) l.classList.add("warn"); } });
  }

  app.addEventListener("input", function (e) {
    if (!$("#tanggal")) return;
    var l = e.target.closest("label.f"); if (l) l.classList.remove("err");
    baca(); simpanDraf(); cekLangsung();
  });
  app.addEventListener("change", function (e) {
    if (e.target.id === "tanggal") { baca(); simpanDraf(); if (F.tanggal) $("#tglTx").textContent = tglIndo(F.tanggal); gambarChips(); muatStatus(); }
    if (e.target.id === "jam") { baca(); simpanDraf(); $("#shiftTx").textContent = shift(F.jam); gambarChips(); cekLangsung();
      document.querySelector('[data-act=kirimIntake]').textContent = "Kirim jam " + dua(F.jam) + ".00"; }
  });
  app.addEventListener("click", function (e) {
    var sb = e.target.closest(".seg button");
    if (sb) {
      var i = Number(sb.parentNode.dataset.i), v = sb.dataset.v; baca();
      F.pompa[i].st = v; simpanDraf();
      sb.parentNode.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === sb); });
      $("#pi" + i).style.display = v === "ON" ? "block" : "none";
      $("#pc" + i).className = "card pompa st-" + v;
      cekLangsung(); return;
    }
    var a = e.target.closest("[data-act]"); if (!a) return;
    var act = a.dataset.act;
    if (act === "beranda") beranda();
    else if (act === "intake") intake();
    else if (act === "kejadian") kejadian();
    else if (act === "keluar") { if (confirm("Keluar dari akun ini?")) keluar(); }
    else if (act === "lihatGagal") lihatGagal();
    else if (act === "salin") salin();
    else if (act === "bersihkan") { if (confirm("Kosongkan semua isian?")) { var tg = F.tanggal, jm = F.jam; F = formBaru(); F.tanggal = tg; F.jam = jm; simpanDraf(); gambarIntake(); } }
    else if (act === "kirimIntake") kirimIntake();
    else if (act === "kirimKejadian") kirimKejadian();
  });
  function salin() {
    var t = ST && ST.terakhir; if (!t) return;
    baca();
    ["v", "hz", "cos", "tekJar"].forEach(function (k) { if (!F[k]) F[k] = t[k] === "" ? "" : String(t[k]); });
    F.pompa = t.pompa.map(function (p, i) { var o = F.pompa[i]; return { st: p.st || o.st, tek: String(p.tek === "" ? "" : p.tek), v: String(p.v === "" ? "" : p.v), a: String(p.a === "" ? "" : p.a), hz: String(p.hz === "" ? "" : p.hz) }; });
    simpanDraf(); gambarIntake();
    toast("Kondisi pompa disalin. Stan meter dan arus tetap harus dibaca ulang.", 4500);
  }
  function kirimIntake() {
    baca();
    var r = periksa();
    if (r.galat.length) {
      Object.keys(r.tandai).forEach(function (k) { if (r.tandai[k] === "err") { var l = $("#w_" + k); if (l) l.classList.add("err"); } });
      sheet("<h2>Belum bisa dikirim</h2><ul>" + r.galat.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") +
        '</ul><button class="btn" onclick="document.getElementById(\'ov\').click()">Perbaiki</button>');
      return;
    }
    var isiCek = ST && ST.tanggal === F.tanggal && (ST.terisi || []).some(function (x) { return x.jam === F.jam; });
    var html = "<h2>Kirim jam " + dua(F.jam) + ".00?</h2><p class='muted'>" + tglIndo(F.tanggal) + " · shift " + shift(F.jam) + "</p>";
    if (isiCek) html += '<div class="note er" style="margin-top:10px">Jam ini sudah tercatat di sheet. Kiriman akan ditolak; hubungi koordinator bila perlu koreksi.</div>';
    if (r.peringatan.length) {
      html += '<div class="note wr" style="margin-top:10px"><b>Periksa dulu:</b><ul>' + r.peringatan.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") +
        '</ul>Bila angka sudah benar, tulis penjelasannya di catatan.</div><label class="f">Catatan<textarea id="catPeringatan">' + esc(F.catatan) + "</textarea></label>";
    }
    html += '<div class="row" style="margin-top:14px"><button class="btn sec" id="batal">Periksa lagi</button><button class="btn" id="yakin">Kirim</button></div>';
    sheet(html);
    $("#batal").onclick = tutupSheet;
    $("#yakin").onclick = function () {
      if (r.peringatan.length) {
        var c = $("#catPeringatan").value.trim();
        if (c.length < 5) { toast("Tulis penjelasan singkat di catatan dulu"); return; }
        F.catatan = c;
      }
      this.disabled = true;
      var data = JSON.parse(JSON.stringify(F)); data.jam = Number(data.jam);
      var ket = "Intake " + tglIndo(F.tanggal) + " jam " + dua(F.jam) + ".00";
      kirim({ aksi: "kirim_intake", data: data }, ket).then(function (j) {
        tutupSheet();
        if (!j.ok) { sheet("<h2>Ditolak</h2><div class='note er'>" + esc(j.err) + '</div><button class="btn" onclick="document.getElementById(\'ov\').click()">Tutup</button>'); return; }
        toast(j.antre ? "Tidak ada sinyal. Tersimpan di HP, dikirim otomatis nanti." : "Terkirim: " + ket, 4000);
        // jam berikutnya: pompa tetap, angka dikosongkan
        var lanjut = formBaru(); lanjut.tanggal = F.tanggal; lanjut.jam = (F.jam + 1) % 24;
        if (lanjut.jam === JAM_MULAI) { var d = new Date(F.tanggal + "T00:00:00"); d.setDate(d.getDate() + 1); lanjut.tanggal = isoTgl(d); }
        lanjut.pompa = F.pompa.map(function (p) { return { st: p.st, tek: "", v: "", a: "", hz: "" }; });
        if (!j.antre) {
          ST = ST || { terisi: [] };
          ST.terakhir = { tanggal: F.tanggal, jam: F.jam, lwbp: num(F.lwbp), wbp: num(F.wbp), kvarh: num(F.kvarh), v: F.v, a: F.a, hz: F.hz, cos: F.cos,
            pompa: F.pompa.map(function (p) { return { st: p.st, tek: p.tek, v: p.v, a: p.a, hz: p.hz }; }), tekJar: F.tekJar, debit: F.debit };
          simpan("ops_status_intake", ST);
        }
        F = lanjut; simpanDraf(); gambarIntake(); muatStatus(); window.scrollTo(0, 0);
      });
    };
  }
  function lihatGagal() {
    var g = ambil("ops_gagal", []);
    sheet("<h2>Kiriman ditolak</h2>" + g.map(function (x) { return '<div class="note er"><b>' + esc(x.ket) + "</b><br>" + esc(x.err) + "</div>"; }).join("") +
      '<p class="muted">Sampaikan ke koordinator agar dicatat manual bila perlu.</p><button class="btn" id="hapusGagal">Hapus daftar ini</button>');
    $("#hapusGagal").onclick = function () { simpan("ops_gagal", []); tutupSheet(); perbaruiInfoAntrean(); };
  }

  // ---------- lapor kejadian ----------
  function kejadian() {
    var d = new Date();
    app.innerHTML = '<button class="back" data-act="beranda">‹ Beranda</button><h2>Lapor Kejadian</h2>' +
      '<div class="card"><div class="grid"><label class="f">Tanggal<input type="date" id="kTgl" value="' + isoTgl(d) + '"></label>' +
      '<label class="f">Lokasi<select id="kLok"><option>Intake Mandi Kapau</option><option>Pipa transmisi</option></select></label>' +
      '<label class="f">Jam mulai<input type="time" id="kMulai" value="' + dua(d.getHours()) + ":" + dua(d.getMinutes()) + '"></label>' +
      '<label class="f">Jam selesai<input type="time" id="kSelesai"><span class="hint">kosongkan bila belum selesai</span></label></div>' +
      '<label class="f" style="margin-top:10px">Aset<select id="kAset">' + ASET.map(function (a) { return '<option value="' + a[0] + '">' + (a[0] ? a[0] + " · " : "") + a[1] + "</option>"; }).join("") + "</select></label>" +
      '<label class="f" style="margin-top:10px">Jenis kejadian<select id="kJenis"><option value="">— pilih —</option>' + JENIS.map(function (j) { return "<option>" + j + "</option>"; }).join("") + "</select></label>" +
      '<label class="f" style="margin-top:10px">Uraian kejadian<textarea id="kUraian" placeholder="Apa yang terjadi, kapan diketahui, dampaknya"></textarea></label>' +
      '<label class="f" style="margin-top:10px">Tindakan yang dilakukan<textarea id="kTindakan" placeholder="Langkah yang sudah diambil"></textarea></label></div>' +
      '<div class="bar"><div class="in"><button class="btn" data-act="kirimKejadian">Kirim laporan</button></div></div>';
  }
  function kirimKejadian() {
    var data = { tanggal: $("#kTgl").value, mulai: $("#kMulai").value, selesai: $("#kSelesai").value, lokasi: $("#kLok").value,
      aset: $("#kAset").value, jenis: $("#kJenis").value, uraian: $("#kUraian").value.trim(), tindakan: $("#kTindakan").value.trim() };
    if (!data.tanggal || !data.jenis || data.uraian.length < 5) { toast("Isi tanggal, jenis, dan uraian kejadian"); return; }
    kirim({ aksi: "kirim_kejadian", data: data }, "Kejadian " + data.jenis).then(function (j) {
      if (!j.ok) { toast("Ditolak: " + j.err, 5000); return; }
      toast(j.antre ? "Tidak ada sinyal. Laporan tersimpan di HP, dikirim otomatis nanti." : "Laporan kejadian terkirim", 4000);
      beranda();
    });
  }

  // ---------- mulai ----------
  net();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  beranda();
})();
