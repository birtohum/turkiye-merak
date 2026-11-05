import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "betikler"))
import patlama as P  # noqa: E402


def test_taban_medyan_tek_sicramadan_etkilenmez():
    assert P.taban([100] * 27 + [50000]) == 100


def test_yaklasik_taban_ust_sinirdir():
    # Madde listede yoksa o gün eşik (son sıra) sayılır.
    listeler = [{"A": 500}, {}, {}]
    esikler = [250, 240, 260]
    assert P.yaklasik_taban("A", listeler, esikler) == 260
    gercek = [500, 30, 40]
    assert P.taban(gercek) <= P.yaklasik_taban("A", listeler, esikler)


def test_patlama_esikleri():
    assert P.patlama_mi(5000, 100)
    assert not P.patlama_mi(1000, 10)        # az okuma
    assert not P.patlama_mi(5000, 2000)      # yalnız 2,5 kat
    assert P.kat(5000, 0) == 500             # taban alt sınırı 10


def test_baglam_yalniz_veriden():
    ani = [20] * 28 + [5000]
    n = P.baglam(ani)
    assert "neredeyse hiç" in n and "farksızdı" in n
    kademeli = [300] * 27 + [3000, 9000]
    assert "Bir gün önce de" in P.baglam(kademeli)
    assert P.baglam([300] * 28 + [9000]).count(".") <= 2
