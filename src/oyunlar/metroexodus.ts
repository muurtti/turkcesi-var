// Metro Exodus (4A Engine, content.vfx sürüm 3) tanımları.
// - Enhanced Edition (Steam 1449560): bütün içerik content.vfx'te.
// - Normal sürüm (Steam 412020): content.vfx'in üstüne güncelleme dizinleri (patch_00…patch_04.vfx) yüklenir;
//   metin tablosu ve config.bin'in en yeni kopyası patch_04'te, font dokuları content.vfx'te. Yama her dosyayı
//   en yeni kopyasının dizininde değiştirir. İki sürüm aynı çeviri paketini kullanır (satır adları büyük ölçüde
//   aynı; adı değişen satırlar İngilizce metni birebir aynıysa servis tarafından eşleştirilir).
// Biçim farkları: docs/notlar/4a-vfx-bicimi.md, docs/notlar/4a-font.md ("Metro Exodus").

import { cevrilecekSatirlar } from "../ceviri/satirlar.js";
import { metinTablosuOku } from "../motorlar/4a/metin-tablosu.js";
import { turkceYamaHazirla } from "../motorlar/4a/turkce-yama.js";
import { dosyaCikar } from "../motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../motorlar/4a/vfx.js";
import { TURKCE_HARFLER } from "../ortak/turkce.js";
import type { Katman, Tanim4A } from "./tanim.js";

/** Metin tablolarını en yeni kopyalarından (son katmandan geriye) okur. */
function kaynakOku(oyunKlasoru: string, orijinalVfx: Buffer, katmanlar: Katman[] = []) {
  const dizinler = [vfxOku(orijinalVfx), ...katmanlar.map((k) => vfxOku(k.vfx))];
  const oku = (y: string) => {
    for (let i = dizinler.length - 1; i >= 0; i--) {
      const g = girdiBul(dizinler[i]!, y)[0];
      if (g) return metinTablosuOku(dosyaCikar([oyunKlasoru], dizinler[i]!, g));
    }
    throw new Error(`Oyun dosyası bulunamadı: ${y}`);
  };
  const us = oku("localization/stable_us.lng");
  const ru = oku("localization/stable_ru.lng");
  // Kontrol karakterleri (\x01–\x1F) gösterilemez; Türkçe harfler o yuvalara eklenecek.
  const kullanilabilir = new Set([...us.karakterler.slice(1).filter((c) => c >= " "), ...TURKCE_HARFLER]);
  return { satirlar: cevrilecekSatirlar(us, ru), kullanilabilir };
}

export const METRO_EXODUS: Tanim4A = {
  kimlik: "metroexodus",
  ad: "Metro Exodus Enhanced Edition",
  steamAppId: 1449560,
  klasorAdi: "Metro Exodus Enhanced Edition",
  motor: "4a",
  surecAdi: "MetroExodus.exe",
  tanimaDosyalari: ["MetroExodus.exe", "content.vfx"],

  kaynak(oyunKlasoru, orijinalVfx) {
    return kaynakOku(oyunKlasoru, orijinalVfx);
  },

  yamaHazirla(oyunKlasoru, ceviriler, orijinalVfx) {
    return turkceYamaHazirla(oyunKlasoru, ceviriler, { vfx: orijinalVfx });
  },
};


export const METRO_EXODUS_NORMAL: Tanim4A = {
  kimlik: "metroexodus-normal",
  paketKimligi: "metroexodus",
  ad: "Metro Exodus",
  steamAppId: 412020,
  klasorAdi: "Metro Exodus",
  motor: "4a",
  surecAdi: "MetroExodus.exe",
  tanimaDosyalari: ["MetroExodus.exe", "content.vfx", "patch_04.vfx"],
  // patch_00.vfx … patch_04.vfx, patch_01_shared.vfx; ada göre sıralanınca yüklenme sırası (sonraki öncekini ezer).
  katmanDeseni: /^patch_\d+(_[a-z]+)?\.vfx$/i,

  kaynak(oyunKlasoru, orijinalVfx, katmanlar) {
    return kaynakOku(oyunKlasoru, orijinalVfx, katmanlar);
  },

  yamaHazirla(oyunKlasoru, ceviriler, orijinalVfx, katmanlar) {
    return turkceYamaHazirla(oyunKlasoru, ceviriler, { vfx: orijinalVfx, katmanlar: katmanlar ?? [] });
  },
};
