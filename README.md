# Türkiye bugün neyi merak etti?

Türkçe Vikipedi'de her gün en çok okunan ve **birdenbire merak edilen** maddeler; 2015'ten bugüne takvim, "doğum gününde Türkiye neyi merak etti?" ve madde arama.

Site: https://birtohum.github.io/turkiye-merak/

## Nasıl çalışır?

- Veri: [Wikimedia Pageviews REST API](https://wikimedia.org/api/rest_v1/) (CC0). Her gün için en çok okunan ~1000 sayfa (tüm erişim, masaüstü, mobil site) ve aday maddelerin günlük okunma sayıları. Yalnız `agent=user` (insan okuyucu) okumaları.
- **Birden merak edilen:** o gün en az 1.500 kez okunan ve önceki 28 günün ortancasının en az 5 katına çıkan madde. Fazladan okuma sayısına göre sıralanır, günde en fazla 10 tane. Adaylar önce ilk-1000 listelerinden üst sınır tahminiyle seçilir, sonra maddenin gerçek günlük okumalarıyla doğrulanır.
- **Çıkarılanlar:** madde olmayan sayfalar (Anasayfa, Özel:, Kullanıcı:, Kategori: …), bot şüphesi (okumaların %95+'ı yalnız masaüstü ya da %98+'ı yalnız mobil siteden), yetişkin içerik (başlık ya da Vikipedi kategorisi kalıpları; temkinli, bazen fazla gizler). Kurallar: [`betikler/filtre.py`](betikler/filtre.py).
- Kartlardaki notlar yalnız sayılardan türetilir; bir maddenin neden merak edildiği yazılmaz.

## Sınırlar

- Türkçe Vikipedi okurları yalnız Türkiye'de değildir.
- Günler UTC'dir (Türkiye saatiyle 03:00–03:00).
- 29 Nisan 2017 – 26 Aralık 2019 arasında Vikipedi Türkiye'den erişime kapalıydı.
- Bot ayıklaması kusursuz değildir; Wikimedia otomatik trafiği 2020'den önce daha zayıf ayırıyordu.
- Açıklama, resim ve kategoriler maddenin bugünkü hâlinden alınır.

## Çalıştırma

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt pytest
.venv/Scripts/python -m pytest -q testler
cd betikler && python uret.py            # eksik günleri işler
cd betikler && python uret.py --bas 2015-07-01   # baştan
```

Ham yanıtlar `veri/ham/` altında önbelleğe alınır (depoda yok). Site `site/` klasöründedir; `site/veri/` her gün GitHub Actions ile güncellenir (`.github/workflows/gunluk.yml`), Pages `yayin.yml` ile yayımlanır.

## Lisans

Kod: Apache-2.0. Veri: Wikimedia (CC0); madde açıklamaları ve resimler Vikipedi/Vikiveri/Commons katkıcılarına aittir.
