// 4A Engine VFS paketlerinden dosya çıkarma. Biçim: docs/notlar/4a-vfx-bicimi.md

import { closeSync, existsSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import type { VfxDizin, VfxGirdi } from "./vfx.js";

/** En büyük açık parça boyutu (0x30000). */
export const PARCA_BOYUTU = 0x30000;

/**
 * Tek bir LZ4 bloğunu `cikti` tamponunun `konum` noktasından itibaren açar.
 * Önceki çıktı sözlük olarak kullanılabilir (bağlı bloklar). Yeni konumu döndürür.
 */
function lz4BlokAc(kaynak: Buffer, cikti: Buffer, konum: number): number {
  let i = 0;
  let o = konum;
  while (i < kaynak.length) {
    const jeton = kaynak[i++]!;
    let literal = jeton >> 4;
    if (literal === 15) {
      let b: number;
      do {
        b = kaynak[i++]!;
        literal += b;
      } while (b === 255);
    }
    if (o + literal > cikti.length) throw new Error("LZ4: çıktı boyutu aşıldı");
    kaynak.copy(cikti, o, i, i + literal);
    i += literal;
    o += literal;
    if (i >= kaynak.length) break;

    const geri = kaynak[i]! | (kaynak[i + 1]! << 8);
    i += 2;
    let esles = jeton & 15;
    if (esles === 15) {
      let b: number;
      do {
        b = kaynak[i++]!;
        esles += b;
      } while (b === 255);
    }
    esles += 4;
    const bas = o - geri;
    if (geri === 0 || bas < 0) throw new Error("LZ4: geçersiz geri başvuru");
    if (o + esles > cikti.length) throw new Error("LZ4: çıktı boyutu aşıldı");
    // Çakışabilen kopya; bayt bayt.
    for (let k = 0; k < esles; k++) cikti[o + k] = cikti[bas + k]!;
    o += esles;
  }
  return o;
}

/** [u32 parçaBoyutu][u32 açıkBoyut][LZ4] parçalarından oluşan veriyi açar. */
export function lz4ParcaliAc(veri: Buffer, acikBoyut: number): Buffer {
  const cikti = Buffer.alloc(acikBoyut);
  let p = 0;
  let o = 0;
  while (p < veri.length) {
    const parcaBoyutu = veri.readUInt32LE(p);
    const parcaAcik = veri.readUInt32LE(p + 4);
    if (parcaBoyutu < 8 || p + parcaBoyutu > veri.length) throw new Error("LZ4: bozuk parça başlığı");
    const yeni = lz4BlokAc(veri.subarray(p + 8, p + parcaBoyutu), cikti, o);
    if (yeni - o !== parcaAcik) throw new Error(`LZ4: parça açık boyutu tutmuyor (${yeni - o} ≠ ${parcaAcik})`);
    o = yeni;
    p += parcaBoyutu;
  }
  if (o !== acikBoyut) throw new Error(`LZ4: toplam açık boyut tutmuyor (${o} ≠ ${acikBoyut})`);
  return cikti;
}

function paketYolu(paketKlasorleri: string[], ad: string): string {
  for (const k of paketKlasorleri) {
    const y = join(k, ad);
    if (existsSync(y)) return y;
  }
  throw new Error(`Paket dosyası bulunamadı: ${ad}`);
}

function hamOku(yol: string, ofset: number, boyut: number): Buffer {
  const b = Buffer.alloc(boyut);
  const fd = openSync(yol, "r");
  try {
    let okunan = 0;
    while (okunan < boyut) {
      const n = readSync(fd, b, okunan, boyut - okunan, ofset + okunan);
      if (n === 0) throw new Error("Paket dosyası beklenenden kısa");
      okunan += n;
    }
  } finally {
    closeSync(fd);
  }
  return b;
}

/**
 * Bir dosyayı paketinden okuyup açar. Paket dosyası `paketKlasorleri` içinde sırayla aranır
 * (yama paketini geçici klasörden, orijinalleri oyun klasöründen okumak için).
 */
export function dosyaCikar(paketKlasorleri: string[], d: VfxDizin, g: VfxGirdi): Buffer {
  const paket = d.paketler[g.paketNo];
  if (!paket) throw new Error(`Geçersiz paket numarası: ${g.paketNo}`);
  const ham = hamOku(paketYolu(paketKlasorleri, paket.ad), g.ofset, g.sikistirilmisBoyut);
  if (g.boyut === g.sikistirilmisBoyut) return ham;
  return lz4ParcaliAc(ham, g.boyut);
}
