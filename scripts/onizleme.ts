// Geliştirici aracı: Türkçe harfleri eklenmiş fontların önizlemesini cikti/ klasörüne PNG olarak yazar.
// Kullanım: npx tsx scripts/onizleme.ts   (METRO_DIR verilmezse Steam varsayılanı)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { dokuBilgisiOku, dokuOku, fontlariOku, type Doku, type FontKaydi, type Glif } from "../src/motorlar/4a/font.js";
import { TURKCE_YUVALAR, turkceHarfEkle } from "../src/motorlar/4a/font-turkce.js";
import { metinTablosuOku } from "../src/motorlar/4a/metin-tablosu.js";
import { dosyaCikar } from "../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../src/motorlar/4a/vfx.js";

const oyun = process.env.METRO_DIR ?? "C:/Program Files (x86)/Steam/steamapps/common/Metro 2033 Redux";

function crc32(b: Buffer): number {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function png(gen: number, yuk: number, rgba: Buffer): Buffer {
  const parca = (t: string, v: Buffer) => {
    const b = Buffer.alloc(8 + v.length + 4);
    b.writeUInt32BE(v.length, 0);
    b.write(t, 4, "latin1");
    v.copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, 8 + v.length)), 8 + v.length);
    return b;
  };
  const satirlar = Buffer.alloc((gen * 4 + 1) * yuk);
  for (let y = 0; y < yuk; y++) rgba.copy(satirlar, y * (gen * 4 + 1) + 1, y * gen * 4, (y + 1) * gen * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(gen, 0);
  ihdr.writeUInt32BE(yuk, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca("IHDR", ihdr),
    parca("IDAT", deflateSync(satirlar)),
    parca("IEND", Buffer.alloc(0)),
  ]);
}

function yaz(metin: string, glifler: (c: string) => Glif | undefined, doku: Doku, satirYuk: number, olcek = 2): Buffer {
  const gen = 1100, yuk = Math.ceil(satirYuk * 1.4);
  const rgba = Buffer.alloc(gen * yuk * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([40, 40, 48, 255], i);
  let kalem = 10;
  for (const c of metin) {
    const g = glifler(c);
    if (!g) { kalem += 12; continue; }
    for (let y = 0; y < g.yuk; y++)
      for (let x = 0; x < g.gen; x++) {
        const sx = g.x + x, sy = g.y + y;
        if (sx < 0 || sy < 0 || sx >= doku.gen || sy >= doku.yuk) continue;
        const k = (sy * doku.gen + sx) * 4;
        const p = Math.max(doku.rgba[k]!, doku.rgba[k + 1]!, doku.rgba[k + 2]!);
        if (p < 24) continue;
        const hx = kalem + g.xOfset + x, hy = 6 + g.yOfset + y;
        if (hx >= 0 && hy >= 0 && hx < gen && hy < yuk) doku.rgba.copy(rgba, (hy * gen + hx) * 4, k, k + 4);
      }
    kalem += g.ilerleme;
  }
  void olcek;
  return rgba;
}

const d = vfxOku(readFileSync(join(oyun, "content.vfx")));
const cikar = (y: string) => dosyaCikar([oyun], d, girdiBul(d, y)[0]!);
const karakterler = metinTablosuOku(cikar("localization/stable_us.lng")).karakterler;
const fontlar = fontlariOku(cikar("content/config.bin"), "us");
mkdirSync("cikti", { recursive: true });

for (const ad of ["font\\font_metro_for_menu_us", "font\\font_font_regular_us"]) {
  const f: FontKaydi = fontlar.find((x) => x.dokuAdi === ad && x.glifler.length === 211)!;
  const yol = `textures/${ad.replace("\\", "/")}`;
  const bilgi = dokuBilgisiOku(cikar(`${yol}.bin`));
  const sonuc = turkceHarfEkle(f, dokuOku(cikar(`${yol}.512`), bilgi.gen, bilgi.yuk), karakterler);
  const kisa = ad.split("\\")[1]!;
  writeFileSync(`cikti/${kisa}-doku.png`, png(sonuc.doku.gen, sonuc.doku.yuk, sonuc.doku.rgba));
  const tablo = new Map<string, Glif>();
  karakterler.forEach((c, i) => { if (f.glifler[i]!.gen > 0) tablo.set(c, f.glifler[i]!); });
  for (const [h, i] of Object.entries(TURKCE_YUVALAR)) tablo.set(h, sonuc.glifler.get(i)!);
  const satir1 = yaz("YENİ OYUN ğşı  Ğğ Şş İı Çç Öö Üü", (c) => tablo.get(c), sonuc.doku, f.satirYuksekligi);
  const satir2 = yaz("Artyom! Kalk, Artyom! Benim, Khan! Işığı gördüğünüzde çıkın.", (c) => tablo.get(c), sonuc.doku, f.satirYuksekligi);
  const birlesik = Buffer.concat([satir1, satir2]);
  const yuk = (birlesik.length / 4) / 1100;
  writeFileSync(`cikti/${kisa}-yazi.png`, png(1100, yuk, birlesik));
  console.log(`cikti/${kisa}-doku.png ve -yazi.png yazıldı`);
}
