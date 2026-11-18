// Desteklenen oyunların kaydı. CLI ve görsel uygulama aynı tanımları kullanır.

import { homedir } from "node:os";
import { join } from "node:path";
import type { CeviriSatiri } from "../ceviri/satirlar.js";
import type { TurkceYama } from "../motorlar/4a/turkce-yama.js";
import { METRO_2033_REDUX } from "./metro2033redux.js";
import { METRO_LAST_LIGHT_REDUX } from "./metrolastlightredux.js";
import { METRO_EXODUS, METRO_EXODUS_NORMAL } from "./metroexodus.js";
import { MAFIA_THE_OLD_COUNTRY } from "./mafiatheoldcountry.js";

/** Bütün oyun tanımlarında ortak alanlar. */
export interface OrtakTanim {
  /** Dosya ve klasör adlarında kullanılan kimlik ("metro2033redux"). */
  kimlik: string;
  ad: string;
  steamAppId: number;
  /** Steam'deki kurulum klasörünün adı. */
  klasorAdi: string;
  /** Klasörü elle seçerken oyunu tanımak için bulunması gereken dosya/klasörler (oyun köküne göre). */
  tanimaDosyalari: string[];
  /** Oyun açıkken yazmayı engellemek için süreç adı. */
  surecAdi: string;
  /** Hazır çeviri paketi başka bir tanımınkiyse onun kimliği (aynı oyunun farklı sürümleri tek paketi paylaşır). */
  paketKimligi?: string;
}

/**
 * Unreal Engine oyunu: Türkçe, oyunun paketlerine dokunmadan tek bir ek pak olarak kurulur. Uygulama oyunun
 * (şifreli) dosyalarını okumaz; satırların kimliği hazır pakette gelir (bkz. src/motorlar/ue/turkce-yama.ts).
 */
export interface TanimUe5 extends OrtakTanim {
  motor: "ue5";
  /** Eklenen paketin oyun köküne göre yolu (adı "_P" ile biter: oyunun paketlerinden sonra yüklenir). */
  pakYolu: string;
  /** Paketin içindeki metin tablosunun bağlama noktası (İngilizce tablonun klasörü). */
  mount: string;
}

export type OyunTanimi = Tanim4A | TanimUe5;

export interface Tanim4A extends OrtakTanim {
  motor: "4a";
  /** Steam'deki temiz content.vfx özeti (bilgi amaçlı). */
  temizDizinOzeti?: string;
  /**
   * content.vfx'in üstüne yüklenen güncelleme dizinlerinin ad deseni (Metro Exodus normal sürüm: patch_NN*.vfx).
   * Servis oyun klasöründeki eşleşen dizinleri ada göre sıralar (eskiden yeniye; Steam yeni bir güncelleme dizini
   * eklerse kendiliğinden hesaba katılır), orijinallerini (kuruluysa yedekten) okuyup tanıma verir.
   */
  katmanDeseni?: RegExp;
  /** Çevrilecek satırlar ve oyunun gösterebildiği karakterler (orijinal dizinden). */
  kaynak(oyunKlasoru: string, orijinalVfx: Buffer, katmanlar?: Katman[]): { satirlar: CeviriSatiri[]; kullanilabilir: Set<string> };
  /** Verilen çevirilerle Türkçe yamayı bellekte hazırlar (oyuna yazmaz). */
  yamaHazirla(oyunKlasoru: string, ceviriler: Map<string, string>, orijinalVfx: Buffer, katmanlar?: Katman[]): TurkceYama;
}

/** Bir güncelleme dizininin adı ve orijinal içeriği. */
export interface Katman {
  ad: string;
  vfx: Buffer;
}

/**
 * Güncelleme dizini adlarını yüklenme sırasına dizer: uzantısız ada göre karakter karakter
 * (patch_00 < patch_01 < patch_01_shared < patch_02 …; dil kurallı sıralama "_" ile "."yı karıştırır).
 */
export function katmanSirala(adlar: string[]): string[] {
  const kok = (a: string) => a.toLowerCase().replace(/\.vfx$/, "");
  return [...adlar].sort((a, b) => (kok(a) < kok(b) ? -1 : kok(a) > kok(b) ? 1 : 0));
}

/** Çeviri paketinin ve geliştirici deposunun kimliği. */
export const paketKimligi = (t: OyunTanimi) => t.paketKimligi ?? t.kimlik;

// Normal Exodus, EE'den önce: elle seçilen klasörde ikisinin de dosyaları var, patch_04.vfx normal sürümü ayırır.
export const OYUNLAR: OyunTanimi[] = [METRO_2033_REDUX, METRO_LAST_LIGHT_REDUX, METRO_EXODUS_NORMAL, METRO_EXODUS, MAFIA_THE_OLD_COUNTRY];

export function tanimBul(appId: number | undefined, klasorAdi: string): OyunTanimi | undefined {
  return OYUNLAR.find((t) => (appId !== undefined && t.steamAppId === appId) || t.klasorAdi.toLowerCase() === klasorAdi.toLowerCase());
}

export function uygulamaKlasoru(): string {
  return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "turkcesi-var");
}
export const yedekKlasoru = (t: OyunTanimi) => join(uygulamaKlasoru(), "yedekler", t.kimlik);
export const depoKlasoru = (t: OyunTanimi) => join(uygulamaKlasoru(), "ceviriler", paketKimligi(t));
export const ortakBellekYolu = () => join(uygulamaKlasoru(), "ortak-bellek.json");
