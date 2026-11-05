"""Günlük listeleri ve patlamaları hesaplayıp site/veri altına yazar.

Kullanım:
  python uret.py                      # son işlenen günden düne kadar eksikleri işle
  python uret.py --bas 2015-07-01     # aralığı (yeniden) işle
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import filtre  # noqa: E402
import kaynak  # noqa: E402
import patlama as P  # noqa: E402

SITE_VERI = kaynak.KOK / "site" / "veri"
ILK_GUN = date(2015, 7, 1)   # API'de ilk-1000 listelerinin başladığı gün
LISTE_UZ = 20
PATLAMA_UZ = 10


def _gunler(bas, bit):
    g = bas
    while g <= bit:
        yield g
        g += timedelta(days=1)


def _sozluk(liste):
    if not liste:
        return {}, 0
    return {b: v for b, v in liste}, liste[-1][1]


def gun_isle(gun: date):
    tum = kaynak.ilk_1000("all-access", gun)
    if not tum:
        return None
    masa, esik_m = _sozluk(kaynak.ilk_1000("desktop", gun))
    mob, esik_w = _sozluk(kaynak.ilk_1000("mobile-web", gun))
    sayac = {"sayfa": 0, "bot": 0, "yetiskin": 0}
    botlar, temiz = [], []
    for b, v in tum:
        if not filtre.madde_mi(b):
            sayac["sayfa"] += 1
        elif filtre.yetiskin_baslik_mi(b):
            sayac["yetiskin"] += 1
        elif filtre.bot_mu(v, masa.get(b), mob.get(b), esik_m or 10**9, esik_w or 10**9):
            sayac["bot"] += 1
            botlar.append(b)
        else:
            temiz.append((b, v))

    # Önceki günlerin listelerinden yaklaşık taban (üst sınır) → aday patlamalar.
    onceki_l, onceki_e = [], []
    for k in range(1, P.PENCERE + 1):
        g = gun - timedelta(days=k)
        if g < ILK_GUN:
            break
        s, e = _sozluk(kaynak.ilk_1000("all-access", g))
        if s:
            onceki_l.append(s)
            onceki_e.append(e)
    adaylar = []
    if len(onceki_l) >= 14:
        for b, v in temiz:
            if v < P.EN_AZ_OKUMA:
                break
            yt = P.yaklasik_taban(b, onceki_l, onceki_e)
            if P.patlama_mi(v, yt):
                adaylar.append((P.siralama_puani(v, yt), b, v))
        adaylar.sort(reverse=True)
        adaylar = adaylar[:25]

    m = kaynak.meta([b for b, _ in temiz[:LISTE_UZ + 15]] + [b for _, b, _ in adaylar])
    gizli = {b for b in m if filtre.yetiskin_kategori_mi(m[b]["k"])
             or filtre.yetiskin_kategori_mi([m[b]["d"]])}
    sayac["yetiskin"] += sum(1 for b, _ in temiz if b in gizli)

    liste = [[b, v, m[b]["d"], m[b]["i"]] for b, v in temiz[:LISTE_UZ + 15] if b not in gizli][:LISTE_UZ]

    pa_yol = kaynak.HAM / "pa" / f"{gun.isoformat()}.json.gz"
    pa = kaynak._oku_gz(pa_yol) if pa_yol.exists() else {}
    pa_n = len(pa)
    patlayanlar = []
    for _, b, v in adaylar:
        if b in gizli:
            continue
        if len(patlayanlar) >= PATLAMA_UZ + 3:
            break
        if b not in pa:
            pa[b] = kaynak.madde_gunluk(b, gun - timedelta(days=P.PENCERE), gun)
        seri_d = pa[b]
        if not seri_d:
            continue
        seri = [seri_d.get(g.isoformat(), 0) for g in _gunler(gun - timedelta(days=P.PENCERE), gun)]
        seri[-1] = seri[-1] or v
        t = P.taban(seri[:-1])
        if not P.patlama_mi(seri[-1], t):
            continue
        patlayanlar.append({
            "a": b, "v": seri[-1], "b": round(t), "k": round(P.kat(seri[-1], t), 1),
            "s": seri, "d": m[b]["d"], "i": m[b]["i"], "n": P.baglam(seri),
            "_p": P.siralama_puani(seri[-1], t),
        })
    if len(pa) != pa_n:
        kaynak._yaz_gz(pa_yol, pa)
    patlayanlar.sort(key=lambda x: -x["_p"])
    for x in patlayanlar:
        del x["_p"]
    return {"top": liste, "p": patlayanlar[:PATLAMA_UZ], "f": sayac, "fb": botlar[:20],
            "n": len(tum)}


def ay_yolu(ay):
    return SITE_VERI / "gun" / f"{ay}.json"


def ay_oku(ay):
    y = ay_yolu(ay)
    return json.loads(y.read_text(encoding="utf-8")) if y.exists() else {}


def yaz(yol: Path, veri):
    yol.parent.mkdir(parents=True, exist_ok=True)
    yol.write_text(json.dumps(veri, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def ozetleri_uret():
    """takvim.json (gün → en büyük patlama), patlamalar.json (madde → patlama günleri),
    önceki patlama alanı 'o' ve son.json."""
    aylar = sorted(p.stem for p in (SITE_VERI / "gun").glob("*.json"))
    tum = {ay: ay_oku(ay) for ay in aylar}
    gecmis = {}
    takvim = {}
    for ay in aylar:
        degisti = False
        for g in sorted(tum[ay]):
            k = tum[ay][g]
            for x in k["p"]:
                onceki = [t for t in gecmis.get(x["a"], []) if t < g]
                o = onceki[-1] if onceki and (date.fromisoformat(g) - date.fromisoformat(onceki[-1])).days > 7 else None
                if x.get("o") != o:
                    x["o"] = o
                    degisti = True
                gecmis.setdefault(x["a"], []).append(g)
            ilk = k["p"][0] if k["p"] else None
            takvim[g] = [ilk["a"], ilk["k"], ilk["v"]] if ilk else [k["top"][0][0] if k["top"] else "", 0, 0]
        if degisti:
            yaz(ay_yolu(ay), tum[ay])
    yaz(SITE_VERI / "takvim.json", takvim)
    yaz(SITE_VERI / "patlamalar.json", gecmis)
    son = max(takvim) if takvim else None
    yaz(SITE_VERI / "son.json", {"son": son, "ilk": min(takvim) if takvim else None,
                                 "uretim": datetime.now(timezone.utc).isoformat(timespec="minutes")})
    return son


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bas")
    ap.add_argument("--bit")
    ap.add_argument("--is", type=int, default=8, dest="isci")
    ap.add_argument("--grup", type=int, default=1, help="aynı anda işlenecek ay sayısı")
    a = ap.parse_args()
    dun = datetime.now(timezone.utc).date() - timedelta(days=1)
    bit = date.fromisoformat(a.bit) if a.bit else dun
    if a.bas:
        bas = date.fromisoformat(a.bas)
    else:
        son = None
        y = SITE_VERI / "son.json"
        if y.exists():
            son = json.loads(y.read_text(encoding="utf-8")).get("son")
        bas = date.fromisoformat(son) + timedelta(days=1) if son else ILK_GUN
    gunler = list(_gunler(bas, bit))
    print(f"{len(gunler)} gün işlenecek: {bas} → {bit}", flush=True)

    aylar = {}
    for g in gunler:
        aylar.setdefault(g.strftime("%Y-%m"), []).append(g)
    ay_adlari = list(aylar)
    with ThreadPoolExecutor(a.isci) as ex:
        for i in range(0, len(ay_adlari), a.grup):
            grup = ay_adlari[i:i + a.grup]
            gl_tum = [g for ay in grup for g in aylar[ay]]
            sonuc = dict(zip(gl_tum, ex.map(gun_isle, gl_tum)))
            for ay in grup:
                gl = aylar[ay]
                veri = ay_oku(ay)
                for g in gl:
                    if sonuc[g] is not None:
                        veri[g.isoformat()] = sonuc[g]
                veri = dict(sorted(veri.items()))
                if veri:
                    yaz(ay_yolu(ay), veri)
                bos = sum(1 for g in gl if sonuc[g] is None)
                print(f"{ay}: {len(gl) - bos} gün" + (f" ({bos} gün veri yok)" if bos else ""), flush=True)
            kaynak.meta_kaydet()

    # Günlük toplam okuma (tek istek).
    toplam = kaynak.toplam_gunluk(ILK_GUN, bit)
    if toplam:
        yaz(SITE_VERI / "toplam.json", toplam)
    print("son gün:", ozetleri_uret())


if __name__ == "__main__":
    main()
