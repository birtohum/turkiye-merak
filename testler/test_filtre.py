import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "betikler"))
import filtre  # noqa: E402


def test_madde_olmayanlar():
    for b in ["Anasayfa", "Ana_Sayfa", "Özel:Ara", "Special:Search", "Vikipedi:Köy_çeşmesi",
              "Kullanıcı:Ege", "Dosya:X.jpg", "Kategori:Türk_futbolcular", "Şablon:Bilgi_kutusu",
              "Kullanıcı_mesaj:Ege", "Tartışma:Türkiye", "-", "index.php", "Main_Page",
              "Yardım:İçindekiler", "Portal:Futbol", "Vikiproje:Kürdistan", "Vikipedi_tartışma:X"]:
        assert not filtre.madde_mi(b), b


def test_maddeler():
    for b in ["Türkiye", "Deniz_Undav", "Mustafa_Kemal_Atatürk", "Özel_kuvvetler",
              "Kategori_teorisi", "2026_Amerika_Birleşik_Devletleri_seçimleri", "Şablon_(müzik)",
              "Dosya_paylaşımı", "Call_of_Duty:_Advanced_Warfare"]:
        assert filtre.madde_mi(b), b


def test_yetiskin_baslik():
    for b in ["XNXX", "Pornografi", "Anal_seks", "Seks_ve_Genç_Kız_(film)", "İnsan_penisi",
              "69_(seks_pozisyonu)", "Cinsel_ilişki"]:
        assert filtre.yetiskin_baslik_mi(b), b
    for b in ["Seksenler", "Sussex", "Essex", "Middlesex", "Penisilin", "Java", "Türkiye",
              "Cinsel_yönelim"]:
        assert not filtre.yetiskin_baslik_mi(b), b


def test_yetiskin_kategori():
    assert filtre.yetiskin_kategori_mi(["Pornografik internet siteleri"])
    assert filtre.yetiskin_kategori_mi(["Amerika Birleşik Devletleri erotik komedi filmleri"])
    assert not filtre.yetiskin_kategori_mi(["Cinsel yönelim", "LGBT tarihi", "1996 doğumlular"])
    assert not filtre.yetiskin_kategori_mi([])


def test_bot():
    # Okumaların tamamı mobilden, masaüstü listesinde yok ve eşik toplamın %2'sinden az.
    assert filtre.bot_mu(16502, None, 16400, 229, 317) == "mobil"
    # %95+ masaüstü.
    assert filtre.bot_mu(2017, 1923, None, 229, 317) == "masaustu"
    # Normal karışım.
    assert filtre.bot_mu(32911, 9000, 20000, 229, 317) is None
    # Masaüstü listede yok ama eşik toplama göre büyük: karar verilemez → temiz.
    assert filtre.bot_mu(3000, None, 2500, 229, 317) is None
    # Az okunan sayfaya dokunulmaz.
    assert filtre.bot_mu(900, 899, None, 229, 317) is None
