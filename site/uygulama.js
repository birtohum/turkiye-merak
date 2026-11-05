"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const sayi = (n) => Math.round(n).toLocaleString("tr-TR");
  const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const KISA_AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const ENGEL = ["2017-04-29", "2019-12-26"];
  const API = "https://wikimedia.org/api/rest_v1/metrics/pageviews";
  const VIKI = "https://tr.wikipedia.org/wiki/";

  const tarih = (s) => new Date(s + "T00:00:00Z");
  const iso = (d) => d.toISOString().slice(0, 10);
  const gunEkle = (s, n) => { const d = tarih(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const uzunTarih = (s) => { const d = tarih(s); return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const gunAdi = (s) => GUNLER[tarih(s).getUTCDay()];
  const ad = (b) => b.replace(/_/g, " ");
  const bag = (b) => VIKI + encodeURIComponent(b).replace(/%2F/g, "/");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const katYaz = (k) => (k >= 100 ? sayi(k) : k.toLocaleString("tr-TR", { maximumFractionDigits: 1 }));

  const onbellek = {};
  const json = (yol) => (onbellek[yol] ||= fetch(yol).then((r) => (r.ok ? r.json() : null)).catch(() => null));

  let SON = null, ILK = null, secili = null;

  /* ---------- İpucu ---------- */
  const ipucu = $("#ipucu");
  function ipucuGoster(html, x, y) {
    ipucu.innerHTML = html; ipucu.hidden = false;
    const w = ipucu.offsetWidth, h = ipucu.offsetHeight;
    let l = x + 14, t = y - h - 10;
    if (l + w > innerWidth - 8) l = x - w - 14;
    if (t < 8) t = y + 16;
    ipucu.style.left = Math.max(8, l) + "px"; ipucu.style.top = t + "px";
  }
  const ipucuGizle = () => { ipucu.hidden = true; };

  /* ---------- Küçük çizgi (kart) ---------- */
  function kucukCizgi(seri, taban) {
    const W = 300, H = 60, n = seri.length, en = Math.max(...seri, 1);
    const x = (i) => (i / (n - 1)) * (W - 8) + 2;
    const y = (v) => H - 4 - (v / en) * (H - 10);
    const yol = seri.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const alan = `${yol}L${x(n - 1).toFixed(1)},${H - 4}L${x(0).toFixed(1)},${H - 4}Z`;
    const ty = y(taban).toFixed(1);
    return `<svg class="cizgi-g" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Son ${n} günün okunma çizgisi; son gün ${sayi(seri[n - 1])}">
      <path d="${alan}" fill="var(--vurgu-acik)"/>
      <line x1="0" x2="${W}" y1="${ty}" y2="${ty}" stroke="var(--soluk)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
      <path d="${yol}" fill="none" stroke="var(--vurgu)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ---------- Gün ---------- */
  async function gunGoster(gun, kaydir) {
    if (gun > SON) gun = SON;
    if (gun < ILK) gun = ILK;
    secili = gun;
    const ay = await json(`veri/gun/${gun.slice(0, 7)}.json`);
    const k = ay && ay[gun];
    $("#gun-adi").innerHTML = `${uzunTarih(gun)}<small>${gunAdi(gun)}${gun === SON ? " · en son gün" : ""}</small>`;
    $("#tarih").value = gun;
    $("#geri").disabled = gun <= ILK;
    $("#ileri").disabled = gun >= SON;
    const url = new URL(location.href);
    url.searchParams.set("gun", gun);
    history.replaceState(null, "", url);
    document.title = `${uzunTarih(gun)}: Türkiye neyi merak etti?`;

    const kartlar = $("#kartlar"), liste = $("#liste");
    $("#sayi-no").textContent = `Sayı ${sayi((tarih(gun) - tarih(ILK)) / 864e5 + 1)}`;
    if (!k) {
      $("#manset").innerHTML = `<p class="ust-baslik">${uzunTarih(gun)}, ${gunAdi(gun)}</p><p class="bos">Bu gün için veri yok. Wikimedia bazı günlerin listesini yayımlamamış.</p>`;
      $("#serit").innerHTML = "";
      kartlar.innerHTML = ""; liste.innerHTML = ""; $("#filtre-not").textContent = "";
      return;
    }
    mansetCiz(gun, k);
    const ogeler = k.p.length
      ? k.p.map((p, i) => `<a href="#k${i}" data-kart="${i}">${esc(ad(p.a))}<b>${katYaz(p.k)} kat</b></a>`)
      : k.top.slice(0, 8).map(([b, v]) => `<a href="${bag(b)}" target="_blank" rel="noopener">${esc(ad(b))}<b>${sayi(v)}</b></a>`);
    const serit = $("#serit");
    // İki kopya: biri ekrandan çıkarken öteki gelir, döngü kesintisiz görünür.
    serit.innerHTML = ogeler.join("") + ogeler.map((o) => o.replace("<a ", '<a tabindex="-1" aria-hidden="true" ')).join("");
    serit.style.animationDuration = `${Math.max(20, ogeler.length * 6)}s`;
    kartlar.innerHTML = k.p.length > 1 ? k.p.slice(1).map((p, i) => kart(p, i + 1)).join("")
      : `<div class="bos">${k.p.length ? "Bu gün başka" : "Bu gün"} birdenbire merak edilen madde yok (ölçüt: en az 1.500 okuma ve olağan gününün 5 katı).</div>`;
    const en = k.top.length ? k.top[0][1] : 1;
    const patlayan = new Set(k.p.map((p) => p.a));
    liste.innerHTML = k.top.map(([b, v, d], i) => `<li>
      <span class="cubuk" style="width:${((v / en) * 100).toFixed(1)}%"></span>
      <span class="sira">${i + 1}</span>
      <span class="ad"><a href="${bag(b)}" target="_blank" rel="noopener">${esc(ad(b))}</a>${patlayan.has(b) ? '<span class="etiket-y">birden</span>' : ""}
        ${d ? `<small>${esc(d)}</small>` : ""}</span>
      <span class="sayi">${sayi(v)}</span></li>`).join("");
    const f = k.f;
    $("#filtre-not").textContent = `Bu gün Wikimedia'nın listesindeki ${sayi(k.n)} sayfadan ${f.sayfa} madde olmayan sayfa, ${f.bot} bot şüpheli sayfa ve ${f.yetiskin} yetişkin içerikli madde çıkarıldı.`
      + (k.fb && k.fb.length ? ` Bot şüphesiyle çıkarılanlardan bazıları: ${k.fb.slice(0, 6).map(ad).join(", ")}.` : "");
    if (kaydir) $(".ust").scrollIntoView({ behavior: "smooth" });
    takvimSec(gun);
  }

  function kart(p, i) {
    const resim = p.i ? `<div class="resim" style="background-image:url('${esc(p.i)}')" role="img" aria-label=""></div>`
      : `<div class="resim" aria-hidden="true">${esc(ad(p.a)[0] || "?")}</div>`;
    const onceki = p.o ? `<p class="not">Bu madde daha önce <a href="?gun=${p.o}" data-gun="${p.o}">${uzunTarih(p.o)}</a> günü de birden merak edilmişti.</p>` : "";
    return `<article class="kart" id="k${i}">
      <div class="kart-ust">${resim}
        <div><h3><a href="${bag(p.a)}" target="_blank" rel="noopener">${esc(ad(p.a))}</a></h3>
        ${p.d ? `<p class="tanim">${esc(p.d)}</p>` : ""}</div>
      </div>
      <div class="kat-satir">
        <span class="kat">${katYaz(p.k)}<small> kat</small></span>
        <span class="karsi">Normalde günde <b>${sayi(p.b)}</b> kişi okuyordu.<br>Bu gün <b>${sayi(p.v)}</b> kişi okudu.</span>
      </div>
      ${kucukCizgi(p.s, p.b)}
      <p class="kucuk" style="margin:-6px 0 0">Son 29 gün · kesik çizgi: olağan gün</p>
      ${p.n ? `<p class="not">${esc(p.n)}</p>` : ""}${onceki}
      <div class="kart-alt">
        <a class="bag" href="${bag(p.a)}" target="_blank" rel="noopener">Vikipedi'de oku</a>
        <button class="bag" data-madde="${esc(p.a)}">Okunma geçmişi</button>
      </div>
    </article>`;
  }

  function mansetCiz(gun, k) {
    const m = $("#manset");
    const bas = `${uzunTarih(gun)}, ${gunAdi(gun)}`;
    if (!k.p.length) {
      const [b, v, d] = k.top[0] || ["", 0, ""];
      m.innerHTML = `<div><p class="ust-baslik">${bas} · en çok okunan madde</p>
        <h1><a href="${bag(b)}" target="_blank" rel="noopener">${esc(ad(b))}</a></h1>
        ${d ? `<p class="tanim">${esc(d)}</p>` : ""}
        <p class="manset-alt">Bu gün <b>${sayi(v)}</b> kez okundu. Birdenbire merak edilen bir madde yoktu.</p></div>`;
      return;
    }
    const p = k.p[0];
    m.innerHTML = `<div><p class="ust-baslik">${bas} · Türkiye en çok bunu merak etti</p>
      <h1><a href="${bag(p.a)}" target="_blank" rel="noopener">${esc(ad(p.a))}</a></h1>
      ${p.d ? `<p class="tanim">${esc(p.d)}</p>` : ""}
      <p class="manset-alt">Normalde günde <b>${sayi(p.b)}</b> kişi okurken bu gün <b>${sayi(p.v)}</b> kişi okudu:
        her zamankinin <span class="kat">${katYaz(p.k)}</span> <b>katı</b>.</p>
      ${p.n ? `<p class="not" style="margin-top:8px">${esc(p.n)}</p>` : ""}
      ${p.o ? `<p class="not">Daha önce <a href="?gun=${p.o}" data-gun="${p.o}">${uzunTarih(p.o)}</a> günü de birden merak edilmişti.</p>` : ""}
      <div class="kart-alt" style="margin-top:12px"><a class="bag" href="${bag(p.a)}" target="_blank" rel="noopener">Vikipedi'de oku</a>
        <button class="bag" data-madde="${esc(p.a)}">Okunma geçmişi</button></div></div>
      <div class="manset-yan">${p.i ? `<div class="manset-resim" style="background-image:url('${esc(p.i.replace(/\/\d+px-/, "/320px-"))}'),url('${esc(p.i)}')" role="img" aria-label="${esc(ad(p.a))}"></div>` : ""}
        ${kucukCizgi(p.s, p.b)}<p class="kucuk" style="margin:-4px 0 0">Son 29 gün · kesik çizgi: olağan gün</p></div>`;
  }

  /* ---------- Doğum günü ---------- */
  function dogumKur() {
    const gs = $("#dogum-gun"), as = $("#dogum-ay");
    gs.innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
    as.innerHTML = AYLAR.map((a, i) => `<option value="${i + 1}">${a}</option>`).join("");
    const p = new URLSearchParams(location.search).get("dogum");
    const d = tarih(SON);
    if (p && /^\d{1,2}-\d{1,2}$/.test(p)) { const [g, a] = p.split("-"); gs.value = +g; as.value = +a; dogumCiz(false); }
    else { gs.value = d.getUTCDate(); as.value = d.getUTCMonth() + 1; }
  }
  async function dogumCiz(kaydet = true) {
    if (!takvim) takvim = await json("veri/takvim.json");
    if (!takvim) return;
    const g = +$("#dogum-gun").value, a = +$("#dogum-ay").value;
    const ek = `-${String(a).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
    const yillar = [];
    for (let y = +SON.slice(0, 4); y >= +ILK.slice(0, 4); y--) if (takvim[y + ek]) yillar.push(y);
    $("#dogum-liste").innerHTML = yillar.length ? yillar.map((y) => {
      const [b, k, v] = takvim[y + ek];
      return `<li><a href="?gun=${y + ek}" data-gun="${y + ek}"><span class="yil">${y}</span>
        <b>${esc(ad(b))}</b><span>${k ? `her zamankinin ${katYaz(k)} katı` : "en çok okunan"}</span></a></li>`;
    }).join("") : `<li class="bos">${g} ${AYLAR[a - 1]} için veri yok${g > 29 && a === 2 ? " (Şubat'ta bu gün yok)" : ""}.</li>`;
    $("#dogum-paylas").hidden = !yillar.length;
    if (kaydet) { const u = new URL(location.href); u.searchParams.set("dogum", `${g}-${a}`); history.replaceState(null, "", u); }
  }
  $("#dogum-form").addEventListener("submit", (e) => { e.preventDefault(); dogumCiz(); });
  $("#paylas-dugme").addEventListener("click", async () => {
    const u = new URL(location.href); u.searchParams.delete("gun"); u.searchParams.delete("madde"); u.hash = "dogum";
    const metin = `${$("#dogum-gun").value} ${AYLAR[$("#dogum-ay").value - 1]} günü Türkiye neyi merak etti?`;
    try {
      if (navigator.share) await navigator.share({ title: metin, url: u.toString() });
      else { await navigator.clipboard.writeText(u.toString()); $("#paylas-not").textContent = "Bağlantı kopyalandı."; }
    } catch { $("#paylas-not").textContent = u.toString(); }
  });

  /* ---------- Takvim ---------- */
  let takvim = null, takvimYil = null, takvimAy = null;
  async function takvimKur() {
    takvim = await json("veri/takvim.json");
    if (!takvim) return;
    const yillar = [];
    for (let y = +ILK.slice(0, 4); y <= +SON.slice(0, 4); y++) yillar.push(y);
    $("#yillar").innerHTML = yillar.map((y) => `<button data-yil="${y}">${y}</button>`).join("");
    $("#aylar").innerHTML = AYLAR.map((a, i) => `<button data-ay="${i + 1}">${a}</button>`).join("");
    takvimSec(secili || SON);
  }
  function takvimSec(gun) {
    if (!takvim) return;
    takvimYil = +gun.slice(0, 4); takvimAy = +gun.slice(5, 7);
    takvimCiz();
  }
  function takvimCiz() {
    document.querySelectorAll("#yillar button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.yil === takvimYil));
    document.querySelectorAll("#aylar button").forEach((b) => {
      const ay = `${takvimYil}-${String(b.dataset.ay).padStart(2, "0")}`;
      b.setAttribute("aria-pressed", +b.dataset.ay === takvimAy);
      b.disabled = ay < ILK.slice(0, 7) || ay > SON.slice(0, 7);
    });
    const onek = `${takvimYil}-${String(takvimAy).padStart(2, "0")}`;
    const gunler = Object.keys(takvim).filter((g) => g.startsWith(onek)).sort();
    $("#ay-listesi").innerHTML = gunler.length ? gunler.map((g) => {
      const [b, k] = takvim[g];
      return `<li><a href="?gun=${g}" data-gun="${g}" class="${g === secili ? "secili" : ""}">
        <span class="g">${+g.slice(8)}<small>${gunAdi(g).slice(0, 3)}</small></span>
        <span class="m"><b>${esc(ad(b))}</b><span>${k ? katYaz(k) + " kat" : "en çok okunan"}</span></span></a></li>`;
    }).join("") : `<li class="bos">Bu ay için veri yok.</li>`;
  }

  /* ---------- Büyük çizgi grafiği ---------- */
  function cizgiGrafik(kutu, seri, ayar = {}) {
    // seri: [[gün, değer], ...] sıralı. Tek seri, tek eksen.
    const W = 1000, H = ayar.yukseklik || 260, sol = 54, sag = 12, ust = 12, alt = 26;
    const n = seri.length;
    if (!n) { kutu.innerHTML = `<p class="bos">Veri yok.</p>`; return; }
    const t0 = tarih(seri[0][0]).getTime(), t1 = tarih(seri[n - 1][0]).getTime() || t0 + 1;
    const en = Math.max(...seri.map((s) => s[1]), 1);
    const adim = guzelAdim(en / 4);
    const tavan = Math.ceil(en / adim) * adim;
    const x = (g) => sol + ((tarih(g).getTime() - t0) / Math.max(1, t1 - t0)) * (W - sol - sag);
    const y = (v) => ust + (1 - v / tavan) * (H - ust - alt);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ayar.etiket || "Günlük okunma")}"><g class="eksen">`;
    for (let v = 0; v <= tavan + 1e-9; v += adim) {
      svg += `<line x1="${sol}" x2="${W - sag}" y1="${y(v)}" y2="${y(v)}"/><text x="${sol - 8}" y="${y(v) + 4}" text-anchor="end">${kisaSayi(v)}</text>`;
    }
    const y0 = +seri[0][0].slice(0, 4), y1 = +seri[n - 1][0].slice(0, 4);
    const yilAdim = y1 - y0 > 6 ? 2 : 1;
    if (y1 > y0) {
      for (let yy = y0 + 1; yy <= y1; yy += yilAdim) {
        const xx = x(`${yy}-01-01`);
        svg += `<text x="${xx}" y="${H - 6}" text-anchor="middle">${yy}</text>`;
      }
    } else {
      for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6))) {
        const g = seri[i][0];
        svg += `<text x="${x(g)}" y="${H - 6}" text-anchor="middle">${+g.slice(8)} ${KISA_AY[+g.slice(5, 7) - 1]}</text>`;
      }
    }
    svg += `</g>`;
    if (ayar.bant && seri[0][0] < ayar.bant[1] && seri[n - 1][0] > ayar.bant[0]) {
      const a = x(ayar.bant[0] < seri[0][0] ? seri[0][0] : ayar.bant[0]), b = x(ayar.bant[1] > seri[n - 1][0] ? seri[n - 1][0] : ayar.bant[1]);
      svg += `<rect x="${a}" y="${ust}" width="${b - a}" height="${H - ust - alt}" fill="var(--bant)"/>
        <text x="${(a + b) / 2}" y="${ust + 16}" text-anchor="middle" style="font:600 12px system-ui;fill:var(--ikincil)">erişim engeli</text>`;
    }
    const yol = seri.map(([g, v], i) => `${i ? "L" : "M"}${x(g).toFixed(1)},${y(v).toFixed(1)}`).join("");
    svg += `<path d="${yol}" fill="none" stroke="${ayar.renk || "var(--mavi)"}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    const noktalar = ayar.noktalar || [];
    const harita = new Map(seri);
    for (const g of noktalar) {
      if (!harita.has(g)) continue;
      svg += `<circle cx="${x(g)}" cy="${y(harita.get(g))}" r="5" fill="var(--vurgu)" stroke="var(--kart)" stroke-width="2"/>`;
    }
    svg += `<line class="imlec" x1="0" x2="0" y1="${ust}" y2="${H - alt}" stroke="var(--murekkep)" stroke-width="1" opacity="0"/>
      <circle class="imlec-n" r="5" fill="var(--murekkep)" opacity="0"/>
      <rect x="${sol}" y="${ust}" width="${W - sol - sag}" height="${H - ust - alt}" fill="transparent" class="dokun"/></svg>`;
    kutu.innerHTML = svg;
    const el = kutu.querySelector("svg"), cizgi = el.querySelector(".imlec"), nok = el.querySelector(".imlec-n");
    const hareket = (e) => {
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const t = t0 + ((px - sol) / (W - sol - sag)) * (t1 - t0);
      let lo = 0, hi = n - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (tarih(seri[m][0]).getTime() < t) lo = m + 1; else hi = m; }
      if (lo > 0 && Math.abs(tarih(seri[lo - 1][0]).getTime() - t) < Math.abs(tarih(seri[lo][0]).getTime() - t)) lo--;
      const [g, v] = seri[lo];
      cizgi.setAttribute("x1", x(g)); cizgi.setAttribute("x2", x(g)); cizgi.setAttribute("opacity", ".35");
      nok.setAttribute("cx", x(g)); nok.setAttribute("cy", y(v)); nok.setAttribute("opacity", "1");
      ipucuGoster(`<b>${uzunTarih(g)}</b><br>${sayi(v)} ${ayar.birim || "okuma"}${noktalar.includes(g) ? "<br>Birden merak edildi" : ""}`, e.clientX, e.clientY);
    };
    const cik = () => { ipucuGizle(); cizgi.setAttribute("opacity", "0"); nok.setAttribute("opacity", "0"); };
    el.addEventListener("pointermove", hareket);
    el.addEventListener("pointerleave", cik);
    if (ayar.tikla) el.addEventListener("click", (e) => {
      const r = el.getBoundingClientRect();
      const t = t0 + ((((e.clientX - r.left) / r.width) * W - sol) / (W - sol - sag)) * (t1 - t0);
      ayar.tikla(iso(new Date(t)));
    });
  }
  function guzelAdim(v) {
    const us = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
    const o = v / us;
    return (o <= 1 ? 1 : o <= 2 ? 2 : o <= 5 ? 5 : 10) * us;
  }
  function kisaSayi(v) {
    if (v >= 1e6) return (v / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " mn";
    if (v >= 1e3) return (v / 1e3).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " bin";
    return String(v);
  }

  async function toplamCiz() {
    const t = await json("veri/toplam.json");
    if (!t) return;
    const gunler = Object.keys(t).sort();
    // 7 günlük ortalama: tek tek günlerin dalgası okumayı zorlaştırıyor.
    const seri = [];
    for (let i = 6; i < gunler.length; i++) {
      let s = 0; for (let j = i - 6; j <= i; j++) s += t[gunler[j]];
      seri.push([gunler[i], s / 7]);
    }
    cizgiGrafik($("#toplam-grafik"), seri, { bant: ENGEL, birim: "okuma (7 günlük ortalama)", etiket: "Türkçe Vikipedi günlük toplam okuma", tikla: (g) => gunGoster(g, true) });
  }

  /* ---------- Arama ---------- */
  let oneriZaman = null;
  $("#ara-kutu").addEventListener("input", (e) => {
    clearTimeout(oneriZaman);
    const q = e.target.value.trim();
    if (q.length < 2) return;
    oneriZaman = setTimeout(async () => {
      try {
        const r = await fetch(`https://tr.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&namespace=0&limit=8&search=${encodeURIComponent(q)}`);
        const [, adlar] = await r.json();
        $("#oneriler").innerHTML = adlar.map((a) => `<option value="${esc(a)}">`).join("");
      } catch { /* öneri olmadan da çalışır */ }
    }, 250);
  });
  $("#ara-form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#ara-kutu").value.trim(); if (q) maddeGoster(q); });

  async function maddeGoster(q, kaydir = true) {
    const kutu = $("#ara-sonuc");
    $("#ara-kutu").value = ad(q);
    kutu.innerHTML = `<p class="kucuk">Yükleniyor…</p>`;
    if (kaydir) $("#ara").scrollIntoView({ behavior: "smooth" });
    let baslik = q.replace(/ /g, "_");
    try {
      const r = await fetch(`https://tr.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&titles=${encodeURIComponent(q)}`);
      const d = await r.json();
      const p = d.query && d.query.pages && d.query.pages[0];
      if (!p || p.missing) { kutu.innerHTML = `<p class="bos">“${esc(q)}” adlı bir madde bulunamadı. Önerilerden birini seçmeyi deneyin.</p>`; return; }
      baslik = p.title.replace(/ /g, "_");
      $("#ara-kutu").value = p.title;
    } catch { /* yönlendirme çözülemezse olduğu gibi dene */ }
    const url = new URL(location.href); url.searchParams.set("madde", baslik); history.replaceState(null, "", url);
    let seri = [];
    try {
      const r = await fetch(`${API}/per-article/tr.wikipedia/all-access/user/${encodeURIComponent(baslik)}/daily/2015070100/${SON.replace(/-/g, "")}00`);
      if (r.ok) seri = (await r.json()).items.map((x) => [`${x.timestamp.slice(0, 4)}-${x.timestamp.slice(4, 6)}-${x.timestamp.slice(6, 8)}`, x.views]);
    } catch { /* aşağıda boş */ }
    if (!seri.length) { kutu.innerHTML = `<p class="bos">${esc(ad(baslik))} için okunma verisi alınamadı.</p>`; return; }
    const patlamalar = (await json("veri/patlamalar.json")) || {};
    const gunleri = patlamalar[baslik] || [];
    const toplam = seri.reduce((a, s) => a + s[1], 0);
    const tepe = seri.reduce((a, s) => (s[1] > a[1] ? s : a));
    const sirali = seri.map((s) => s[1]).sort((a, b) => a - b);
    const ortanca = sirali[Math.floor(sirali.length / 2)];
    kutu.innerHTML = `<h3 style="margin-top:0"><a href="${bag(baslik)}" target="_blank" rel="noopener">${esc(ad(baslik))}</a></h3>
      <div class="ozet">
        <div><b>${sayi(toplam)}</b>toplam okuma (${uzunTarih(seri[0][0])} – ${uzunTarih(seri[seri.length - 1][0])})</div>
        <div><b>${sayi(ortanca)}</b>olağan bir gün (ortanca)</div>
        <div><b>${sayi(tepe[1])}</b>en çok okunduğu gün: <a href="?gun=${tepe[0]}" data-gun="${tepe[0]}">${uzunTarih(tepe[0])}</a></div>
      </div>
      <div class="grafik" id="madde-grafik"></div>
      ${gunleri.length ? `<p class="kucuk" style="margin-top:12px">Bu sitenin “birden merak edilen” olarak yakaladığı günler (${gunleri.length}):</p>
        <div class="patlama-gunleri">${gunleri.map((g) => `<a class="bag" href="?gun=${g}" data-gun="${g}">${uzunTarih(g)}</a>`).join("")}</div>`
        : `<p class="kucuk" style="margin-top:12px">Bu madde hiçbir gün “birden merak edilenler” listesine girmedi.</p>`}`;
    cizgiGrafik($("#madde-grafik"), seri, { bant: ENGEL, noktalar: gunleri, renk: "var(--mavi)", etiket: `${ad(baslik)} günlük okunma`, tikla: (g) => gunGoster(g, true) });
    if (kaydir) $("#ara").scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- Olaylar ---------- */
  $("#geri").addEventListener("click", () => gunGoster(gunEkle(secili, -1)));
  $("#ileri").addEventListener("click", () => gunGoster(gunEkle(secili, 1)));
  $("#tarih").addEventListener("change", (e) => e.target.value && gunGoster(e.target.value));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowLeft" && !$("#geri").disabled) gunGoster(gunEkle(secili, -1));
    if (e.key === "ArrowRight" && !$("#ileri").disabled) gunGoster(gunEkle(secili, 1));
  });
  document.addEventListener("click", (e) => {
    const kt = e.target.closest("[data-kart]");
    if (kt) { e.preventDefault(); const h = $("#k" + kt.dataset.kart) || $("#manset"); h.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const g = e.target.closest("[data-gun]");
    if (g) { e.preventDefault(); gunGoster(g.dataset.gun, true); return; }
    const m = e.target.closest("[data-madde]");
    if (m) { maddeGoster(m.dataset.madde); return; }
    const y = e.target.closest("[data-yil]");
    if (y) { takvimYil = +y.dataset.yil; const ay = `${takvimYil}-${String(takvimAy).padStart(2, "0")}`;
      if (ay > SON.slice(0, 7)) takvimAy = +SON.slice(5, 7); if (ay < ILK.slice(0, 7)) takvimAy = +ILK.slice(5, 7); takvimCiz(); }
    const a = e.target.closest("[data-ay]");
    if (a) { takvimAy = +a.dataset.ay; takvimCiz(); }
  });

  /* ---------- Başlangıç ---------- */
  (async () => {
    const s = await json("veri/son.json");
    if (!s || !s.son) { $("#kartlar").innerHTML = `<div class="bos">Veri yüklenemedi.</div>`; return; }
    SON = s.son; ILK = s.ilk;
    $("#tarih").min = ILK; $("#tarih").max = SON;
    $("#uretim").textContent = `Son güncelleme: ${uzunTarih(s.uretim.slice(0, 10))}`;
    const p = new URLSearchParams(location.search);
    const istenen = p.get("gun");
    await gunGoster(/^\d{4}-\d{2}-\d{2}$/.test(istenen || "") ? istenen : SON);
    takvimKur();
    dogumKur();
    toplamCiz();
    if (p.get("madde")) maddeGoster(p.get("madde"), true);
  })();
})();
