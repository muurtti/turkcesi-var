// Metro Exodus Enhanced Edition (4A Engine, content.vfx sürüm 3) tanımı. Steam 1449560.
// Normal sürüm (412020) gerçek oyunla denenmediği için Steam'de tanınmaz; elle/Epic klasöründe yama önce
// bellekte hazırlanır, dosyalar uymazsa hata verir ve oyuna hiçbir şey yazmaz.
// Biçim farkları: docs/notlar/4a-vfx-bicimi.md, docs/notlar/4a-font.md ("Metro Exodus").

import { cevrilecekSatirlar } from "../ceviri/satirlar.js";
import { metinTablosuOku } from "../motorlar/4a/metin-tablosu.js";
import { turkceYamaHazirla } from "../motorlar/4a/turkce-yama.js";
import { dosyaCikar } from "../motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../motorlar/4a/vfx.js";
import { TURKCE_HARFLER } from "../ortak/turkce.js";
import type { OyunTanimi } from "./tanim.js";

export const METRO_EXODUS: OyunTanimi = {
  kimlik: "metroexodus",
  ad: "Metro Exodus Enhanced Edition",
  steamAppId: 1449560,
  klasorAdi: "Metro Exodus Enhanced Edition",
  motor: "4a",
  surecAdi: "MetroExodus.exe",
  tanimaDosyalari: ["MetroExodus.exe", "content.vfx"],

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
