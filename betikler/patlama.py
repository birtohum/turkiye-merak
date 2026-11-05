"""Ani yükselişleri ("patlayanlar") hesaplayan saf fonksiyonlar."""
from statistics import median

PENCERE = 28        # taban için bakılan önceki gün sayısı
EN_AZ_OKUMA = 1500  # bir patlama için o gün en az bu kadar okuma
EN_AZ_KAT = 5       # tabanın en az bu kadar katı
TABAN_ALT = 10      # kat hesabında taban bundan küçük sayılmaz (1 okumadan 1000 kat çıkmasın)


def taban(seri):
    """Önceki günlerin medyanı. Medyan, tek günlük sıçramalardan etkilenmez."""
    seri = [x for x in seri if x is not None]
    return median(seri) if seri else 0


def yaklasik_taban(baslik, onceki_listeler, onceki_esikler):
    """İlk-1000 listelerinden üst sınır tahmini.

    Madde bir gün listede yoksa o günkü okuması en fazla listenin son sırası (eşik) kadardır;
    o gün için eşik konur. Medyan tekdüze olduğundan sonuç gerçek tabanın üst sınırıdır,
    yani buradan çıkan kat gerçeğinden küçük ya da eşittir.
    """
    degerler = []
    for liste, esik in zip(onceki_listeler, onceki_esikler):
        degerler.append(liste.get(baslik, esik))
    return taban(degerler)


def kat(okuma, taban_deger):
    return okuma / max(taban_deger, TABAN_ALT)


def patlama_mi(okuma, taban_deger):
    return okuma >= EN_AZ_OKUMA and kat(okuma, taban_deger) >= EN_AZ_KAT


def siralama_puani(okuma, taban_deger):
    """Fazladan okuma: o gün 'normalde' olacağından kaç kişi fazla baktı."""
    return okuma - taban_deger


def baglam(seri):
    """Yalnız veriden çıkan, yorum katmayan tek satırlık not.

    seri: son PENCERE gün + o gün (sonda), günlük okumalar.
    """
    bugun = seri[-1]
    onceki = seri[:-1]
    b = taban(onceki)
    dun = onceki[-1] if onceki else None
    notlar = []
    if b < 50:
        notlar.append("Normalde neredeyse hiç okunmayan bir madde.")
    if dun is not None and dun >= EN_AZ_KAT * max(b, TABAN_ALT) and dun < bugun:
        notlar.append("Bir gün önce de yükselmeye başlamıştı.")
    elif dun is not None and dun < 2 * max(b, TABAN_ALT):
        notlar.append("Bir gün önce her zamankinden farksızdı.")
    gecmis_tepe = max((x for x in onceki if x is not None), default=0)
    if gecmis_tepe and bugun > 3 * gecmis_tepe and b >= 50:
        notlar.append(f"Son {len(onceki)} günün en yüksek gününün {bugun / gecmis_tepe:.0f} katı.")
    return " ".join(notlar[:2])
