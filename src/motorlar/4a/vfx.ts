// 4A Engine "content.vfx" dizin dosyası (Metro Redux sürüm 1, Metro Exodus sürüm 3).
// Biçim: docs/notlar/4a-vfx-bicimi.md

import { IkiliOkuyucu, IkiliYazici } from "../../ortak/ikili.js";

export interface VfxPaket {
  ad: string;
  klasorler: string[];
  boyut: number;
}

interface KayitOrtak {
  sira: number;
  ad: string;
  /** Kökten itibaren yol, "/" ile; kök klasörün adı boş olduğu için "content/..." diye başlar. */
  yol: string;
  bayrak: number;
  xorAnahtari: number;
}

export interface VfxKlasor extends KayitOrtak {
  tur: "klasor";
  cocukSayisi: number;
  ilkCocuk: number;
}

export interface VfxGirdi extends KayitOrtak {
  tur: "dosya";
  paketNo: number;
  ofset: number;
  boyut: number;
  sikistirilmisBoyut: number;
}

export interface VfxKopya {
  bayrak: number;
  paketNo: number;
  ofset: number;
  boyut: number;
  sikistirilmisBoyut: number;
  kayitSirasi: number;
}

export interface VfxDizin {
  /** Redux: [1, 1]. Exodus: [3, sıkıştırma türü (1 = LZ4)]. */
  surum: [number, number];
  /** Yalnızca sürüm 3 (Exodus): "src_521776-shdr_521776-script_521776" gibi içerik sürümü. */
  icerikSurumu?: string;
  guid: Buffer;
  paketler: VfxPaket[];
  /** Dosyadaki sırasıyla bütün kayıtlar (klasör + dosya). */
  kayitlar: (VfxKlasor | VfxGirdi)[];
  /** Yalnızca dosya kayıtları. */
  dosyalar: VfxGirdi[];
  kopyalar: VfxKopya[];
  sonek: Buffer;
}

const KLASOR_BAYRAGI = 8;

function adCoz(o: IkiliOkuyucu, uzunluk: number, anahtar: number): string {
  const b = o.bayt(uzunluk - 1);
  const cozulmus = Buffer.alloc(b.length);
  for (let i = 0; i < b.length; i++) cozulmus[i] = b[i]! ^ anahtar;
  if (o.u8() !== 0) throw new Error("VFX: ad 0 baytıyla bitmiyor");
  return cozulmus.toString("latin1");
}

export function vfxOku(buf: Buffer): VfxDizin {
  const o = new IkiliOkuyucu(buf);
  const surum: [number, number] = [o.u32(), o.u32()];
  const icerikSurumu = surum[0] >= 3 ? o.cstr() : undefined;
  const guid = Buffer.from(o.bayt(16));
  const paketSayisi = o.u32();
  const kayitSayisi = o.u32();
  const kopyaSayisi = o.u32();

  const paketler: VfxPaket[] = [];
  for (let i = 0; i < paketSayisi; i++) {
    const ad = o.cstr();
    const klasorSayisi = o.u32();
    const klasorler: string[] = [];
    for (let k = 0; k < klasorSayisi; k++) klasorler.push(o.cstr());
    paketler.push({ ad, klasorler, boyut: o.u32() });
  }

  const kayitlar: (VfxKlasor | VfxGirdi)[] = [];
  for (let sira = 0; sira < kayitSayisi; sira++) {
    const bayrak = o.u16();
    if (bayrak & KLASOR_BAYRAGI) {
      const cocukSayisi = o.u16();
      const ilkCocuk = o.u32();
      const uzunluk = o.u8();
      const xorAnahtari = o.u8();
      const ad = adCoz(o, uzunluk, xorAnahtari);
      kayitlar.push({ tur: "klasor", sira, ad, yol: "", bayrak, xorAnahtari, cocukSayisi, ilkCocuk });
    } else {
      const paketNo = o.u16();
      const ofset = o.u32();
      const boyut = o.u32();
      const sikistirilmisBoyut = o.u32();
      const uzunluk = o.u8();
      const xorAnahtari = o.u8();
      const ad = adCoz(o, uzunluk, xorAnahtari);
      kayitlar.push({ tur: "dosya", sira, ad, yol: "", bayrak, xorAnahtari, paketNo, ofset, boyut, sikistirilmisBoyut });
    }
  }

  const kopyalar: VfxKopya[] = [];
  for (let i = 0; i < kopyaSayisi; i++) {
    kopyalar.push({
      bayrak: o.u16(),
      paketNo: o.u16(),
      ofset: o.u32(),
      boyut: o.u32(),
      sikistirilmisBoyut: o.u32(),
      kayitSirasi: o.u32(),
    });
  }
  const sonek = Buffer.from(o.bayt(o.kalan));

  yollariKur(kayitlar);
  const dosyalar = kayitlar.filter((k): k is VfxGirdi => k.tur === "dosya");
  return { surum, ...(icerikSurumu !== undefined && { icerikSurumu }), guid, paketler, kayitlar, dosyalar, kopyalar, sonek };
}

function yollariKur(kayitlar: (VfxKlasor | VfxGirdi)[]): void {
  // Kökten başlayıp her klasörün çocuklarına yol verir (yığınla, özyinelemesiz).
  const yigin: { sira: number; ust: string }[] = [{ sira: 0, ust: "" }];
  while (yigin.length) {
    const { sira, ust } = yigin.pop()!;
    const k = kayitlar[sira];
    if (!k) throw new Error(`VFX: geçersiz kayıt sırası ${sira}`);
    k.yol = ust ? `${ust}/${k.ad}` : k.ad;
    if (k.tur === "klasor") {
      for (let c = k.ilkCocuk; c < k.ilkCocuk + k.cocukSayisi; c++) yigin.push({ sira: c, ust: k.yol });
    }
  }
}

function adYaz(y: IkiliYazici, ad: string, anahtar: number): void {
  const b = Buffer.from(ad, "latin1");
  y.u8(b.length + 1);
  y.u8(anahtar);
  const k = Buffer.alloc(b.length);
  for (let i = 0; i < b.length; i++) k[i] = b[i]! ^ anahtar;
  y.bayt(k);
  y.u8(0);
}

/** Dizini dosya biçimine geri yazar. Değiştirilmemiş bir dizin bayt bayt aynı çıkar. */
export function vfxYaz(d: VfxDizin): Buffer {
  const y = new IkiliYazici();
  y.u32(d.surum[0]);
  y.u32(d.surum[1]);
  if (d.surum[0] >= 3) y.cstr(d.icerikSurumu ?? "");
  y.bayt(d.guid);
  y.u32(d.paketler.length);
  y.u32(d.kayitlar.length);
  y.u32(d.kopyalar.length);
  for (const p of d.paketler) {
    y.cstr(p.ad);
    y.u32(p.klasorler.length);
    for (const k of p.klasorler) y.cstr(k);
    y.u32(p.boyut);
  }
  for (const k of d.kayitlar) {
    y.u16(k.bayrak);
    if (k.tur === "klasor") {
      y.u16(k.cocukSayisi);
      y.u32(k.ilkCocuk);
    } else {
      y.u16(k.paketNo);
      y.u32(k.ofset);
      y.u32(k.boyut);
      y.u32(k.sikistirilmisBoyut);
    }
    adYaz(y, k.ad, k.xorAnahtari);
  }
  for (const k of d.kopyalar) {
    y.u16(k.bayrak);
    y.u16(k.paketNo);
    y.u32(k.ofset);
    y.u32(k.boyut);
    y.u32(k.sikistirilmisBoyut);
    y.u32(k.kayitSirasi);
  }
  y.bayt(d.sonek);
  return y.sonuc();
}

/** Yolu verilen sonla biten dosyaları döndürür (büyük/küçük harf duyarsız, "/" ile). */
export function girdiBul(d: VfxDizin, yolSonu: string): VfxGirdi[] {
  const s = yolSonu.toLowerCase().replaceAll("\\", "/");
  return d.dosyalar.filter((g) => {
    const y = g.yol.toLowerCase();
    return y === s || y.endsWith("/" + s);
  });
}
