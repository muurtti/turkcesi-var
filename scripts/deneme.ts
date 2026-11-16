// Fizibilite denemesi komutu.
//   npm run deneme -- uygula   → menü + bir altyazı Türkçe harflerle (önce yedek alınır)
//   npm run deneme -- geri-al  → oyunu orijinal haline döndürür
//   npm run deneme -- durum    → yama kurulu mu, content.vfx temiz mi
//   npm run deneme -- unut     → (Steam güncellemesinden sonra) yalnızca eklenen dosyaları siler, yamayı unutur
// METRO_DIR verilmezse Steam varsayılan konumu kullanılır.

import { denemeYamasiHazirla } from "../src/fizibilite.js";
import { geriYukle, uygula, yamayiUnut } from "../src/ortak/yedek.js";
import { OYUN, YEDEK, durum, oyunKapaliOlmali, orijinalVfx } from "./ortak.js";

async function main(): Promise<void> {
  const komut = process.argv[2];
  if (komut === "durum") return durum();
  oyunKapaliOlmali();

  if (komut === "uygula") {
    console.log("Yama hazırlanıyor (oyun dosyaları okunuyor)...");
    const y = denemeYamasiHazirla(OYUN, { vfx: orijinalVfx() });
    console.log(`Türkçe harf eklenen fontlar: ${y.yamalananFontlar.join(", ")}`);
    for (const a of y.atlananFontlar) console.log(`  atlandı: ${a.font} — ${a.neden}`);
    const kayit = await uygula(OYUN, YEDEK, y.degisecek, y.eklenecek);
    console.log(`Uygulandı. Değişen: ${Object.keys(kayit.yamaliOzetler).join(", ")}; eklenen: ${kayit.eklenenDosyalar.join(", ")}`);
    console.log("Geri almak için: npm run deneme -- geri-al");
  } else if (komut === "geri-al") {
    await geriYukle(OYUN, YEDEK);
    console.log("Oyun orijinal haline döndürüldü.");
    durum();
  } else if (komut === "unut") {
    await yamayiUnut(OYUN, YEDEK);
    console.log("Yamanın eklediği dosyalar silindi ve yama kaydı unutuldu. Steam'de 'Oyun dosyalarının bütünlüğünü doğrula' yapmanız önerilir.");
    durum();
  } else {
    console.error("Kullanım: npm run deneme -- uygula | geri-al | durum | unut");
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
