// Metro Redux fontlarına ğ Ğ ş Ş ı İ harflerini, oyunun kendi gliflerinden türeterek ekler.
// Yöntem: docs/notlar/4a-font.md ("Türkçe harfler için yöntem")

import type { Doku, FontKaydi, Glif } from "./font.js";

/** Karakter tablosunda Türkçe harflerin yerleşeceği (kullanılmayan \x01–\x06) yuvalar. */
export const TURKCE_YUVALAR = { ğ: 176, Ğ: 177, ş: 178, Ş: 179, ı: 180, İ: 181 } as const;
export type TurkceHarf = keyof typeof TURKCE_YUVALAR;
export type TurkceYuvalar = Record<TurkceHarf, number>;
/** Metro Exodus: us karakter tablosundaki kullanılmayan \x01–\x06 yuvaları 105–110'dur. */
// İ, 110 (\x06) yerine 111'de (\x07, o da kullanılmıyor): menü etiketi denemelerinde 110'un sorunsuz olduğu
// kanıtlanamadı; 111 aynı derecede güvenli.
export const TURKCE_YUVALAR_EXODUS: TurkceYuvalar = { ğ: 105, Ğ: 106, ş: 107, Ş: 108, ı: 109, İ: 111 };

/**
 * Exodus menüdeki kâğıt etiketleri yazmadan önce metni İngilizce kurallarla büyük harfe çevirir ve bu sırada
 * "İ"yi "I"ya dönüştürür (oyunda doğrulandı, 16 Kasım 2026). Bu yüzden İ, karakter tablosunda büyük/küçük harf
 * dönüşümünden etkilenmeyen bir özel kullanım alanı karakteriyle temsil edilir; glifi yine noktalı İ'dir.
 * Metne yazarken bütün "İ"ler bu karaktere çevrilir.
 */
export const EXODUS_I_KODU = "";

/** Exodus'ta Türkçe harflerin konduğu, metinlerde kullanılmayan kontrol karakterleri (EE'de 105–109 ve 111). */
const EXODUS_KONTROL: Record<TurkceHarf, string> = { ğ: "\x01", Ğ: "\x02", ş: "\x03", Ş: "\x04", ı: "\x05", İ: "\x07" };

/**
 * Exodus karakter tablosunda Türkçe harflerin yuvaları. Sürümden sürüme tablo sırası değiştiği için (EE ile normal
 * sürüm farklı) yuvalar sabit sayı değil, bu kontrol karakterlerinin tablodaki yerinden bulunur.
 * Tablo zaten yamalıysa ya da karakterlerden biri yoksa undefined.
 */
export function exodusYuvalari(karakterler: string[]): TurkceYuvalar | undefined {
  const y = {} as TurkceYuvalar;
  for (const [harf, kontrol] of Object.entries(EXODUS_KONTROL) as [TurkceHarf, string][]) {
    const i = karakterler.indexOf(kontrol);
    if (i < 0) return undefined;
    y[harf] = i;
  }
  return y;
}

/** Kalem uzayında (xOfset/yOfset koordinatları) RGBA bir resim parçası. */
interface Parca {
  x: number; // kalem uzayında sol
  y: number; // kalem uzayında üst
  gen: number;
  yuk: number;
  rgba: Buffer;
}

const ESIK = 24; // bu parlaklığın altı "boş" sayılır

function parlaklik(rgba: Buffer, k: number): number {
  return Math.max(rgba[k]!, rgba[k + 1]!, rgba[k + 2]!);
}

/** Bir glifin dokudaki piksellerini kalem uzayında bir parça olarak keser. */
function glifParcasi(doku: Doku, g: Glif): Parca {
  const rgba = Buffer.alloc(g.gen * g.yuk * 4);
  for (let y = 0; y < g.yuk; y++) {
    for (let x = 0; x < g.gen; x++) {
      const dx = g.x + x;
      const dy = g.y + y;
      if (dx < 0 || dy < 0 || dx >= doku.gen || dy >= doku.yuk) continue;
      doku.rgba.copy(rgba, (y * g.gen + x) * 4, (dy * doku.gen + dx) * 4, (dy * doku.gen + dx) * 4 + 4);
    }
  }
  return { x: g.xOfset, y: g.yOfset, gen: g.gen, yuk: g.yuk, rgba };
}

/** Parçanın kalem uzayında [ust, alt) satır aralığını keser ve boş kenarları kırpar. */
function satirKes(p: Parca, ust: number, alt: number): Parca | undefined {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < p.yuk; y++) {
    const ky = p.y + y;
    if (ky < ust || ky >= alt) continue;
    for (let x = 0; x < p.gen; x++) {
      if (parlaklik(p.rgba, (y * p.gen + x) * 4) < ESIK) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x0 === Infinity) return undefined;
  // Dış çizgi (koyu kenar) kaybolmasın diye 1 piksel pay bırak.
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
  x1 = Math.min(p.gen - 1, x1 + 1); y1 = Math.min(p.yuk - 1, y1 + 1);
  const gen = x1 - x0 + 1, yuk = y1 - y0 + 1;
  const rgba = Buffer.alloc(gen * yuk * 4);
  for (let y = 0; y < yuk; y++) {
    const ky = p.y + y0 + y;
    if (ky < ust || ky >= alt) continue;
    p.rgba.copy(rgba, y * gen * 4, ((y0 + y) * p.gen + x0) * 4, ((y0 + y) * p.gen + x1 + 1) * 4);
  }
  return { x: p.x + x0, y: p.y + y0, gen, yuk, rgba };
}

/** Alan ortalamasıyla yeniden boyutlandırır. */
function olcekle(p: Parca, gen: number, yuk: number): Parca {
  const rgba = Buffer.alloc(gen * yuk * 4);
  for (let y = 0; y < yuk; y++) {
    for (let x = 0; x < gen; x++) {
      const sx0 = (x * p.gen) / gen, sx1 = ((x + 1) * p.gen) / gen;
      const sy0 = (y * p.yuk) / yuk, sy1 = ((y + 1) * p.yuk) / yuk;
      const t = [0, 0, 0, 0];
      let alan = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
          const w = (Math.min(sx + 1, sx1) - Math.max(sx, sx0)) * wy;
          const k = (sy * p.gen + sx) * 4;
          for (let c = 0; c < 4; c++) t[c]! += p.rgba[k + c]! * w;
          alan += w;
        }
      }
      for (let c = 0; c < 4; c++) rgba[(y * gen + x) * 4 + c] = Math.round(t[c]! / alan);
    }
  }
  return { ...p, gen, yuk, rgba };
}

function tasi(p: Parca, x: number, y: number): Parca {
  return { ...p, x, y };
}

/** Parçaları üst üste koyar (parlak olan piksel kazanır). */
function birlestir(parcalar: Parca[]): Parca {
  const x0 = Math.min(...parcalar.map((p) => p.x));
  const y0 = Math.min(...parcalar.map((p) => p.y));
  const x1 = Math.max(...parcalar.map((p) => p.x + p.gen));
  const y1 = Math.max(...parcalar.map((p) => p.y + p.yuk));
  const gen = x1 - x0, yuk = y1 - y0;
  const rgba = Buffer.alloc(gen * yuk * 4);
  for (const p of parcalar) {
    for (let y = 0; y < p.yuk; y++) {
      for (let x = 0; x < p.gen; x++) {
        const ks = (y * p.gen + x) * 4;
        const kh = ((p.y - y0 + y) * gen + (p.x - x0 + x)) * 4;
        if (parlaklik(p.rgba, ks) > parlaklik(rgba, kh)) p.rgba.copy(rgba, kh, ks, ks + 4);
      }
    }
  }
  return { x: x0, y: y0, gen, yuk, rgba };
}

const DOLGU = 150; // harfin parlak iç dolgusu (kenar çizgisi daha koyu)
/**
 * Ä'dan alınan tek noktanın büyütme oranı. Exodus el yazısı fontunda ölçüldü: 1,7'de nokta 512/256/128 mip
 * seviyelerinde Ä'nın noktaları kadar güçlü kalır (uzaktaki 3D menü etiketlerinde kaybolmaz).
 */
const NOKTA_BUYUTME = 1.7;

/**
 * 'i' glifini nokta ve gövde olarak ayırır. Kesim, parlak dolgu satırlarında nokta ile gövde arasındaki
 * gerçek boşluğun ortasından yapılır (koyu kenar çizgileri birbirine değse bile). Kesim satırını
 * kalem uzayında döndürür; ayrılamazsa undefined.
 */
function noktaKesimi(p: Parca): number | undefined {
  const dolu: boolean[] = [];
  for (let y = 0; y < p.yuk; y++) {
    let v = false;
    for (let x = 0; x < p.gen && !v; x++) if (parlaklik(p.rgba, (y * p.gen + x) * 4) > DOLGU) v = true;
    dolu.push(v);
  }
  const parcalar: [number, number][] = [];
  dolu.forEach((v, y) => {
    if (v && (y === 0 || !dolu[y - 1])) parcalar.push([y, y]);
    if (v) parcalar[parcalar.length - 1]![1] = y;
  });
  if (parcalar.length < 2) return undefined;
  const govde = parcalar[parcalar.length - 1]!;
  const nokta = parcalar[parcalar.length - 2]!;
  return p.y + Math.ceil((nokta[1] + govde[0] + 1) / 2);
}

function ortaX(p: Parca): number {
  return p.x + p.gen / 2;
}

/** Dokuda verilen boyutta, mevcut gliflerle çakışmayan ilk yeri bulur (alttan yukarı değil, soldan sağa/yukarıdan aşağı). */
function yerBul(dolu: Uint8Array, dGen: number, dYuk: number, gen: number, yuk: number): { x: number; y: number } {
  for (let y = 0; y + yuk <= dYuk; y++) {
    for (let x = 0; x + gen <= dGen; x++) {
      let bos = true;
      for (let yy = y; yy < y + yuk && bos; yy++) for (let xx = x; xx < x + gen; xx++) if (dolu[yy * dGen + xx]) { bos = false; break; }
      if (bos) return { x, y };
    }
  }
  throw new Error("Font dokusunda yeni harfler için yer kalmadı.");
}

function isaretle(dolu: Uint8Array, dGen: number, dYuk: number, g: { x: number; y: number; gen: number; yuk: number }, pay: number): void {
  for (let y = Math.max(0, g.y - pay); y < Math.min(dYuk, g.y + g.yuk + pay); y++)
    for (let x = Math.max(0, g.x - pay); x < Math.min(dGen, g.x + g.gen + pay); x++) dolu[y * dGen + x] = 1;
}

/**
 * ğ Ğ ş Ş ı İ harflerini fontun kendi gliflerinden türetip dokuya çizer.
 * `karakterler`: .lng karakter tablosu (glif sırası). Font kaydını değiştirmez; yeni glifleri döndürür.
 */
export function turkceHarfEkle(
  font: FontKaydi,
  doku: Doku,
  karakterler: string[],
  yuvalar: TurkceYuvalar = TURKCE_YUVALAR,
): { glifler: Map<number, Glif>; doku: Doku } {
  const glif = (c: string): Glif => {
    const i = karakterler.indexOf(c);
    const g = i >= 0 ? font.glifler[i] : undefined;
    if (!g || g.gen === 0) throw new Error(`Fontta "${c}" glifi yok; Türkçe harf türetilemiyor.`);
    return g;
  };
  const parca = (c: string) => glifParcasi(doku, glif(c));
  const xYuksekligiUst = glif("s").yOfset; // küçük harflerin üst çizgisi
  const buyukUst = glif("A").yOfset; // büyük harflerin üst çizgisi
  const tabanAlti = (c: string) => glif(c).yOfset + glif(c).yuk; // harfin alt kenarı

  // Yalnızca büyük harfli font mu? (harita fontu gibi: 'i' = 'I', 's' = 'S' boyunda)
  const buyukHarfli =
    glif("i").yuk === glif("I").yuk && glif("i").yOfset === glif("I").yOfset && glif("s").yuk === glif("S").yuk;

  const zorunlu = <T,>(ad: string, p: T | undefined): T => {
    if (!p) throw new Error(`Türkçe harf parçası bulunamadı: ${ad}`);
    return p;
  };
  const buyukCengel = zorunlu("büyük çengel", satirKes(parca("Ç"), tabanAlti("C") - 1, 1000));
  const buyukSapka = zorunlu("büyük şapka", satirKes(parca("Â"), -1000, buyukUst - 1)); // ^ yerini/boyunu verir
  const u = zorunlu("u", satirKes(parca("u"), -1000, 1000));
  const hizala = (p: Parca, temel: Parca, y: number) => tasi(p, Math.round(ortaX(temel) - p.gen / 2), y);
  const kisa = (temel: Parca, sapka: Parca) => {
    const k = olcekle(u, sapka.gen, Math.max(3, Math.round(sapka.yuk * 0.9)));
    return hizala(k, temel, sapka.y + sapka.yuk - k.yuk);
  };
  const G = parca("G"), S = parca("S"), I = parca("I");

  // Nokta: küçük harfli fontta i'nin noktası; büyük harfli fontta (ya da i'si noktasız "küçük büyük harfli"
  // fontta, ör. Exodus jenerik başlıkları) Ä'nın sol noktası.
  const aNoktasi = (): { nokta: Parca; noktaBosluk: number } => {
    const iki = zorunlu("Ä noktaları", satirKes(parca("Ä"), -1000, buyukUst - 1));
    // Soldaki noktayı bütün olarak al: dolgu sütunlarının ilk kesintisiz bölümü (+ dış çizgi için 2 piksel pay).
    // Noktalar harfin ortasında olmayabilir (el yazısı fontta sağ üstte); yarıdan kesmek noktayı bölebilir.
    const doluSutun = Array.from({ length: iki.gen }, (_, x) => {
      for (let y = 0; y < iki.yuk; y++) if (parlaklik(iki.rgba, (y * iki.gen + x) * 4) > DOLGU) return true;
      return false;
    });
    const ilk = doluSutun.indexOf(true);
    let son = ilk;
    while (son + 1 < iki.gen && doluSutun[son + 1]) son++;
    const ayrik = ilk >= 0 && doluSutun.slice(son + 1).includes(true); // iki ayrı nokta bulundu
    const solBas = ayrik ? Math.max(0, ilk - 2) : 0;
    const solGen = ayrik ? Math.min(iki.gen, son + 3) - solBas : Math.floor(iki.gen / 2);
    const sol: Parca = { ...iki, x: iki.x + solBas, gen: solGen, rgba: Buffer.alloc(solGen * iki.yuk * 4) };
    for (let y = 0; y < iki.yuk; y++) iki.rgba.copy(sol.rgba, y * solGen * 4, (y * iki.gen + solBas) * 4, (y * iki.gen + solBas + solGen) * 4);
    const kesik = zorunlu("nokta", satirKes(sol, -1000, 1000));
    // Tek nokta, Ä'nın iki noktasının yarı ağırlığındadır; küçük mip seviyelerinde (uzaktaki 3D etiketler)
    // kaybolmasın diye biraz büyütülür. Alt kenarı yerinde kalır (harfle arası değişmez).
    const gen = Math.max(kesik.gen, Math.round(kesik.gen * NOKTA_BUYUTME));
    const yuk = Math.max(kesik.yuk, Math.round(kesik.yuk * NOKTA_BUYUTME));
    const n = { ...olcekle(kesik, gen, yuk), x: kesik.x - Math.round((gen - kesik.gen) / 2), y: kesik.y + kesik.yuk - yuk };
    return { nokta: n, noktaBosluk: buyukUst - (n.y + n.yuk) };
  };
  let nokta: Parca;
  let noktaBosluk: number;
  let noktasizI = false; // küçük i'nin zaten noktası yok (küçük büyük harfli font)
  const iKesimi = noktaKesimi(parca("i")) ?? xYuksekligiUst - 1;
  const iNoktasi = buyukHarfli ? undefined : satirKes(parca("i"), -1000, iKesimi);
  const iGovdesi = buyukHarfli ? undefined : satirKes(parca("i"), iKesimi, 1000);
  if (iNoktasi && iGovdesi) {
    nokta = iNoktasi;
    noktaBosluk = iGovdesi.y - (nokta.y + nokta.yuk);
  } else {
    ({ nokta, noktaBosluk } = aNoktasi());
    noktasizI = !buyukHarfli;
  }

  const cizilecek: Partial<Record<TurkceHarf, { resim: Parca; temel: Glif }>> = {
    Ğ: { resim: birlestir([G, kisa(G, buyukSapka)]), temel: glif("G") },
    Ş: { resim: birlestir([S, hizala(buyukCengel, S, buyukCengel.y)]), temel: glif("S") },
    İ: { resim: birlestir([I, hizala(nokta, I, I.y - noktaBosluk - nokta.yuk)]), temel: glif("I") },
  };
  if (!buyukHarfli) {
    const g = parca("g"), s = parca("s");
    const kucukCengel = zorunlu("küçük çengel", satirKes(parca("ç"), tabanAlti("c") - 1, 1000));
    // ˇ (š) ya da o yoksa ^ (â) yalnızca küçük şapkanın yerini/boyunu verir; çizilen şekil u'dan türetilir.
    const sapkali = karakterler.includes("š") ? "š" : "â";
    const kucukSapka = zorunlu("küçük şapka", satirKes(parca(sapkali), -1000, xYuksekligiUst - 1));
    // ı: i'nin gövdesi; i zaten noktasızsa i'nin kendisi.
    const govde = noktasizI ? zorunlu("i", satirKes(parca("i"), -1000, 1000)) : zorunlu("i gövdesi", iGovdesi);
    cizilecek.ğ = { resim: birlestir([g, kisa(g, kucukSapka)]), temel: glif("g") };
    cizilecek.ş = { resim: birlestir([s, hizala(kucukCengel, s, kucukCengel.y)]), temel: glif("s") };
    cizilecek.ı = { resim: tasi(govde, govde.x, govde.y), temel: glif("i") };
  }

  // Yerleştirme
  const dolu = new Uint8Array(doku.gen * doku.yuk);
  font.glifler.forEach((x) => {
    if (x.gen > 0) isaretle(dolu, doku.gen, doku.yuk, x, 2);
  });
  const rgba = Buffer.from(doku.rgba);
  const glifler = new Map<number, Glif>();
  const yerlestir = (resim: Parca, temel: Glif): Glif => {
    const yer = yerBul(dolu, doku.gen, doku.yuk, resim.gen, resim.yuk);
    for (let y = 0; y < resim.yuk; y++) {
      for (let x = 0; x < resim.gen; x++) {
        const ks = (y * resim.gen + x) * 4;
        const kh = ((yer.y + y) * doku.gen + yer.x + x) * 4;
        // Boş pikseller dokunun arka planı gibi opak siyah olur.
        if (parlaklik(resim.rgba, ks) < ESIK) rgba.set([0, 0, 0, 255], kh);
        else resim.rgba.copy(rgba, kh, ks, ks + 4);
      }
    }
    const yeniGlif: Glif = {
      x: yer.x,
      y: yer.y,
      gen: resim.gen,
      yuk: resim.yuk,
      xOfset: resim.x,
      yOfset: resim.y,
      ilerleme: temel.ilerleme,
    };
    isaretle(dolu, doku.gen, doku.yuk, yeniGlif, 2);
    return yeniGlif;
  };
  for (const [harf, { resim, temel }] of Object.entries(cizilecek) as [TurkceHarf, { resim: Parca; temel: Glif }][]) {
    glifler.set(yuvalar[harf], yerlestir(resim, temel));
  }
  if (noktasizI) {
    // Küçük büyük harfli fontta küçük i noktasız çizilmiş; Türkçede i noktalı olmalı (ı ayrı yuvada).
    const iP = zorunlu("i", satirKes(parca("i"), -1000, 1000));
    const resim = birlestir([iP, hizala(nokta, iP, iP.y - noktaBosluk - nokta.yuk)]);
    glifler.set(karakterler.indexOf("i"), yerlestir(resim, glif("i")));
  }

  if (buyukHarfli) {
    // Büyük harfli fontta küçük harfler büyük çizilir; Türkçede i'nin büyüğü İ, ı'nınki I'dır.
    glifler.set(yuvalar.ğ, glifler.get(yuvalar.Ğ)!);
    glifler.set(yuvalar.ş, glifler.get(yuvalar.Ş)!);
    glifler.set(yuvalar.ı, { ...glif("I") });
    glifler.set(karakterler.indexOf("i"), glifler.get(yuvalar.İ)!);
  }
  return { glifler, doku: { ...doku, rgba } };
}
