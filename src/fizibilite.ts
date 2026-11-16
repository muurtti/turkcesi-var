// Fizibilite denemesi: bir oyunda birkaç menü yazısını ve bir altyazıyı Türkçe harflerle göstermek.
// Genel Türkçe yama hazırlayıcısının (src/motorlar/4a/turkce-yama.ts) küçük bir çağrısıdır.

import { turkceYamaHazirla, type HazirlamaSecenekleri, type TurkceYama } from "./motorlar/4a/turkce-yama.js";

export const MENU_ANAHTARI = "$new_game";
export const MENU_METNI = "YENİ OYUN ğşı";
export const ALTYAZI_ANAHTARI = "voices\\l00_intro\\int_001_khan_intro_1";
export const ALTYAZI_METNI = "Ğğ Şş İı Çç Öö Üü — Türkçesi Var denemesi";

/** Oyuna göre deneme satırları (anahtar → Türkçe). */
export const DENEME_SATIRLARI: Record<string, [string, string][]> = {
  metro2033redux: [
    [MENU_ANAHTARI, MENU_METNI],
    [ALTYAZI_ANAHTARI, ALTYAZI_METNI],
  ],
  metroexodus: [
    ["$new_game", "YENİ OYUN ğşı"],
    ["$continue_menu", "DEVAM ET Ğİ"],
    ["$options", "AYARLAR Şİ"],
    ["voices\\m3_intro\\gamestart_narration_01_part5_8", "Hafif bir yokuştu, ama hep ağır ağır aşağı kaydık. ĞğŞşİıÇçÖöÜü"],
  ],
};

export type DenemeYamasi = TurkceYama;
export type { HazirlamaSecenekleri };

export function denemeYamasiHazirla(oyunKlasoru: string, secenekler: HazirlamaSecenekleri = {}, oyunKimligi = "metro2033redux"): DenemeYamasi {
  const satirlar = DENEME_SATIRLARI[oyunKimligi];
  if (!satirlar) throw new Error(`Deneme satırları tanımlı değil: ${oyunKimligi}`);
  return turkceYamaHazirla(oyunKlasoru, new Map(satirlar), secenekler);
}
