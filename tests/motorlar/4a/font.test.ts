import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  dokuBilgisiOku,
  dokuOku,
  dokuYaz,
  fontlariOku,
  glifYaz,
  type FontKaydi,
} from "../../../src/motorlar/4a/font.js";
import { metinTablosuOku } from "../../../src/motorlar/4a/metin-tablosu.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

describe.skipIf(metroYok)("font (gerçek Metro 2033 Redux)", () => {
  let d: VfxDizin;
  let config: Buffer;
  let fontlar: FontKaydi[];
  const cikar = (y: string) => dosyaCikar([METRO_DIR], d, girdiBul(d, y)[0]!);

  beforeAll(() => {
    d = vfxOku(METRO_VFX);
    config = cikar("content/config.bin");
    fontlar = fontlariOku(config, "us");
  });

  const font = (ad: string) => fontlar.find((f) => f.dokuAdi === ad)!;

  it("us metin fontlarını doku adlarıyla bulur", () => {
    const metinFontlari = fontlar.filter((f) => f.glifler.length === 211).map((f) => [f.rol, f.dokuAdi]);
    expect(metinFontlari).toContainEqual(["menu", "font\\font_metro_for_menu_us"]);
    expect(metinFontlari).toContainEqual(["regular", "font\\font_font_regular_us"]);
    expect(metinFontlari).toContainEqual(["main_menu", "font\\font_metro_2034_font_2_us"]);
    expect(metinFontlari).toContainEqual(["main_menu_lcd", "font\\font_metro_for_menu_main_strings_us"]);
    expect(metinFontlari.length).toBe(6);
  });

  it("menü fontunun ölçülerini okur", () => {
    const m = font("font\\font_metro_for_menu_us");
    expect(m.satirYuksekligi).toBe(56);
    expect(m.glifler[30]).toEqual({ x: 174, y: 239, gen: 32, yuk: 39, xOfset: -2, yOfset: 10, ilerleme: 26 });
    expect(m.glifler[125]).toMatchObject({ x: -1, y: -1, gen: 32, yuk: 51 }); // Å
  });

  it("glif sırası .lng karakter tablosuyla aynıdır ve 176-181 boştur", () => {
    const t = metinTablosuOku(cikar("localization/stable_us.lng"));
    expect(t.karakterler[30]).toBe("A");
    for (const f of fontlar.filter((x) => x.glifler.length === 211)) {
      for (let i = 176; i <= 181; i++) expect(f.glifler[i]!.gen, `${f.dokuAdi} ${i}`).toBe(0);
    }
  });

  it("bir glifi yerinde yazar, başka bayta dokunmaz", () => {
    const kopya = Buffer.from(config);
    const m = fontlariOku(kopya, "us").find((f) => f.dokuAdi === "font\\font_metro_for_menu_us")!;
    const yeni = { x: 10, y: 460, gen: 26, yuk: 48, xOfset: -1, yOfset: 1, ilerleme: 24 };
    glifYaz(kopya, m, 176, yeni);
    const geri = fontlariOku(kopya, "us").find((f) => f.dokuAdi === "font\\font_metro_for_menu_us")!;
    expect(geri.glifler[176]).toEqual(yeni);
    let farkli = 0;
    for (let i = 0; i < kopya.length; i++) if (kopya[i] !== config[i]) farkli++;
    expect(farkli).toBeGreaterThan(0);
    expect(farkli).toBeLessThanOrEqual(14);
  });

  it("doku bilgisini ve BC1 dokuyu okur", () => {
    expect(dokuBilgisiOku(cikar("textures/font/font_metro_for_menu_us.bin"))).toEqual({ gen: 512, yuk: 512 });
    const doku = dokuOku(cikar("textures/font/font_metro_for_menu_us.512"), 512, 512);
    expect(doku.rgba.length).toBe(512 * 512 * 4);
    // 'I' glifinin (354, 322, 13×39) ortası sarı dolgu
    const p = ((322 + 20) * 512 + 354 + 6) * 4;
    expect(doku.rgba[p]!).toBeGreaterThan(180);
    expect(doku.rgba[p + 1]!).toBeGreaterThan(180);
    expect(doku.rgba[p + 2]!).toBeLessThan(100);
  });

  it("dokuyu aynı biçimde geri yazar (mip'lerle)", () => {
    const ham = cikar("textures/font/font_metro_for_menu_us.512");
    const doku = dokuOku(ham, 512, 512);
    const yazilan = dokuYaz(doku, ham);
    expect(yazilan.length).toBe(ham.length);
    const geri = dokuOku(yazilan, 512, 512);
    let toplam = 0;
    for (let i = 0; i < doku.rgba.length; i++) toplam += Math.abs(doku.rgba[i]! - geri.rgba[i]!);
    expect(toplam / doku.rgba.length).toBeLessThan(2);
  });
});
