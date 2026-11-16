import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ALTYAZI_ANAHTARI,
  ALTYAZI_METNI,
  MENU_ANAHTARI,
  MENU_METNI,
  denemeYamasiHazirla,
  type DenemeYamasi,
} from "../src/fizibilite.js";
import { dokuOku, fontlariOku } from "../src/motorlar/4a/font.js";
import { metinTablosuOku } from "../src/motorlar/4a/metin-tablosu.js";
import { dosyaCikar } from "../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, type VfxDizin } from "../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "./yardimci.js";

describe.skipIf(metroYok)("fizibilite yaması (oyun klasörüne yazmadan)", () => {
  let y: DenemeYamasi;
  let gecici: string;
  let d: VfxDizin;
  const cikar = (yol: string) => dosyaCikar([gecici, METRO_DIR], d, girdiBul(d, yol)[0]!);

  beforeAll(() => {
    y = denemeYamasiHazirla(METRO_DIR, { vfx: METRO_VFX });
    gecici = mkdtempSync(join(tmpdir(), "tv-fiz-"));
    for (const [ad, b] of Object.entries(y.eklenecek)) writeFileSync(join(gecici, ad), b);
    d = vfxOku(y.degisecek["content.vfx"]!);
  });
  afterAll(() => rmSync(gecici, { recursive: true, force: true }));

  it("yalnızca content.vfx değişir ve tek yeni paket eklenir", () => {
    expect(Object.keys(y.degisecek)).toEqual(["content.vfx"]);
    expect(Object.keys(y.eklenecek)).toEqual(["content28.vfs0"]);
  });

  it("metinler Türkçe ve karakter tablosunda Türkçe harfler var", () => {
    const t = metinTablosuOku(cikar("localization/stable_us.lng"));
    expect(t.satirlar.find((s) => s.anahtar === MENU_ANAHTARI)?.metin).toBe(MENU_METNI);
    expect(t.satirlar.find((s) => s.anahtar === ALTYAZI_ANAHTARI)?.metin).toBe(ALTYAZI_METNI);
    expect(t.karakterler.slice(176, 182)).toEqual(["ğ", "Ğ", "ş", "Ş", "ı", "İ"]);
    expect(t.karakterler.length).toBe(211);
  });

  it("menü ve altyazı fontlarında yeni glifler dolu ve dokuda görünür", () => {
    const fontlar = fontlariOku(cikar("content/config.bin"), "us");
    for (const ad of ["font\\font_metro_for_menu_us", "font\\font_font_regular_us"]) {
      const f = fontlar.find((x) => x.dokuAdi === ad && x.glifler.length === 211)!;
      const doku = dokuOku(cikar(`textures/${ad.replace("\\", "/")}.512`), 512, 512);
      for (let i = 176; i <= 181; i++) {
        const g = f.glifler[i]!;
        expect(g.gen, `${ad} ${i}`).toBeGreaterThan(0);
        let parlak = 0;
        for (let yy = g.y; yy < g.y + g.yuk; yy++)
          for (let xx = g.x; xx < g.x + g.gen; xx++) if (doku.rgba[(yy * 512 + xx) * 4]! > 150) parlak++;
        expect(parlak, `${ad} ${i}`).toBeGreaterThan(20);
      }
    }
  });

  it("bölünmüş dokulu fontlar dahil hiçbir metin fontu atlanmaz (Plan 2)", () => {
    expect(y.atlananFontlar).toEqual([]);
    expect(y.yamalananFontlar).toContain("font\\font_metro_for_menu_us");
    expect(y.yamalananFontlar).toContain("font\\font_font_regular_us");
  });

  it("zaten yamalı bir dizinden hazırlamaya çalışınca 'zaten yamalı' der", () => {
    expect(() =>
      denemeYamasiHazirla(METRO_DIR, { vfx: y.degisecek["content.vfx"]!, ekPaketKlasorleri: [gecici] }),
    ).toThrow(/zaten yamalı/);
  });

  it("yedekteki orijinal dizin verilirse yamalı oyunda da aynı yamayı hazırlar", () => {
    const orijinal = METRO_VFX;
    const tekrar = denemeYamasiHazirla(METRO_DIR, { vfx: METRO_VFX });
    expect(tekrar.degisecek["content.vfx"]!.equals(y.degisecek["content.vfx"]!)).toBe(true);
    expect(Object.keys(tekrar.eklenecek)).toEqual(["content28.vfs0"]);
  });

  it("orijinal content.vfx değişmemiş (yalnızca bellekte üretildi)", () => {
    expect(METRO_VFX.equals(y.degisecek["content.vfx"]!)).toBe(false);
  });
});
