// Kaldığı yerden devam ettirilebilen çeviri deposu. İngilizce metin saklanmaz (yalnızca kaynak özeti).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ceviriSorunlari, type Sorun } from "./dogrula.js";
import { kaynakOzeti, type CeviriSatiri } from "./satirlar.js";

export interface SozlukGirdisi {
  en: string;
  tr: string;
  not?: string;
}

export interface DepoSatiri {
  tr: string;
  kaynakOzeti: string;
  kaynak: "model" | "insan";
  sorunlar: Sorun[];
  not?: string;
}

export interface CeviriDeposu {
  oyun: string;
  model: string;
  sozluk: SozlukGirdisi[];
  satirlar: Record<string, DepoSatiri>;
  /** Gönderilmiş ama sonuçları alınmamış toplu iş. */
  toplu?: {
    id: string;
    /** sıra numarası → o gruptaki satırlar (anahtar + gönderildiği andaki kaynak özeti) */
    gruplar: { anahtar: string; ozet: string }[][];
    gonderim: string;
    /** İşin gönderildiği model (devam ederken fiyat ve yeniden denemeler bununla). */
    model?: string;
  };
}

const DOSYA = "depo.json";
const GECICI = ".tv-gecici";

export function bosDepo(oyun: string, model: string): CeviriDeposu {
  return { oyun, model, sozluk: [], satirlar: {} };
}

/** Takılı kalan (sonucu alınamayan) toplu işi unutur; çevirilere dokunmaz. İş varsa true. */
export function topluIsiBirak(d: CeviriDeposu): boolean {
  if (!d.toplu) return false;
  delete d.toplu;
  return true;
}

export function depoOku(klasor: string): CeviriDeposu | undefined {
  const y = join(klasor, DOSYA);
  if (!existsSync(y)) return undefined;
  try {
    return JSON.parse(readFileSync(y, "utf8")) as CeviriDeposu;
  } catch {
    throw new Error(`Çeviri deposu bozuk: ${y}`);
  }
}

/** Atomik yazar: önce geçici dosya, sonra yeniden adlandırma. */
export function depoYaz(klasor: string, d: CeviriDeposu): void {
  mkdirSync(klasor, { recursive: true });
  const y = join(klasor, DOSYA);
  writeFileSync(y + GECICI, JSON.stringify(d, null, 1));
  renameSync(y + GECICI, y);
}

/** Model çevirisini ekler; aynı kaynak metin için insan düzeltmesi varsa dokunmaz. */
export function modelCevirisiEkle(d: CeviriDeposu, s: CeviriSatiri, tr: string, sorunlar: Sorun[], not?: string): void {
  const ozet = kaynakOzeti(s.en);
  const var_ = d.satirlar[s.anahtar];
  if (var_?.kaynak === "insan" && var_.kaynakOzeti === ozet) return;
  d.satirlar[s.anahtar] = { tr, kaynakOzeti: ozet, kaynak: "model", sorunlar, ...(not ? { not } : {}) };
}

export function insanDuzeltmesi(d: CeviriDeposu, s: CeviriSatiri, tr: string, sorunlar: Sorun[]): void {
  d.satirlar[s.anahtar] = { tr, kaynakOzeti: kaynakOzeti(s.en), kaynak: "insan", sorunlar };
}

const ENGELLEYEN: Sorun[] = ["bos", "isaret-bozuk", "karakter-yok"];

/**
 * Oyuna konabilecek çevirileri seçer. Sorunlar burada YENİDEN hesaplanır (depodaki değerlere güvenilmez;
 * başkasından gelen paketler de denetlenir).
 */
export function uygulanabilirCeviriler(
  d: CeviriDeposu,
  satirlar: CeviriSatiri[],
  kullanilabilir: Set<string>,
): { ceviriler: Map<string, string>; guncelDegil: string[]; sorunlu: string[] } {
  const ceviriler = new Map<string, string>();
  const guncelDegil: string[] = [];
  const sorunlu: string[] = [];
  for (const s of satirlar) {
    const ds = d.satirlar[s.anahtar];
    if (!ds) continue;
    if (ds.kaynakOzeti !== kaynakOzeti(s.en)) {
      guncelDegil.push(s.anahtar);
      continue;
    }
    const sorunlar = ceviriSorunlari(s, ds.tr, kullanilabilir);
    if (sorunlar.length > 0) sorunlu.push(s.anahtar);
    if (sorunlar.some((x) => ENGELLEYEN.includes(x))) continue;
    ceviriler.set(s.anahtar, ds.tr);
  }
  return { ceviriler, guncelDegil, sorunlu };
}
