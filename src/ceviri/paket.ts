// Paylaşılabilir çeviri paketi: yalnızca anahtar + Türkçe + kaynak özeti. Çalıştırılabilir kod ve İngilizce metin yok.

import { bosDepo, type CeviriDeposu } from "./depo.js";

export interface CeviriPaketi {
  bicim: 1;
  oyun: string;
  dil: "tr";
  /** Çevirinin yapıldığı oyun sürümü: content.vfx SHA-256. */
  oyunSurumu: string;
  model: string;
  tarih: string;
  cevirenler: string[];
  /** Unreal oyunlarında `ue`: [ad alanı hash'i, anahtar hash'i, İngilizce kaynak hash'i] (metin tablosu için). */
  satirlar: Record<string, { tr: string; kaynakOzeti: string; ue?: [number, number, number] }>;
}

/** Unreal metin tablosundaki bir satırın kimliği (oyunun İngilizce tablosundan alınır). */
export interface UeKimligi {
  adAlaniHash: number;
  anahtarHash: number;
  kaynakHash: number;
}

/** `ue` verilirse (Unreal oyunu) yalnızca kimliği bilinen satırlar pakete girer. */
export function paketOlustur(d: CeviriDeposu, oyunSurumu: string, cevirenler: string[], ue?: Map<string, UeKimligi>): CeviriPaketi {
  const satirlar: CeviriPaketi["satirlar"] = {};
  for (const anahtar of Object.keys(d.satirlar).sort()) {
    const s = d.satirlar[anahtar]!;
    if (s.tr.trim() === "") continue;
    if (!ue) {
      satirlar[anahtar] = { tr: s.tr, kaynakOzeti: s.kaynakOzeti };
      continue;
    }
    const k = ue.get(anahtar);
    if (k) satirlar[anahtar] = { tr: s.tr, kaynakOzeti: s.kaynakOzeti, ue: [k.adAlaniHash, k.anahtarHash, k.kaynakHash] };
  }
  return { bicim: 1, oyun: d.oyun, dil: "tr", oyunSurumu, model: "", tarih: new Date().toISOString(), cevirenler, satirlar };
}

/** Paketi depoya çevirir; paketteki çeviriler gözden geçirilmiş sayılır ("insan"), modelce ezilmez. */
export function paketiDepoyaAl(p: CeviriPaketi): CeviriDeposu {
  if (p.bicim !== 1) throw new Error(`Desteklenmeyen paket biçimi: ${String(p.bicim)}`);
  const d = bosDepo(p.oyun, p.model);
  for (const [anahtar, s] of Object.entries(p.satirlar)) {
    d.satirlar[anahtar] = { tr: s.tr, kaynakOzeti: s.kaynakOzeti, kaynak: "insan", sorunlar: [] };
  }
  return d;
}
