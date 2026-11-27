/**
 * OPS BAKULA – penghubung aplikasi operator ke Google Sheet
 * "Logsheet Operasional Intake dan BGT - BPAM Banjarbakula".
 *
 * Cara pasang (sekali saja, oleh pemilik sheet):
 * 1. Buka Google Sheet logsheet > Ekstensi > Apps Script.
 * 2. Hapus isi Code.gs, tempel seluruh isi file ini, Simpan.
 * 3. Terapkan > Deployment baru > jenis "Aplikasi web":
 *      Jalankan sebagai: Saya;  Yang memiliki akses: Siapa saja.
 *    Izinkan akses saat diminta, lalu salin URL aplikasi web (…/exec).
 * 4. Tempel URL itu di Netlify: Environment variables > OPS_SCRIPT_URL.
 *
 * Akun operator diatur di tab "Akun_Operator" (Nama, PIN, Peran, Lokasi, Aktif).
 * PIN diperiksa di sini, bukan di aplikasi.
 */

var TAB_INTAKE = 'Input_Intake';
var TAB_KEJADIAN = 'Kejadian';
var TAB_AKUN = 'Akun_Operator';
var TAB_DAFTAR = 'Daftar';
var BARIS_AWAL = 3;        // baris data pertama di Input_Intake
var JAM_MULAI_HARI = 7;    // hari laporan intake dimulai pukul 07.00
var MAKS_GAGAL = 30;       // percobaan PIN salah per 10 menit (seluruh aplikasi)

function doGet(e) { return keluaran({ ok: true, info: 'OPS BAKULA aktif' }); }

function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (x) { return keluaran({ ok: false, err: 'Data tidak terbaca' }); }
  return keluaran(tangani(p));
}

function keluaran(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function tangani(p) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cache = CacheService.getScriptCache();
    var gagal = Number(cache.get('pin_gagal') || 0);
    if (gagal >= MAKS_GAGAL) return { ok: false, err: 'Terlalu banyak PIN salah. Coba lagi 10 menit lagi.' };
    var akun = cariAkun(ss, p.pin);
    if (!akun) {
      cache.put('pin_gagal', String(gagal + 1), 600);
      return { ok: false, err: 'PIN salah atau akun tidak aktif', kode: 'PIN' };
    }
    switch (p.aksi) {
      case 'masuk': return { ok: true, nama: akun.nama, peran: akun.peran, lokasi: akun.lokasi };
      case 'status_intake': return statusIntake(ss, p);
      case 'kirim_intake': return kirimIntake(ss, p, akun);
      case 'kirim_kejadian': return kirimKejadian(ss, p, akun);
    }
    return { ok: false, err: 'Aksi tidak dikenal' };
  } catch (err) {
    return { ok: false, err: String((err && err.message) || err) };
  }
}

function cariAkun(ss, pin) {
  pin = String(pin || '').trim();
  if (!/^\d{4,8}$/.test(pin)) return null;
  var sh = ss.getSheetByName(TAB_AKUN);
  if (!sh || sh.getLastRow() < 2) return null;
  var rg = sh.getRange(2, 1, sh.getLastRow() - 1, 5);
  var v = rg.getDisplayValues(), mentah = rg.getValues();   // PIN dibaca sebagai teks agar angka 0 di depan tidak hilang
  for (var i = 0; i < v.length; i++) {
    var a = mentah[i][4], aktif = a === true || ['TRUE', 'YA', 'BENAR'].indexOf(String(a).toUpperCase()) >= 0;
    if (String(v[i][1]).trim() === pin && aktif) {
      return { nama: v[i][0], peran: v[i][2] || 'Operator', lokasi: v[i][3] || '' };
    }
  }
  return null;
}

// ---------- utilitas tanggal & urutan ----------
function zona(ss) { return ss.getSpreadsheetTimeZone() || 'Asia/Makassar'; }
function keTanggal(ss, s) { return Utilities.parseDate(s + ' 00:00', zona(ss), 'yyyy-MM-dd HH:mm'); }
function kunci(ss, tgl, jamPecahan) {
  // urutan dalam satu hari laporan: 07.00 … 23.00, lalu 00.00 … 06.00
  var t = (tgl instanceof Date) ? Utilities.formatDate(tgl, zona(ss), 'yyyyMMdd') : String(tgl).replace(/-/g, '');
  var j = jamDari(ss, jamPecahan);
  return Number(t) * 100 + (j < JAM_MULAI_HARI ? j + 24 : j);
}
function jamDari(ss, v) {
  if (v instanceof Date) return Number(Utilities.formatDate(v, zona(ss), 'H'));
  if (typeof v === 'number') return Math.round(v * 24) % 24;
  return Number(String(v).split(':')[0]);
}
function angka(x) {
  if (x === null || x === undefined || x === '') return '';
  var n = Number(String(x).replace(',', '.'));
  return isFinite(n) ? n : '';
}
function barisTerakhir(sh) {
  var n = sh.getMaxRows() - BARIS_AWAL + 1;
  var a = sh.getRange(BARIS_AWAL, 1, n, 1).getValues();
  for (var i = a.length - 1; i >= 0; i--) if (a[i][0] !== '' && a[i][0] !== null) return BARIS_AWAL + i;
  return BARIS_AWAL - 1;
}

// ---------- status untuk aplikasi ----------
function statusIntake(ss, p) {
  var sh = ss.getSheetByName(TAB_INTAKE);
  var d = ss.getSheetByName(TAB_DAFTAR).getRange('E2:E9').getValues();
  var akhir = barisTerakhir(sh);
  var hasil = { ok: true, batas: { arusMin: d[2][0], arusMax: d[3][0] }, terisi: [], terakhir: null };
  if (akhir < BARIS_AWAL) return hasil;
  var n = akhir - BARIS_AWAL + 1;
  var v = sh.getRange(BARIS_AWAL, 1, n, 36).getValues();
  var jamTampil = sh.getRange(BARIS_AWAL, 2, n, 1).getDisplayValues();   // jam dibaca dari teks "07:00" agar aman dari selisih zona waktu tahun 1899
  var tz = zona(ss), tglMinta = String(p.tanggal || '');
  var idxAkhir = -1, kAkhir = -1;
  for (var i = 0; i < v.length; i++) {
    if (v[i][0] === '') continue;
    var k = kunci(ss, v[i][0], jamTampil[i][0]);
    if (k > kAkhir) { kAkhir = k; idxAkhir = i; }
    if (Utilities.formatDate(v[i][0], tz, 'yyyy-MM-dd') === tglMinta) {
      hasil.terisi.push({ jam: jamDari(ss, jamTampil[i][0]), operator: v[i][3], cekStan: v[i][34], cekArus: v[i][35] });
    }
  }
  if (idxAkhir >= 0) {
    var r = v[idxAkhir];
    hasil.terakhir = {
      tanggal: Utilities.formatDate(r[0], tz, 'yyyy-MM-dd'), jam: jamDari(ss, jamTampil[idxAkhir][0]), operator: r[3],
      lwbp: r[4], wbp: r[5], kvarh: r[6], v: r[7], a: r[8], hz: r[9], cos: r[10],
      pompa: [0, 1, 2, 3].map(function (j) { var c = 11 + j * 5; return { st: r[c], tek: r[c + 1], v: r[c + 2], a: r[c + 3], hz: r[c + 4] }; }),
      tekJar: r[31], debit: r[32]
    };
  }
  return hasil;
}

// ---------- simpan pembacaan intake ----------
function kirimIntake(ss, p, akun) {
  var d = p.data || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) return { ok: false, err: 'Tanggal laporan tidak valid' };
  var jam = Number(d.jam);
  if (!(jam >= 0 && jam <= 23 && Math.floor(jam) === jam)) return { ok: false, err: 'Jam tidak valid' };
  var pompa = d.pompa || [];
  if (pompa.length !== 4) return { ok: false, err: 'Data pompa tidak lengkap' };
  var ST = ['ON', 'OFF', 'STANDBY', 'RUSAK'];
  for (var i = 0; i < 4; i++) if (ST.indexOf(pompa[i].st) < 0) return { ok: false, err: 'Status pompa ' + (i + 1) + ' belum dipilih' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, err: 'Server sibuk, coba kirim lagi' };
  try {
    var sh = ss.getSheetByName(TAB_INTAKE);
    var akhir = barisTerakhir(sh);
    var tz = zona(ss);
    var n = Math.max(0, akhir - BARIS_AWAL + 1);
    var blokA = n ? sh.getRange(BARIS_AWAL, 1, n, 2).getValues() : [];
    var blokJ = n ? sh.getRange(BARIS_AWAL, 2, n, 1).getDisplayValues() : [];
    var blokD = n ? sh.getRange(BARIS_AWAL, 4, n, 31).getValues() : [];
    var blokK = n ? sh.getRange(BARIS_AWAL, 37, n, 3).getValues() : [];

    // kiriman ulang dari antrean HP: anggap sudah tersimpan
    for (var i = 0; i < n; i++) if (p.id && blokK[i][0] === p.id) return { ok: true, ulang: true };
    // satu jam hanya boleh diisi sekali
    for (var i = 0; i < n; i++) {
      if (blokA[i][0] === '') continue;
      if (Utilities.formatDate(blokA[i][0], tz, 'yyyy-MM-dd') === d.tanggal && jamDari(ss, blokJ[i][0]) === jam) {
        return { ok: false, err: 'Jam ' + ('0' + jam).slice(-2) + '.00 tanggal ini sudah diisi oleh ' + (blokD[i][0] || 'operator lain') + '. Hubungi koordinator bila perlu koreksi.', kode: 'DUPLIKAT' };
      }
    }

    var barisA = [keTanggal(ss, d.tanggal), jam / 24];
    var barisD = [akun.nama, angka(d.lwbp), angka(d.wbp), angka(d.kvarh), angka(d.v), angka(d.a), angka(d.hz), angka(d.cos)];
    for (var j = 0; j < 4; j++) {
      var q = pompa[j], on = q.st === 'ON';
      barisD.push(q.st, on ? angka(q.tek) : '', on ? angka(q.v) : '', on ? angka(q.a) : '', on ? angka(q.hz) : '');
    }
    barisD.push(angka(d.tekJar), angka(d.debit), String(d.catatan || '').slice(0, 500));
    var barisK = [String(p.id || Utilities.getUuid()), new Date(), 'Aplikasi OPS'];

    var kBaru = kunci(ss, d.tanggal, jam / 24);
    var kAkhir = n ? kunci(ss, blokA[n - 1][0], blokJ[n - 1][0]) : -1;
    if (kBaru > kAkhir) {
      var r = akhir + 1;
      sh.getRange(r, 1, 1, 2).setValues([barisA]);
      sh.getRange(r, 4, 1, 31).setValues([barisD]);
      sh.getRange(r, 37, 1, 3).setValues([barisK]);
    } else {
      // kiriman terlambat (misalnya dari antrean offline): sisipkan lalu urutkan ulang
      var semua = [];
      for (var i = 0; i < n; i++) {
        var kosong = blokA[i][0] === '' || blokA[i][0] === null;   // baris kosong di tengah ditaruh paling bawah
        semua.push({ k: kosong ? Infinity : kunci(ss, blokA[i][0], blokJ[i][0]), a: blokA[i], d: blokD[i], x: blokK[i] });
      }
      semua.push({ k: kBaru, a: barisA, d: barisD, x: barisK });
      semua.sort(function (u, w) { return u.k === w.k ? 0 : (u.k < w.k ? -1 : 1); });
      sh.getRange(BARIS_AWAL, 1, n + 1, 2).setValues(semua.map(function (o) { return o.a; }));
      sh.getRange(BARIS_AWAL, 4, n + 1, 31).setValues(semua.map(function (o) { return o.d; }));
      sh.getRange(BARIS_AWAL, 37, n + 1, 3).setValues(semua.map(function (o) { return o.x; }));
    }
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ---------- simpan kejadian ----------
function kirimKejadian(ss, p, akun) {
  var d = p.data || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) return { ok: false, err: 'Tanggal tidak valid' };
  if (!d.jenis || !d.uraian) return { ok: false, err: 'Jenis dan uraian kejadian wajib diisi' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, err: 'Server sibuk, coba kirim lagi' };
  try {
    var sh = ss.getSheetByName(TAB_KEJADIAN);
    var a = sh.getRange(2, 11, Math.max(1, sh.getMaxRows() - 1), 1).getValues();
    for (var i = 0; i < a.length; i++) if (p.id && a[i][0] === p.id) return { ok: true, ulang: true };
    var col = sh.getRange(2, 1, sh.getMaxRows() - 1, 1).getValues();
    var r = 2;
    for (var i = col.length - 1; i >= 0; i--) if (col[i][0] !== '' && col[i][0] !== null) { r = i + 3; break; }
    var jamKe = function (s) { if (!/^\d{1,2}:\d{2}$/.test(String(s || ''))) return ''; var t = s.split(':'); return (Number(t[0]) * 60 + Number(t[1])) / 1440; };
    sh.getRange(r, 1, 1, 11).setValues([[
      keTanggal(ss, d.tanggal), jamKe(d.mulai), jamKe(d.selesai), d.lokasi || 'Intake Mandi Kapau', d.aset || '',
      d.jenis, String(d.uraian).slice(0, 1000), String(d.tindakan || '').slice(0, 1000), akun.nama, false, String(p.id || '')
    ]]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
