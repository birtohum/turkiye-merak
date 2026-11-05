"""Madde olmayan sayfaları, bot gürültüsünü ve yetişkin içeriği ayıklar.

Bütün kurallar saf fonksiyonlardır; testler/test_filtre.py sınar.
"""
import re

# Ad alanı önekleri (Türkçe ve İngilizce adlarıyla). Ana ad alanı dışındaki her şey madde değildir.
AD_ALANLARI = (
    "Özel", "Special", "Vikipedi", "Wikipedia", "VP", "Kullanıcı", "User", "Dosya", "File",
    "Image", "Resim", "Kategori", "Category", "Şablon", "Template", "Yardım", "Help",
    "Portal", "Vikiproje", "WikiProject", "MediaWiki", "Modül", "Module", "Medya", "Media", "Taslak", "Draft",
    "Tartışma", "Talk", "Kullanıcı mesaj", "TimedText", "Gadget", "Topic", "Konu",
)
_AD_ALANI_RE = re.compile(
    r"^(" + "|".join(re.escape(a.replace(" ", "_")) for a in AD_ALANLARI) + r")(_tartışma|_talk)?:",
    re.IGNORECASE,
)
ANASAYFALAR = {"Anasayfa", "Ana_Sayfa", "Main_Page", "Ana_sayfa", "-", "Undefined", "undefined",
               "Null", "Index.html", "Search", "Wiki"}

# Başlıkta geçerse doğrudan gizlenen kalıplar (küçük harfe çevrilmiş başlıkta aranır).
# Kısa kökler kelime sınırıyla aranır: "Seksenler", "Sussex", "Essex" gizlenmez.
YETISKIN_BASLIK = [re.compile(x) for x in (
    r"porno", r"\bseks(?!en)", r"\bsex\b", r"xnxx", r"xvideos", r"xhamster", r"pornhub",
    r"brazzers", r"onlyfans", r"mastürbasyon", r"masturbasyon", r"orgazm", r"vajina",
    r"\bpenis(?!il)", r"erotik", r"erotizm", r"fetiş", r"hentai", r"striptiz", r"cinsel ilişki",
    r"cinsel organ", r"\bmilf\b", r"fuhuş", r"\beskort", r"redtube", r"youporn",
    r"chaturbate", r"stripchat", r"\bjav\b", r"\bnsfw\b",
)]
# Vikipedi kategorisinde geçerse gizlenen kökler. "Cinsel yönelim" gibi kimlik konuları bilerek yok.
YETISKIN_KATEGORI = (
    "pornograf", "porno", "erotik", "cinsel davranış", "cinsel ilişki", "cinsel organ",
    "seks pozisyon", "seks oyuncak", "seks işçi", "fetiş", "fuhuş", "yetişkin film",
    "yetişkin içerik", "mastürbasyon", "striptiz",
)


def tr_kucuk(s: str) -> str:
    return s.replace("I", "ı").replace("İ", "i").lower()


def madde_mi(baslik: str) -> bool:
    """Ana ad alanındaki gerçek bir madde gibi görünüyor mu?"""
    if not baslik or baslik in ANASAYFALAR:
        return False
    if _AD_ALANI_RE.match(baslik):
        return False
    alt = baslik.lower()
    if alt.endswith((".php", ".html", ".htm", ".asp", ".jsp")) or "%" in baslik:
        return False
    return True


def yetiskin_baslik_mi(baslik: str) -> bool:
    b = tr_kucuk(baslik.replace("_", " "))
    return any(k.search(b) for k in YETISKIN_BASLIK)


def yetiskin_kategori_mi(kategoriler) -> bool:
    for k in kategoriler or ():
        k = tr_kucuk(k)
        if any(x in k for x in YETISKIN_KATEGORI):
            return True
    return False


def bot_mu(toplam: int, masaustu, mobil_web, masaustu_esik: int, mobil_esik: int,
           en_az: int = 1000) -> str | None:
    """Okumaların neredeyse tamamı tek bir erişim türünden geliyorsa bot şüphesi.

    masaustu / mobil_web: o türün ilk-1000 listesindeki değer; listede yoksa None.
    Listede olmayan bir türün okuması en fazla o listenin son sırasındaki değer (eşik) kadardır,
    bu yüzden üst sınır olarak eşik kullanılır. Böylece yalnız kesin aşırı durumlar işaretlenir.
    Dönüş: None (temiz) ya da 'masaustu' / 'mobil'.
    """
    if toplam < en_az:
        return None
    m_ust = masaustu if masaustu is not None else masaustu_esik
    w_ust = mobil_web if mobil_web is not None else mobil_esik
    if masaustu is not None and masaustu / toplam >= 0.95:
        return "masaustu"
    if mobil_web is not None and mobil_web / toplam >= 0.98:
        return "mobil"
    # Bir tür listede yoksa ve üst sınırı bile toplamın %2'sinden azsa, okumalar tek taraflıdır.
    if masaustu is None and m_ust / toplam < 0.02:
        return "mobil"
    if mobil_web is None and w_ust / toplam < 0.02 and masaustu is not None:
        return "masaustu"
    return None
