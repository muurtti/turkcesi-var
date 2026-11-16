// Çevirinin oyuna güvenle konulabilir olup olmadığını denetler. Motordan bağımsız.

import type { CeviriSatiri } from "./satirlar.js";

/**
 * Korunması gereken işaretler (oyunda gerçekten görülenler: <use>, <#crouch_toggle>, <br>, $ed_adv_5, [a-z]).
 * Sırayla: printf (%s, %d), {0}, <...>, boşluksuz [..], kaçışlı \n, gerçek satır sonu, $değişken.
 */
const ISARET = /%[-+0-9.]*[sdif%]|\{[^}]*\}|<[^>]*>|\[[^\]\s]*\]|\\n|\n|\$[a-z][a-z0-9_]*/g;

export function korunacakIsaretler(metin: string): string[] {
  return metin.match(ISARET) ?? [];
}

/** Metni düz metin ve işaret parçalarına böler (arayüzde işaretleri vurgulamak için). */
export function isaretleBol(metin: string): { metin: string; isaret: boolean }[] {
  const parcalar: { metin: string; isaret: boolean }[] = [];
  let son = 0;
  for (const m of metin.matchAll(ISARET)) {
    if (m.index > son) parcalar.push({ metin: metin.slice(son, m.index), isaret: false });
    parcalar.push({ metin: m[0], isaret: true });
    son = m.index + m[0].length;
  }
  if (son < metin.length) parcalar.push({ metin: metin.slice(son), isaret: false });
  return parcalar;
}

export const ENGELLEYEN_SORUNLAR: readonly Sorun[] = ["bos", "isaret-bozuk", "karakter-yok"];

export type Sorun = "isaret-bozuk" | "bos" | "karakter-yok" | "cok-uzun" | "ingilizce-kalmis";

function ayniCokluKume(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

/** `kullanilabilir`: oyunun gösterebildiği karakterler (karakter tablosu ∪ eklenen Türkçe harfler). */
export function ceviriSorunlari(s: CeviriSatiri, tr: string, kullanilabilir: Set<string>): Sorun[] {
  const sorunlar: Sorun[] = [];
  if (tr.trim() === "") return ["bos"];
  if (!ayniCokluKume(korunacakIsaretler(s.en), korunacakIsaretler(tr))) sorunlar.push("isaret-bozuk");
  if ([...tr].some((c) => !kullanilabilir.has(c))) sorunlar.push("karakter-yok");
  if (s.tur === "arayuz" && tr.length > Math.max(12, s.en.length * 1.6)) sorunlar.push("cok-uzun");
  if (s.en.length > 20 && tr === s.en) sorunlar.push("ingilizce-kalmis");
  return sorunlar;
}
