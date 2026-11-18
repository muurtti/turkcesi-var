// Metro 2033 Redux (4A Engine) tanımı.

import { cevrilecekSatirlar } from "../ceviri/satirlar.js";
import { metinTablosuOku } from "../motorlar/4a/metin-tablosu.js";
import { turkceYamaHazirla } from "../motorlar/4a/turkce-yama.js";
import { dosyaCikar } from "../motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../motorlar/4a/vfx.js";
import { TURKCE_HARFLER } from "../ortak/turkce.js";
import type { Tanim4A } from "./tanim.js";

export const METRO_2033_REDUX: Tanim4A = {
  kimlik: "metro2033redux",
  ad: "Metro 2033 Redux",
  steamAppId: 286690,
  klasorAdi: "Metro 2033 Redux",
  motor: "4a",
  surecAdi: "metro.exe",
  // "2033" klasörü aynı dosya adlarını kullanan Last Light Redux'tan ayırır.
  tanimaDosyalari: ["metro.exe", "content.vfx", "2033"],
  temizDizinOzeti: "02da3140038e10705252538240b54d10a8c1a79a7778a4b10e564a7f695a78f8",

  kaynak(oyunKlasoru, orijinalVfx) {
    const d = vfxOku(orijinalVfx);
    const oku = (y: string) => {
      const g = girdiBul(d, y)[0];
      if (!g) throw new Error(`Oyun dosyası bulunamadı: ${y}`);
      return metinTablosuOku(dosyaCikar([oyunKlasoru], d, g));
    };
    const us = oku("localization/stable_us.lng");
    const ru = oku("localization/stable_ru.lng");
    // Kontrol karakterleri (\x01–\x1F) gösterilemez; Türkçe harfler o yuvalara eklenecek.
    const kullanilabilir = new Set([...us.karakterler.slice(1).filter((c) => c >= " "), ...TURKCE_HARFLER]);
    return { satirlar: cevrilecekSatirlar(us, ru), kullanilabilir };
  },

  yamaHazirla(oyunKlasoru, ceviriler, orijinalVfx) {
    return turkceYamaHazirla(oyunKlasoru, ceviriler, { vfx: orijinalVfx });
  },
};
