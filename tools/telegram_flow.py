"""Pembaca data flowmeter Onpoint dari grup Telegram BPAM Banjarbakula -> flow.json.
Dijalankan GitHub Actions tiap jam. Rahasia (GitHub Secrets): TG_API_ID, TG_API_HASH, TG_SESSION.
Opsional: TG_GROUP (judul grup, default "BPAM Banjarbakula")."""
import asyncio, json, os, re, sys
from datetime import datetime, timedelta, timezone

WITA = timezone(timedelta(hours=8))
LOGGERS = {  # judul pesan Onpoint -> id stasiun di peta
    "BPAM BANJARBAKULA DN900": "dn900",
    "BPAM PEMATANG": "pematang",
}
NUM = r"(-?\d+(?:\.\d+)?)"

def parse(text):
    """Urai satu pesan Onpoint. Kembalikan dict atau None."""
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    if not lines: return None
    sid = None
    for l in lines[:2]:
        sid = LOGGERS.get(re.sub(r"\s+", " ", l).upper())
        if sid: break
    if not sid: return None
    t = "\n".join(lines)
    flow = re.search(r"Flow\s*:\s*" + NUM, t, re.I)
    cons = re.search(r"Consumption\s*:\s*" + NUM, t, re.I)
    ts = re.search(r"(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})", t)
    if not (flow and ts): return None
    d, m, y, H, M, S = map(int, ts.groups())
    when = datetime(y, m, d, H, M, S, tzinfo=WITA)
    st = re.search(r"\(([^)]*)\)", t)
    rec = {"id": sid, "t": int(when.timestamp() * 1000), "flow": float(flow.group(1)),
           "cons": float(cons.group(1)) if cons else None}
    if st:
        parts = [p.strip() for p in st.group(1).split(",")]
        rec["sub"] = parts[0] if parts else None
        for p in parts[1:]:
            v = re.match(NUM + r"\s*(C|V|dBm)", p)
            if not v: continue
            val, u = float(v.group(1)), v.group(2)
            if u == "C": rec["temp"] = val
            elif u == "dBm": rec["rssi"] = val
            elif u == "V" and "batt" not in rec: rec["batt"] = val
    return rec

async def main(out):
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    api_id, api_hash, sess = int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"], os.environ["TG_SESSION"]
    group = (os.environ.get("TG_GROUP") or "BPAM Banjarbakula").strip().lower()
    async with TelegramClient(StringSession(sess), api_id, api_hash) as cl:
        ent = None
        async for dlg in cl.iter_dialogs():
            if (dlg.title or "").strip().lower() == group: ent = dlg.entity; break
        if ent is None: sys.exit(f"Grup '{group}' tidak ditemukan pada akun ini.")
        since = datetime.now(timezone.utc) - timedelta(days=8)
        recs = []
        async for msg in cl.iter_messages(ent, limit=1500):
            if msg.date < since: break
            r = parse(msg.message)
            if r: recs.append(r)
    old = {}
    if os.path.exists(out):
        try: old = json.load(open(out))
        except Exception: old = {}
    data = {"updated": int(datetime.now(timezone.utc).timestamp() * 1000), "stations": {}}
    cutoff = data["updated"] - 7 * 864e5
    for sid in LOGGERS.values():
        pts = {p["t"]: p for p in old.get("stations", {}).get(sid, {}).get("series", [])}
        last = old.get("stations", {}).get(sid, {}).get("last")
        for r in recs:
            if r["id"] != sid: continue
            pts[r["t"]] = {"t": r["t"], "flow": r["flow"], "cons": r["cons"]}
            if not last or r["t"] >= last["t"]: last = {k: v for k, v in r.items() if k != "id"}
        series = sorted((p for p in pts.values() if p["t"] >= cutoff), key=lambda p: p["t"])
        data["stations"][sid] = {"last": last, "series": series}
    # ---- riwayat harian permanen (untuk laporan triwulan BWS)
    harian = old.get("harian", {})
    def daykey(t): return datetime.fromtimestamp(t / 1000, WITA).strftime("%Y-%m-%d")
    agg = {}
    for sid in LOGGERS.values():
        ser = data["stations"][sid]["series"]
        for a_, b_ in zip(ser, ser[1:]):
            dt = (b_["t"] - a_["t"]) / 1000
            if dt <= 0 or dt > 3 * 3600: continue
            vf = (a_["flow"] + b_["flow"]) / 2 * dt / 1000
            v = (b_["cons"] - a_["cons"]) if (a_.get("cons") is not None and b_.get("cons") is not None) else None
            if v is None or v < 0 or abs(v - vf) > vf * 0.6 + 50: v = vf
            d = agg.setdefault(daykey(b_["t"]), {}).setdefault(sid, [0.0, 0.0])
            d[0] += v; d[1] += dt / 3600
    for k, d in agg.items():
        cur = harian.get(k, {})
        for sid, (v, h) in d.items():
            if h >= cur.get(sid, {}).get("h", 0):
                cur[sid] = {"q": round(v / (h * 3.6), 3), "h": round(h, 2)}
        harian[k] = cur
    # muka air bendung (AWLR BWS Kal III) rata-rata harian
    try:
        import urllib.request, urllib.parse
        for k in sorted(agg)[-3:]:
            body = urllib.parse.urlencode({"deviceId": "HGT1486", "startDate": k, "endDate": k}).encode()
            req = urllib.request.Request("https://opsdabwskal3.higertech.com/Station/GetDataGrafikAwlr", data=body)
            g = json.loads(urllib.request.urlopen(req, timeout=20).read())
            vals = [p["value"] for p in (g.get("dataGrafik") or []) if p.get("value") is not None]
            if vals: harian.setdefault(k, {})["lvl"] = round(sum(vals) / len(vals), 3)
    except Exception as e:
        print("AWLR gagal:", e)
    data["harian"] = harian
    # ---- peringatan (dikirim hanya bila TG_ALERT_CHAT diisi; hanya saat status berubah)
    names = {"dn900": "DN900 (IPA Pinus)", "pematang": "Offtake Pematang"}
    alerts = []
    for sid, st in data["stations"].items():
        l = st["last"]
        if not l: continue
        age = (data["updated"] - l["t"]) / 36e5
        if age > 3: alerts.append(f"Logger {names[sid]} tidak mengirim data {age:.0f} jam"); continue
        ref = [p["flow"] for p in st["series"] if l["t"] - 864e5 < p["t"] < l["t"]]
        if len(ref) >= 6:
            avg = sum(ref) / len(ref); d = (l["flow"] - avg) / avg
            if d <= -0.2: alerts.append(f"Debit {names[sid]} {l['flow']:.0f} L/dtk, turun {-d*100:.0f}% dari rata-rata 24 jam ({avg:.0f} L/dtk)")
    key = " | ".join(alerts)
    data["alerts"] = alerts
    prev = old.get("alert_key", "")
    data["alert_key"] = key
    chat = (os.environ.get("TG_ALERT_CHAT") or "").strip()
    if chat and key != prev and (alerts or prev):
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        txt = ("⚠️ GeoSPAM Bakula – peringatan\n" + "\n".join("• " + a for a in alerts)) if alerts else "✅ GeoSPAM Bakula – kondisi debit kembali normal"
        txt += "\nhttps://geospambanjarbakula.netlify.app"
        async with TelegramClient(StringSession(sess), api_id, api_hash) as cl:
            target = chat
            async for dlg in cl.iter_dialogs():
                if (dlg.title or "").strip().lower() == chat.lower(): target = dlg.entity; break
            await cl.send_message(target, txt)
        print("peringatan terkirim:", txt)
    json.dump(data, open(out, "w"), separators=(",", ":"))
    print({k: (v["last"] or {}).get("flow") for k, v in data["stations"].items()})

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        s = "BPAM Banjarbakula DN900\n(Unsub, 28.12 C, 7.17 V, 7.535 V, -90.0 dBm)\n\nFlow : 572.0 l/s\nConsumption : 20420596.0 m3\n09/11/2026 00:00:00"
        print(parse(s)); print(parse("BPAM PEMATANG\n(Unsub, 26.44 C, 6.854 V, 0.002 V, -69.0 dBm)\nFlow : 88.889 l/s\nConsumption : 3976951.25 m3\n09/11/2026 00:00:00"))
    else:
        asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "flow.json"))
