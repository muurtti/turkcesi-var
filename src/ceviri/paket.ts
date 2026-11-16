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
  satirlar: Record<string, { tr: string; kaynakOzeti: string }>;
}

export function paketOlustur(d: CeviriDeposu, oyunSurumu: string, cevirenler: string[]): CeviriPaketi {
  const satirlar: CeviriPaketi["satirlar"] = {};
  for (const anahtar of Object.keys(d.satirlar).sort()) {
    const s = d.satirlar[anahtar]!;
    if (s.tr.trim() === "") continue;
    satirlar[anahtar] = { tr: s.tr, kaynakOzeti: s.kaynakOzeti };
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
