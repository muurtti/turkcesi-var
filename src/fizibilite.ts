// Fizibilite denemesi: bir oyunda birkaç menü yazısını ve bir altyazıyı Türkçe harflerle göstermek.
// Genel Türkçe yama hazırlayıcısının (src/motorlar/4a/turkce-yama.ts) küçük bir çağrısıdır.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { metinTablosuOku } from "./motorlar/4a/metin-tablosu.js";
import { turkceYamaHazirla, type HazirlamaSecenekleri, type TurkceYama } from "./motorlar/4a/turkce-yama.js";
import { dosyaCikar } from "./motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "./motorlar/4a/vfx.js";

export const MENU_ANAHTARI = "$new_game";
export const MENU_METNI = "YENİ OYUN ğşı";
export const ALTYAZI_ANAHTARI = "voices\\l00_intro\\int_001_khan_intro_1";
export const ALTYAZI_METNI = "Ğğ Şş İı Çç Öö Üü — Türkçesi Var denemesi";

/** Deneme satırı: düz Türkçe metin ya da orijinal metinden Türkçeyi üreten işlev (zaman kodlarını korumak için). */
type DenemeMetni = string | ((orijinal: string) => string);

/** Oyuna göre deneme satırları (anahtar → Türkçe). */
export const DENEME_SATIRLARI: Record<string, [string, DenemeMetni][]> = {
  metro2033redux: [
    [MENU_ANAHTARI, MENU_METNI],
    [ALTYAZI_ANAHTARI, ALTYAZI_METNI],
  ],
  metroexodus: [
    ["$new_game", "YENİ OYUN ğşı"],
    ["$continue_menu", "DEVAM ET Ğİ"],
    ["$options", "AYARLAR Şİ"],
    ["voices\\m3_intro\\gamestart_narration_01_part5_8", "Hafif bir yokuştu, ama hep ağır ağır aşağı kaydık. ĞğŞşİıÇçÖöÜü"],
    // Açılış ara sahnesi: zaman kodlu tek satır; yalnız ilk iki cümle değişir, <time=…> etiketleri aynen kalır.
    [
      "intro",
      (o) =>
        o
          .replace("I still remember life before the War.", "Savaştan önceki hayatı hâlâ hatırlıyorum. (ĞğŞşİıÇçÖöÜü)")
          .replace("I remember that we used to be different, used to live up there, on the surface.", "Bir zamanlar farklı olduğumuzu, yukarıda, yüzeyde yaşadığımızı hatırlıyorum."),
    ],
  ],
};

// Tanı: 3D menü etiketlerinde hangi karakterin hangi glife dönüştüğünü görmek için harfleri numaralı yazar.
DENEME_SATIRLARI["metroexodus-tani"] = [
  ["$new_game", "1ğ 2Ğ 3ş 4Ş"],
  ["$continue_menu", "5ı 6İ 7i 8I"],
  ["$options", "9ç Ç ö Ö ü Ü"],
  ["$load_game", "aİa ağa"],
  ...DENEME_SATIRLARI.metroexodus!.filter(([a]) => a === "intro"),
];
// Tanı 2: etiket önbelleği mi, dönüşüm mü? Bütün metinler öncekilerden farklı; İ'nin yanında orijinal Ä/Ö noktaları.
DENEME_SATIRLARI["metroexodus-tani2"] = [
  ["$new_game", "YENİ OYUN"],
  ["$continue_menu", "İÄİ ÖİÖ"],
  ["$options", "AYARLAR İ"],
  ["$load_main_menu", "YÜKLE İ"],
  ["$load", "YÜKLE İ"],
  ...DENEME_SATIRLARI.metroexodus!.filter(([a]) => a === "intro"),
];

export type DenemeYamasi = TurkceYama;
export type { HazirlamaSecenekleri };

export function denemeYamasiHazirla(oyunKlasoru: string, secenekler: HazirlamaSecenekleri = {}, oyunKimligi = "metro2033redux"): DenemeYamasi {
  const satirlar = DENEME_SATIRLARI[oyunKimligi];
  if (!satirlar) throw new Error(`Deneme satırları tanımlı değil: ${oyunKimligi}`);
  let orijinaller: Map<string, string> | undefined;
  const orijinal = (anahtar: string) => {
    if (!orijinaller) {
      const d = vfxOku(secenekler.vfx ?? readFileSync(join(oyunKlasoru, "content.vfx")));
      const g = girdiBul(d, "localization/stable_us.lng")[0];
      if (!g) throw new Error("stable_us.lng bulunamadı");
      const t = metinTablosuOku(dosyaCikar([...(secenekler.ekPaketKlasorleri ?? []), oyunKlasoru], d, g));
      orijinaller = new Map(t.satirlar.map((s) => [s.anahtar, s.metin]));
    }
    const m = orijinaller.get(anahtar);
    if (m === undefined) throw new Error(`Deneme satırı bulunamadı: ${anahtar}`);
    return m;
  };
  const harita = new Map(satirlar.map(([a, m]) => [a, typeof m === "string" ? m : m(orijinal(a))]));
  return turkceYamaHazirla(oyunKlasoru, harita, secenekler);
}
