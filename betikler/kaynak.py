"""Wikimedia Pageviews REST API ve tr.wikipedia API istemcisi (önbellekli)."""
import gzip
import json
import os
import threading
import time
from datetime import date
from pathlib import Path
from urllib.parse import quote

import socket

import requests
import urllib3.util.connection

# Bu ağda IPv6 bağlantısı bazen ~14 sn takılıp IPv4'e düşüyor; doğrudan IPv4 kullan.
urllib3.util.connection.allowed_gai_family = lambda: socket.AF_INET

UA = "turkiye-merak/1.0 (https://github.com/birtohum/turkiye-merak; veri: Wikimedia Pageviews API)"
REST = "https://wikimedia.org/api/rest_v1/metrics/pageviews"
PROJE = "tr.wikipedia"
KOK = Path(__file__).resolve().parent.parent
HAM = KOK / "veri" / "ham"

_yerel = threading.local()


def _oturum():
    if not hasattr(_yerel, "s"):
        _yerel.s = requests.Session()
        _yerel.s.headers["User-Agent"] = UA
    return _yerel.s


def al(url, params=None, deneme=10):
    """GET; 404 için None döner, 429/5xx için bekleyip yeniden dener."""
    for i in range(deneme):
        try:
            r = _oturum().get(url, params=params, timeout=40)
        except requests.RequestException:
            time.sleep(2 ** i)
            continue
        if r.status_code == 404:
            return None
        if r.status_code == 429 or r.status_code >= 500:
            bekle = r.headers.get("retry-after")
            time.sleep(int(bekle) if bekle and bekle.isdigit() else min(60, 2 ** i * 2))
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"İstek başarısız: {url}")


def _oku_gz(yol):
    with gzip.open(yol, "rt", encoding="utf-8") as f:
        return json.load(f)


def _yaz_gz(yol, veri):
    yol.parent.mkdir(parents=True, exist_ok=True)
    # Aynı dosyayı birden çok iş parçacığı/işlem yazabilir: geçici ad benzersiz olmalı.
    gecici = yol.with_name(f"{yol.name}.{os.getpid()}.{threading.get_ident()}.tmp")
    with gzip.open(gecici, "wt", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    try:
        gecici.replace(yol)
    except PermissionError:   # Windows: hedef o an başkasınca okunuyor; içerik aynı, geç
        gecici.unlink(missing_ok=True)


def ilk_1000(erisim: str, gun: date):
    """O günün en çok okunan ~1000 sayfası: [[başlık, okuma], ...]. Veri yoksa None."""
    yol = HAM / "top" / erisim / f"{gun.isoformat()}.json.gz"
    if yol.exists():
        return _oku_gz(yol)
    d = al(f"{REST}/top/{PROJE}/{erisim}/{gun.year}/{gun.month:02d}/{gun.day:02d}")
    if d is None:
        return None
    liste = [[a["article"], a["views"]] for a in d["items"][0]["articles"]]
    _yaz_gz(yol, liste)
    return liste


def madde_gunluk(baslik: str, bas: date, bit: date):
    """{'YYYY-MM-DD': okuma} — yalnız insan okuyucular (agent=user), tüm erişimler."""
    url = (f"{REST}/per-article/{PROJE}/all-access/user/{quote(baslik, safe='')}/daily/"
           f"{bas.strftime('%Y%m%d')}00/{bit.strftime('%Y%m%d')}00")
    d = al(url)
    if d is None:
        return {}
    return {f"{x['timestamp'][:4]}-{x['timestamp'][4:6]}-{x['timestamp'][6:8]}": x["views"]
            for x in d["items"]}


def toplam_gunluk(bas: date, bit: date):
    url = (f"{REST}/aggregate/{PROJE}/all-access/user/daily/"
           f"{bas.strftime('%Y%m%d')}00/{bit.strftime('%Y%m%d')}00")
    d = al(url) or {"items": []}
    return {f"{x['timestamp'][:4]}-{x['timestamp'][4:6]}-{x['timestamp'][6:8]}": x["views"]
            for x in d["items"]}


_meta_kilit = threading.Lock()
_META_YOL = HAM / "meta.json.gz"
_meta = None


def _meta_yukle():
    global _meta
    if _meta is None:
        _meta = _oku_gz(_META_YOL) if _META_YOL.exists() else {}
    return _meta


def meta_kaydet():
    with _meta_kilit:
        if _meta is not None:
            _yaz_gz(_META_YOL, _meta)


def meta(basliklar):
    """{başlık: {'k': [kategoriler], 'd': kısa açıklama, 'i': küçük resim}} (50'lik gruplarla)."""
    with _meta_kilit:
        m = _meta_yukle()
        eksik = [b for b in dict.fromkeys(basliklar) if b not in m]
    for i in range(0, len(eksik), 50):
        grup = eksik[i:i + 50]
        sonuc = {b: {"k": [], "d": "", "i": ""} for b in grup}
        params = dict(action="query", format="json", formatversion=2,
                      prop="categories|description|pageimages", piprop="thumbnail",
                      pithumbsize=160, cllimit="max", clshow="!hidden", redirects=1,
                      titles="|".join(grup))
        sayfalar = {}
        eslem = {b: b.replace("_", " ") for b in grup}
        while True:
            d = al("https://tr.wikipedia.org/w/api.php", params)
            if not d:
                break
            q = d.get("query", {})
            ad = {x["from"]: x["to"] for x in q.get("normalized", [])}
            yon = {x["from"]: x["to"] for x in q.get("redirects", [])}
            for b in grup:
                t = ad.get(b, eslem[b])
                eslem[b] = yon.get(t, t)
            for p in q.get("pages", []):
                s = sayfalar.setdefault(p["title"], {"k": [], "d": "", "i": ""})
                s["k"] += [c["title"].split(":", 1)[-1] for c in p.get("categories", [])]
                s["d"] = s["d"] or p.get("description", "")
                s["i"] = s["i"] or p.get("thumbnail", {}).get("source", "")
            if "continue" in d:
                params = {**params, **d["continue"]}
            else:
                break
        for b in grup:
            if eslem[b] in sayfalar:
                sonuc[b] = sayfalar[eslem[b]]
        with _meta_kilit:
            m.update(sonuc)
    with _meta_kilit:
        return {b: m[b] for b in basliklar}
