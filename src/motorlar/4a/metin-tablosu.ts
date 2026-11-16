// 4A Engine ".lng" metin tablosu (ör. content/localization/stable_us.lng).
// Biçim: docs/notlar/4a-metin-tablosu.md

import { IkiliYazici } from "../../ortak/ikili.js";

export interface MetinSatiri {
  anahtar: string;
  metin: string;
}

interface Bolum {
  tur: number;
  veri: Buffer;
}

export interface MetinTablosu {
  /** Sırasıyla bütün satırlar. `metin` değiştirilebilir. */
  satirlar: MetinSatiri[];
  /** Karakter tablosu: metindeki her bayt bu listedeki bir sıraya karşılık gelir. 0 = satır sonu. */
  karakterler: string[];
  kodlama: "karakter-tablosu";
  /** Okunan haliyle bölümler (tür 1 ve 2 yazarken yeniden üretilir). */
  bolumler: Bolum[];
  /** Okunan satırların kodlu baytları; metin değişmediyse aynen yazılır (bayt bayt eşitlik için). */
  kodlu: Buffer[];
}

const TUR_KARAKTER = 1;
const TUR_SATIRLAR = 2;
const EN_FAZLA_KARAKTER = 256;

function bolumleriOku(buf: Buffer): Bolum[] {
  const bolumler: Bolum[] = [];
  let p = 0;
  while (p < buf.length) {
    if (p + 8 > buf.length) throw new Error("LNG: bölüm başlığı yarım");
    const tur = buf.readUInt32LE(p);
    const boyut = buf.readUInt32LE(p + 4);
    if (p + 8 + boyut > buf.length) throw new Error("LNG: bölüm dosya sonunu aşıyor");
    bolumler.push({ tur, veri: buf.subarray(p + 8, p + 8 + boyut) });
    p += 8 + boyut;
  }
  return bolumler;
}

/**
 * Tabloda aynı anahtar birden çok kez geçebilir (ör. Metro'da 2033\intro: iki farklı zamanlamalı video altyazısı).
 * Satır sırasıyla benzersiz anahtar üretir: ilk geçiş "k", sonrakiler "k#2", "k#3"...
 */
export function benzersizAnahtarlar(t: { satirlar: MetinSatiri[] }): string[] {
  const sayac = new Map<string, number>();
  return t.satirlar.map((s) => {
    const n = (sayac.get(s.anahtar) ?? 0) + 1;
    sayac.set(s.anahtar, n);
    return n === 1 ? s.anahtar : `${s.anahtar}#${n}`;
  });
}

export function metinTablosuOku(buf: Buffer): MetinTablosu {
  const bolumler = bolumleriOku(buf);
  const kb = bolumler.find((b) => b.tur === TUR_KARAKTER);
  const sb = bolumler.find((b) => b.tur === TUR_SATIRLAR);
  if (!kb || !sb) throw new Error("LNG: karakter tablosu ya da satır bölümü yok");
  // Her girdi tek bir UTF-16 birimi.
  const karakterler = Array.from({ length: kb.veri.length / 2 }, (_, i) =>
    String.fromCharCode(kb.veri.readUInt16LE(i * 2)),
  );

  const satirlar: MetinSatiri[] = [];
  const kodlu: Buffer[] = [];
  const v = sb.veri;
  let p = 0;
  while (p < v.length) {
    const a = v.indexOf(0, p);
    if (a < 0) throw new Error("LNG: anahtar sonu bulunamadı");
    const anahtar = v.toString("latin1", p, a);
    const m = v.indexOf(0, a + 1);
    if (m < 0) throw new Error("LNG: metin sonu bulunamadı");
    const baytlar = v.subarray(a + 1, m);
    let metin = "";
    for (const b of baytlar) {
      const c = karakterler[b];
      if (c === undefined) throw new Error(`LNG: karakter tablosunda olmayan sıra ${b}`);
      metin += c;
    }
    satirlar.push({ anahtar, metin });
    kodlu.push(baytlar);
    p = m + 1;
  }
  return { satirlar, karakterler, kodlama: "karakter-tablosu", bolumler, kodlu };
}

/** Bir satırın metnini karakter tablosu sıralarına çevirir; yoksa tabloya ekler. */
function kodla(
  metin: string,
  karakterler: string[],
  sira: Map<string, number>,
  genislet: boolean,
  eksikler: Set<string>,
): Buffer {
  const out: number[] = [];
  for (const c of metin) {
    if (c.length !== 1) throw new Error(`Bu oyun "${c}" karakterini (emoji vb.) gösteremez.`);
    let i = sira.get(c);
    if (i === undefined && !genislet) {
      eksikler.add(c);
      continue;
    }
    if (i === undefined) {
      if (karakterler.length >= EN_FAZLA_KARAKTER) {
        throw new Error(
          `Karakter tablosu doldu (en fazla ${EN_FAZLA_KARAKTER - 1} farklı karakter): "${c}" eklenemedi.`,
        );
      }
      i = karakterler.length;
      karakterler.push(c);
      sira.set(c, i);
    }
    out.push(i);
  }
  return Buffer.from(out);
}

export interface YazmaSecenekleri {
  /**
   * true: tabloda olmayan karakterler tablonun sonuna eklenir. Yalnızca bu karakterler için fontlara da
   * glif eklenecekse kullanın; aksi halde oyun var olmayan glifi okur. Varsayılan: hata ver.
   */
  tabloyuGenislet?: boolean;
}

export function metinTablosuYaz(t: MetinTablosu, secenekler: YazmaSecenekleri = {}): Buffer {
  const genislet = secenekler.tabloyuGenislet ?? false;
  const eksikler = new Set<string>();
  const karakterler = [...t.karakterler];
  const sira = new Map<string, number>();
  // 0 satır sonu olduğu için hiçbir karakter 0'a eşlenmez.
  karakterler.forEach((c, i) => {
    if (i > 0 && !sira.has(c)) sira.set(c, i);
  });

  const govde = new IkiliYazici();
  t.satirlar.forEach((s, i) => {
    govde.bayt(Buffer.from(s.anahtar, "latin1"));
    govde.u8(0);
    const eski = t.kodlu[i];
    const eskiMetin = eski ? [...eski].map((b) => t.karakterler[b]).join("") : undefined;
    govde.bayt(eski && eskiMetin === s.metin ? eski : kodla(s.metin, karakterler, sira, genislet, eksikler));
    govde.u8(0);
  });

  if (eksikler.size > 0) {
    throw new Error(
      `Metinde oyunun karakter tablosunda olmayan karakterler var: ${[...eksikler].map((c) => `"${c}"`).join(" ")}. ` +
        "Bu karakterler oyunda gösterilemez; metni değiştirin ya da karakteri tabloya ve fonta ekleyin.",
    );
  }

  const tablo = Buffer.alloc(karakterler.length * 2);
  karakterler.forEach((c, i) => tablo.writeUInt16LE(c.charCodeAt(0), i * 2));

  const y = new IkiliYazici();
  for (const b of t.bolumler) {
    const veri = b.tur === TUR_KARAKTER ? tablo : b.tur === TUR_SATIRLAR ? govde.sonuc() : b.veri;
    y.u32(b.tur);
    y.u32(veri.length);
    y.bayt(veri);
  }
  return y.sonuc();
}
