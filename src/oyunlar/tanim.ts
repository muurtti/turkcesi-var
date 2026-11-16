// Desteklenen oyunların kaydı. CLI ve görsel uygulama aynı tanımları kullanır.

import { homedir } from "node:os";
import { join } from "node:path";
import type { CeviriSatiri } from "../ceviri/satirlar.js";
import type { TurkceYama } from "../motorlar/4a/turkce-yama.js";
import { METRO_2033_REDUX } from "./metro2033redux.js";
import { METRO_EXODUS } from "./metroexodus.js";

export interface OyunTanimi {
  /** Dosya ve klasör adlarında kullanılan kimlik ("metro2033redux"). */
  kimlik: string;
  ad: string;
  steamAppId: number;
  /** Steam'deki kurulum klasörünün adı. */
  klasorAdi: string;
  motor: "4a";
  /** Klasörü elle seçerken oyunu tanımak için bulunması gereken dosya/klasörler. */
  tanimaDosyalari: string[];
  /** Oyun açıkken yazmayı engellemek için süreç adı. */
  surecAdi: string;
  /** Steam'deki temiz content.vfx özeti (bilgi amaçlı). */
  temizDizinOzeti?: string;
  /** Çevrilecek satırlar ve oyunun gösterebildiği karakterler (orijinal dizinden). */
  kaynak(oyunKlasoru: string, orijinalVfx: Buffer): { satirlar: CeviriSatiri[]; kullanilabilir: Set<string> };
  /** Verilen çevirilerle Türkçe yamayı bellekte hazırlar (oyuna yazmaz). */
  yamaHazirla(oyunKlasoru: string, ceviriler: Map<string, string>, orijinalVfx: Buffer): TurkceYama;
}

export const OYUNLAR: OyunTanimi[] = [METRO_2033_REDUX, METRO_EXODUS];

export function tanimBul(appId: number | undefined, klasorAdi: string): OyunTanimi | undefined {
  return OYUNLAR.find((t) => (appId !== undefined && t.steamAppId === appId) || t.klasorAdi.toLowerCase() === klasorAdi.toLowerCase());
}

export function uygulamaKlasoru(): string {
  return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "turkcesi-var");
}
export const yedekKlasoru = (t: OyunTanimi) => join(uygulamaKlasoru(), "yedekler", t.kimlik);
export const depoKlasoru = (t: OyunTanimi) => join(uygulamaKlasoru(), "ceviriler", t.kimlik);
export const ortakBellekYolu = () => join(uygulamaKlasoru(), "ortak-bellek.json");
