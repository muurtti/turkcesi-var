import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { bolunmusDokuOku, dokuBilgisiOku, dokuOku, fontlariOku, type FontKaydi, type Glif } from "../../../src/motorlar/4a/font.js";
import { TURKCE_YUVALAR, turkceHarfEkle } from "../../../src/motorlar/4a/font-turkce.js";
import { metinTablosuOku } from "../../../src/motorlar/4a/metin-tablosu.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

/** Glifte parlak dolgu (kırmızı kanal > 150) içeren satırların kaç ayrı parça oluşturduğu. */
function dolguParcaSayisi(d: { gen: number; rgba: Buffer }, g: Glif): number {
  let parca = 0;
  let onceki = false;
  for (let y = Math.max(0, g.y); y < g.y + g.yuk; y++) {
    let dolu = false;
    for (let x = Math.max(0, g.x); x < g.x + g.gen; x++) if (d.rgba[(y * d.gen + x) * 4]! > 150) dolu = true;
    if (dolu && !onceki) parca++;
    onceki = dolu;
  }
  return parca;
}

function cakisir(a: Glif, b: Glif): boolean {
  return a.x < b.x + b.gen && b.x < a.x + a.gen && a.y < b.y + b.yuk && b.y < a.y + a.yuk;
}

describe.skipIf(metroYok)("fonta Türkçe harf ekleme (gerçek Metro 2033 Redux)", () => {
  let d: VfxDizin;
  let karakterler: string[];
  let fontlar: FontKaydi[];
  const cikar = (y: string) => dosyaCikar([METRO_DIR], d, girdiBul(d, y)[0]!);

  beforeAll(() => {
    d = vfxOku(METRO_VFX);
    karakterler = metinTablosuOku(cikar("localization/stable_us.lng")).karakterler;
    fontlar = fontlariOku(cikar("content/config.bin"), "us");
  });

  it("yuvalar ğ Ğ ş Ş ı İ için 176-181", () => {
    expect(TURKCE_YUVALAR).toEqual({ ğ: 176, Ğ: 177, ş: 178, Ş: 179, ı: 180, İ: 181 });
  });

  it("yalnızca büyük harfli fontta (harita): i → İ, ı → I, ğ → Ğ, ş → Ş", () => {
    const f = fontlar.find((x) => x.rol === "map")!;
    const bilgi = dokuBilgisiOku(cikar("textures/font/font_metro_for_map_us.bin"));
    const doku = bolunmusDokuOku([cikar("textures/font/font_metro_for_map_us.1024")], bilgi.gen, bilgi.yuk);
    const sonuc = turkceHarfEkle(f, doku, karakterler);
    const yeni = (h: keyof typeof TURKCE_YUVALAR) => sonuc.glifler.get(TURKCE_YUVALAR[h])!;
    const I = f.glifler[karakterler.indexOf("I")]!;
    expect(yeni("ı")).toEqual(I); // ı, I glifinin aynısı
    expect(yeni("ğ")).toEqual(yeni("Ğ"));
    expect(yeni("ş")).toEqual(yeni("Ş"));
    expect(yeni("İ").yuk).toBeGreaterThan(I.yuk); // noktalı
    // Türkçede büyük i noktalıdır: bu fontta 'i' de İ glifini kullanır.
    expect(sonuc.glifler.get(karakterler.indexOf("i"))).toEqual(yeni("İ"));
  });

  it("küçük harfli fontta 'i' glifine dokunulmaz", () => {
    const f = fontlar.find((x) => x.dokuAdi === "font\\font_metro_for_menu_us" && x.glifler.length === 211)!;
    const doku = dokuOku(cikar("textures/font/font_metro_for_menu_us.512"), 512, 512);
    const sonuc = turkceHarfEkle(f, doku, karakterler);
    expect(sonuc.glifler.has(karakterler.indexOf("i"))).toBe(false);
  });

  for (const ad of ["font\\font_metro_for_menu_us", "font\\font_font_regular_us"]) {
    it(`${ad}: altı harf eklenir, çakışmaz, dokunun içindedir`, () => {
      const f = fontlar.find((x) => x.dokuAdi === ad && x.glifler.length === 211)!;
      const bilgi = dokuBilgisiOku(cikar(`textures/${ad.replace("\\", "/")}.bin`));
      const doku = dokuOku(cikar(`textures/${ad.replace("\\", "/")}.512`), bilgi.gen, bilgi.yuk);
      const once = Buffer.from(doku.rgba);
      const sonuc = turkceHarfEkle(f, doku, karakterler);

      const eskiler = f.glifler.filter((g, i) => g.gen > 0 && !(Object.values(TURKCE_YUVALAR) as number[]).includes(i));
      const yeniler = Object.entries(TURKCE_YUVALAR).map(([h, i]) => {
        const g = sonuc.glifler.get(i);
        expect(g, h).toBeDefined();
        return g!;
      });
      for (const g of yeniler) {
        expect(g.gen).toBeGreaterThan(0);
        expect(g.yuk).toBeGreaterThan(0);
        expect(g.x).toBeGreaterThanOrEqual(0);
        expect(g.y).toBeGreaterThanOrEqual(0);
        expect(g.x + g.gen).toBeLessThanOrEqual(bilgi.gen);
        expect(g.y + g.yuk).toBeLessThanOrEqual(bilgi.yuk);
        for (const e of eskiler) expect(cakisir(g, e)).toBe(false);
      }
      // Yeni glif alanları dokunun arka planı gibi tamamen opak.
      for (const g of yeniler)
        for (let y = g.y; y < g.y + g.yuk; y++)
          for (let x = g.x; x < g.x + g.gen; x++) expect(sonuc.doku.rgba[(y * bilgi.gen + x) * 4 + 3]).toBe(255);
      for (let a = 0; a < yeniler.length; a++)
        for (let b = a + 1; b < yeniler.length; b++) expect(cakisir(yeniler[a]!, yeniler[b]!)).toBe(false);

      // Eski gliflerin pikselleri değişmemiş olmalı.
      for (const e of eskiler.slice(0, 40)) {
        for (let y = Math.max(0, e.y); y < e.y + e.yuk; y++) {
          for (let x = Math.max(0, e.x); x < e.x + e.gen; x++) {
            const k = (y * bilgi.gen + x) * 4;
            expect(sonuc.doku.rgba[k]).toBe(once[k]);
          }
        }
      }

      // Yeni gliflerin içinde görünür piksel var; ğ, g'den uzun; ş, s'den uzun; ı, i'den kısa.
      const g = (h: string) => f.glifler[karakterler.indexOf(h)]!;
      const yeni = (h: keyof typeof TURKCE_YUVALAR) => sonuc.glifler.get(TURKCE_YUVALAR[h])!;
      expect(yeni("ğ").yuk).toBeGreaterThan(g("g").yuk);
      expect(yeni("ş").yuk).toBeGreaterThan(g("s").yuk);
      expect(yeni("ı").yuk).toBeLessThan(g("i").yuk);
      expect(yeni("İ").yuk).toBeGreaterThan(g("I").yuk);
      expect(yeni("ğ").ilerleme).toBe(g("g").ilerleme);
      expect(yeni("Ş").ilerleme).toBe(g("S").ilerleme);

      // ı noktasız olmalı: dolgu (parlak) satırları tek parça; i'de nokta + gövde = iki parça.
      expect(dolguParcaSayisi(doku, g("i"))).toBe(2);
      expect(dolguParcaSayisi(sonuc.doku, yeni("ı"))).toBe(1);
    });
  }

  it("bütün küçük harfli fontlarda ı noktasızdır", () => {
    for (const f of fontlar.filter((x) => x.glifler.length === 211 && x.rol !== "map" && x.rol !== "typewriter")) {
      const taban = `textures/${f.dokuAdi.replace("\\", "/")}`;
      const bilgi = dokuBilgisiOku(cikar(`${taban}.bin`));
      const doku = dokuOku(cikar(`${taban}.512`), bilgi.gen, bilgi.yuk);
      const sonuc = turkceHarfEkle(f, doku, karakterler);
      expect(dolguParcaSayisi(sonuc.doku, sonuc.glifler.get(TURKCE_YUVALAR.ı)!), f.rol).toBe(1);
    }
  });
});
