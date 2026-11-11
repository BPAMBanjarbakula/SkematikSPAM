"""Siapkan aset Mode 3D dari DEMNAS (+ Copernicus GLO-30 untuk jalur di luar cakupan DEMNAS):
   - web/data/dem3d.png      : grid ketinggian (16-bit dipecah ke kanal R,G; satuan 0,05 m)
   - web/data/relief3d.webp  : tekstur elevasi berwarna + hillshade + kontur
   - web/data/shade3d.webp   : hillshade saja (untuk ditimpa ke citra satelit)
   - src/geo3d/meta.json     : batas, ukuran grid, skala
"""
import json, os
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds as tf_bounds
from scipy.ndimage import gaussian_filter, zoom, binary_opening, binary_closing
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, E, S, N = 114.53, 115.00, -3.80, -3.27
TW, TH = 1536, 1730            # tekstur
GW, GH = 384, 432              # grid ketinggian
OUT = os.path.join(BASE, "web", "data")

def read(path, w, h, nodata_lo=None):
    with rasterio.open(path) as d:
        dst = np.full((h, w), np.nan, dtype="float32")
        reproject(rasterio.band(d, 1), dst, src_transform=d.transform, src_crs="EPSG:4326",
                  dst_transform=tf_bounds(W, S, E, N, w, h), dst_crs="EPSG:4326",
                  resampling=Resampling.average, src_nodata=d.nodata, dst_nodata=np.nan)
    return dst

# kerja di resolusi tekstur (±34 m/piksel)
dn = read(os.path.join(BASE, "dem", "demnas.tif"), TW, TH)
cp = read(os.path.join(BASE, "dem", "cop.tif"), TW, TH)
dn[(dn < -30) | (dn > 3000)] = np.nan
cp = np.where(np.isnan(cp), 0, cp)
# laut: DEMNAS kosong/≈0 dan Copernicus 0
lat = np.linspace(N, S, TH)[:, None] * np.ones((1, TW))
has = ~np.isnan(dn)
sea = (cp <= 0.01) & (~has | (dn <= 0.6))
sea = binary_opening(binary_closing(sea, iterations=2), iterations=3)
# gabung: DEMNAS bila ada, selain itu Copernicus; haluskan sambungan di tepi selatan cakupan DEMNAS (-3,75)
wgt = np.clip((lat - (-3.75)) / 0.012, 0, 1) * has           # 0 di selatan -3,75 → 1 setelah ±1,3 km
Z = np.where(has, dn, cp) * wgt + cp * (1 - wgt)
Z = np.where(sea, 0, np.clip(Z, 0, None))
Z = gaussian_filter(Z, 1.1)
print("elev max %.0f m, p50 %.1f, p90 %.1f, laut %.1f%%" % (Z.max(), np.percentile(Z, 50), np.percentile(Z, 90), sea.mean() * 100))

# ---------- grid ketinggian
G = zoom(gaussian_filter(Z, 1.6), (GH / TH, GW / TW), order=1)
G = np.clip(G, 0, None)
v = np.round(G / 0.05).astype(np.uint32)
rgb = np.zeros((GH, GW, 3), np.uint8); rgb[..., 0] = v >> 8; rgb[..., 1] = v & 255
Image.fromarray(rgb, "RGB").save(os.path.join(OUT, "dem3d.png"), optimize=True)

# ---------- hillshade multi-arah
px_m = (E - W) * 111320 * np.cos(np.radians((S + N) / 2)) / TW
def hillshade(z, az, alt, ex):
    gy, gx = np.gradient(z * ex, px_m)
    slope = np.pi / 2 - np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
    a, b = np.radians(360 - az + 90), np.radians(alt)
    return np.clip(np.sin(b) * np.sin(slope) + np.cos(b) * np.cos(slope) * np.cos(a - aspect), 0, 1)
ex = 9.0
hs = 0.55 * hillshade(Z, 315, 42, ex) + 0.25 * hillshade(Z, 270, 38, ex) + 0.20 * hillshade(Z, 0, 45, ex)
flat = 0.55 * np.sin(np.radians(42)) + 0.25 * np.sin(np.radians(38)) + 0.20 * np.sin(np.radians(45))
shade = np.clip(hs / flat, 0, 1.6)                              # 1 = datar
sh8 = np.clip(shade / 1.6 * 255, 0, 255).astype(np.uint8)       # disimpan 0..1,6 → 0..255
Image.fromarray(sh8, "L").save(os.path.join(OUT, "shade3d.webp"), quality=78, method=6)

# ---------- tekstur elevasi (tema gelap GeoSPAM)
from matplotlib.colors import LinearSegmentedColormap
cm = LinearSegmentedColormap.from_list("g", ["#12474a", "#17604f", "#24774f", "#3f8f52", "#6ea458", "#a3b36a", "#cdb983", "#e8dab9", "#f8f3e6"])
zn = np.clip((Z / 900.0) ** 0.42, 0, 1)
col = cm(zn)[..., :3]
col = col * np.clip(0.42 + 0.62 * shade, 0, 1.5)[..., None]
# kontur 25 m (tipis) dan 100 m (lebih tegas), dihitung dari grid halus
Zs = gaussian_filter(Z, 2.0)
def contour(step):
    q = np.floor(Zs / step)
    e = np.zeros_like(Zs, bool)
    e[:-1, :] |= q[:-1, :] != q[1:, :]; e[:, :-1] |= q[:, :-1] != q[:, 1:]
    return e & (Zs > 4)
c25 = gaussian_filter(contour(25).astype("float32"), 0.6)
c100 = gaussian_filter(contour(100).astype("float32"), 0.8)
k = np.clip(c25 * 0.30 + c100 * 0.38, 0, 0.6)[..., None]
col = col * (1 - k) + np.array([1.0, 1.0, 0.94]) * k
seacol = np.array([0x0b, 0x2c, 0x47]) / 255.0
# gradasi lembut di garis pantai
sm = gaussian_filter(sea.astype("float32"), 1.2)[..., None]
col = col * (1 - sm) + seacol * sm
img = (np.clip(col, 0, 1) * 255).astype(np.uint8)
Image.fromarray(img, "RGB").save(os.path.join(OUT, "relief3d.webp"), quality=84, method=6)

meta = {"bbox": [W, S, E, N], "gw": GW, "gh": GH, "unit": 0.05, "zmax": float(round(float(G.max()), 1)),
        "tw": TW, "th": TH, "shadeMax": 1.6}
os.makedirs(os.path.join(BASE, "src", "geo3d"), exist_ok=True)
json.dump(meta, open(os.path.join(BASE, "src", "geo3d", "meta.json"), "w"))
for f in ("dem3d.png", "relief3d.webp", "shade3d.webp"):
    print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")
print(meta)
