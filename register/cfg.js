// Pola nomor tiap tab register. n = nomor urut (otomatis), Y = tahun, p = bagian yang boleh diisi.
var BULAN=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
var CFG={
 "0":{nama:"Bon Permintaan & Pesanan",parts:[],
  num:function(p,n,Y){return "900.1.3.3/"+n+"/BPAM-BANJARBAKULA/"+Y},
  re:function(p){return /^900\.1\.3\.3\/(\d+)\/BPAM-BANJARBAKULA\/(\d{4})$/}},
 "669272993":{nama:"Berita Acara",parts:[],
  num:function(p,n,Y){return "900.1.7.2/"+n+"/BPAM-BANJARBAKULA/"+Y},
  re:function(p){return /^900\.1\.7\.2\/(\d+)\/BPAM-BANJARBAKULA\/(\d{4})$/}},
 "1146793795":{nama:"E-Katalog",parts:[{k:"J",label:"Jenis dokumen",opts:["SP","SPJ","SPK","BAPB","BAUC","BAST","BAPP","BAP","BAPAHP"]},{k:"K",label:"Kode paket (setelah ECAT-)",kode:/^\d+[A-Z]?\/[A-Z]+\/ECAT-(.+)\/BPAM\/\d{4}$/}],
  num:function(p,n,Y){return n+"/"+p.J+"/ECAT-"+p.K+"/BPAM/"+Y},
  re:function(p){return /^(\d+)[A-Z]?\/[A-Z]+\/ECAT-.+\/BPAM\/(\d{4})$/}},
 "1148303820":{nama:"Pengadaan Langsung",parts:[{k:"T",label:"Jenis nomor",opts:["PL","ST PPK"]},{k:"K",label:"Kode paket",kode:/^\d+\/PL\/(.+)\/BPAM\/\d{4}$/,hide:function(p){return p.T==="ST PPK"}}],
  num:function(p,n,Y){return p.T==="ST PPK"?n+"/ST/PPK-BPAM/"+Y:n+"/PL/"+p.K+"/BPAM/"+Y},
  re:function(p){return p.T==="ST PPK"?/^(\d+)\/ST\/PPK-BPAM\/(\d{4})$/:/^(\d+)\/PL\/.+\/BPAM\/(\d{4})$/}},
 "1148304100":{nama:"FHO",parts:[{k:"M",label:"Metode",opts:["PL","EP"]},{k:"K",label:"Kode paket",kode:/^\d+\/FHO\/[A-Z]+\/(.+)\/BPAM\/\d{4}$/}],
  num:function(p,n,Y){return n+"/FHO/"+p.M+"/"+p.K+"/BPAM/"+Y},
  re:function(p){return /^(\d+)\/FHO\/.+\/BPAM\/(\d{4})$/}},
 "1148303899":{nama:"Surat Pejabat Pengadaan",parts:[],
  num:function(p,n,Y){return n+"/PPBJ/BPAMB/"+Y},
  re:function(p){return /^(\d+)\/PPBJ\/BPAMB\/(\d{4})$/}},
 "555000111":{nama:"Berkas < Rp50 Jt",parts:[{k:"J",label:"Jenis dokumen",opts:["ND","SPPBJ","SP","SPK","BAST","BAPHP","BAP","BASTT"]},{k:"K",label:"Kode paket",kode:/^\d+\/[A-Z]+-(.+)\/BPAMB\/\d{4}$/}],
  num:function(p,n,Y){return n+"/"+p.J+"-"+p.K+"/BPAMB/"+Y},
  re:function(p){return /^(\d+)\/[A-Z]+-.+\/BPAMB\/(\d{4})$/}}
};
function pad3(x){x=String(x);while(x.length<3)x="0"+x;return x}
// nomor urut berikutnya = terbesar di seri & tahun yang sama + 1
function nextSeq(nomorList,c,p,Y){var re=c.re(p),mx=0;for(var i=0;i<nomorList.length;i++){var m=String(nomorList[i]).trim().match(re);if(m&&m[2]==Y&&+m[1]>mx)mx=+m[1]}return pad3(mx+1)}
function cekParts(c,p){for(var i=0;i<c.parts.length;i++){var d=c.parts[i];if(d.hide&&d.hide(p))continue;var v=(p[d.k]||"").trim();
 if(!v)return d.label+" wajib diisi";if(v.indexOf("/")>=0)return d.label+" tidak boleh berisi tanda /";if(d.opts&&d.opts.indexOf(v)<0)return d.label+" tidak dikenal"}return ""}
