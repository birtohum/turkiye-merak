"""Paylaşım görseli (site/og.png, 1200x630). Yerelde bir kez çalıştırılır; Windows yazı tiplerini kullanır."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

F = Path("C:/Windows/Fonts")
ZEMIN, MUREKKEP, VURGU, IKINCIL = "#fff8ec", "#1b1b1f", "#e8431a", "#55555f"
W, H = 1200, 630
im = Image.new("RGB", (W, H), ZEMIN)
d = ImageDraw.Draw(im)
kucuk = ImageFont.truetype(str(F / "segoeuib.ttf"), 24)
baslik = ImageFont.truetype(str(F / "georgiab.ttf"), 84)
alt = ImageFont.truetype(str(F / "segoeui.ttf"), 34)
altb = ImageFont.truetype(str(F / "segoeuib.ttf"), 34)

d.text((60, 44), "TÜRKÇE VİKİPEDİ OKUMALARINDAN · HER GÜN", font=kucuk, fill=IKINCIL)
d.line((60, 84, W - 60, 84), fill=MUREKKEP, width=2)
d.text((60, 110), "Türkiye bugün", font=baslik, fill=MUREKKEP)
d.text((60, 205), "neyi merak etti?", font=baslik, fill=MUREKKEP)
d.line((60, 318, W - 60, 318), fill=MUREKKEP, width=2)
d.line((60, 326, W - 60, 326), fill=MUREKKEP, width=2)

# Ani yükselişi anlatan çizgi: düz giden, sonda fırlayan okuma.
taban_y, x0, x1 = 560, 620, 1140
noktalar = [(x0 + i * (x1 - x0) / 28, taban_y - (6 if i % 3 else 10)) for i in range(28)]
noktalar += [(x1, 360)]
d.polygon(noktalar + [(x1, taban_y), (x0, taban_y)], fill="#ffe3d6")
d.line(noktalar, fill=VURGU, width=6, joint="curve")
d.line((x0, taban_y - 8, x1, taban_y - 8), fill=IKINCIL, width=1)
d.text((x1 - 10, 370), "629 kat", font=altb, fill=VURGU, anchor="ra")

d.text((60, 380), "Her gün birdenbire", font=alt, fill=MUREKKEP)
d.text((60, 424), "merak edilen maddeler", font=alt, fill=MUREKKEP)
d.text((60, 480), "2015'ten bugüne takvim", font=alt, fill=IKINCIL)
d.rectangle((0, H - 50, W, H), fill=MUREKKEP)
d.text((60, H - 25), "birtohum.github.io/turkiye-merak", font=kucuk, fill=ZEMIN, anchor="lm")
im.save(Path(__file__).resolve().parent.parent / "site" / "og.png", optimize=True)
