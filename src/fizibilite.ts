// Fizibilite denemesi: Metro 2033 Redux'ta bir menü yazısını ve bir altyazıyı Türkçe harflerle göstermek.
// Artık genel Türkçe yama hazırlayıcısının (src/motorlar/4a/turkce-yama.ts) iki satırlık çağrısıdır.

import { turkceYamaHazirla, type HazirlamaSecenekleri, type TurkceYama } from "./motorlar/4a/turkce-yama.js";

export const MENU_ANAHTARI = "$new_game";
export const MENU_METNI = "YENİ OYUN ğşı";
export const ALTYAZI_ANAHTARI = "voices\\l00_intro\\int_001_khan_intro_1";
export const ALTYAZI_METNI = "Ğğ Şş İı Çç Öö Üü — Türkçesi Var denemesi";

export type DenemeYamasi = TurkceYama;
export type { HazirlamaSecenekleri };

export function denemeYamasiHazirla(oyunKlasoru: string, secenekler: HazirlamaSecenekleri = {}): DenemeYamasi {
  return turkceYamaHazirla(
    oyunKlasoru,
    new Map([
      [MENU_ANAHTARI, MENU_METNI],
      [ALTYAZI_ANAHTARI, ALTYAZI_METNI],
    ]),
    secenekler,
  );
}
