# Sumber Mode 3D GeoSPAM Bakula

`geo3d.js` di akar situs adalah hasil bundel dari berkas di folder ini (three.js r160 + kode sendiri).
Modul hanya dimuat ketika pengguna membuka Mode 3D, jadi tidak membebani peta 2D.

- `main.js`   : adegan 3D (relief, pipa, label, panel Alur Sistem, tur, simpan gambar)
- `style.css` : tampilan antarmuka Mode 3D (disisipkan ke dalam bundel)
- `meta.json` : batas wilayah dan ukuran grid ketinggian
- `build_3d.py` : membuat `data/dem3d.png`, `data/relief3d.webp`, `data/shade3d.webp` dari DEMNAS (BIG)
  dan Copernicus GLO-30 (hanya untuk selatan 3,75° LS). Berkas DEM mentah tidak disimpan di repo.

Membangun ulang bundel:

    npm i three@0.160.0 esbuild
    npx esbuild main.js --bundle --minify --format=iife --target=es2018 --loader:.css=text --outfile=../../geo3d.js

Setelah `geo3d.js` berubah, naikkan angka `G3V` di `index.html` agar browser mengambil versi baru.
