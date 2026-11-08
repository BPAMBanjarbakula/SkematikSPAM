WebGIS Jaringan Perpipaan SPAM Regional Banjarbakula - Tahap 1
Versi: 7 November 2026

Cara deploy ke Netlify:
1. Buka app.netlify.com > Sites > pilih situs skematik (atau Add new site > Deploy manually).
2. Tab Deploys > seret folder ini (webgis-bpam-tahap1) ke kotak "Drag and drop".
   Jika memakai GitHub: ganti isi repo dengan isi folder ini lalu commit; Netlify akan deploy otomatis.

Isi:
- index.html  : WebGIS lengkap (Leaflet dan data sudah tertanam, tidak butuh file lain)
- data/*.geojson : salinan data per layer (WGS84) untuk dibuka di QGIS atau diperbarui
- netlify.toml, robots.txt : agar situs tidak diindeks mesin pencari

Memperbarui data: edit GeoJSON di QGIS, lalu minta Claude membangun ulang index.html.
