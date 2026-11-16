// Kullanım: METRO_DIR=... npx tsx scripts/cikar.ts <desen> [<desen> ...]
// Yolunda desenlerden biri geçen dosyaları cikti/ klasörüne çıkarır (oyun klasörüne yazmaz).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dosyaCikar } from "../src/motorlar/4a/vfs.js";
import { vfxOku } from "../src/motorlar/4a/vfx.js";

const oyun = process.env.METRO_DIR;
const desenler = process.argv.slice(2).map((d) => d.toLowerCase());
if (!oyun || desenler.length === 0) {
  console.error("Kullanım: METRO_DIR=<oyun klasörü> npx tsx scripts/cikar.ts <desen> ...");
  process.exit(1);
}

const d = vfxOku(readFileSync(join(oyun, "content.vfx")));
let sayi = 0;
for (const g of d.dosyalar) {
  const y = g.yol.toLowerCase();
  if (!desenler.some((s) => y.includes(s))) continue;
  const hedef = join("cikti", g.yol);
  mkdirSync(dirname(hedef), { recursive: true });
  writeFileSync(hedef, dosyaCikar([oyun], d, g));
  sayi++;
}
console.log(`${sayi} dosya cikti/ klasörüne çıkarıldı.`);
