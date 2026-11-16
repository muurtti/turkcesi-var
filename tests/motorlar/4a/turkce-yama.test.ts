import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bolunmusDokuOku, fontlariOku } from "../../../src/motorlar/4a/font.js";
import { metinTablosuOku, type MetinTablosu } from "../../../src/motorlar/4a/metin-tablosu.js";
import { turkceYamaHazirla, type TurkceYama } from "../../../src/motorlar/4a/turkce-yama.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

const CEVIRILER = new Map([
  ["$game_subtitles", "ALTYAZILAR"],
  ["voices\\l00_intro\\int_002_khan_intro_2", "Kâbuslar, ha? Şaşırmadım — başından geçenlerden sonra."],
  ["$new_game", "YENİ OYUN"],
]);

describe.skipIf(metroYok)("tam Türkçe yama hazırlama (oyun klasörüne yazmadan)", () => {
  let y: TurkceYama;
  let gecici: string;
  let orijinalD: VfxDizin;
  let yeniD: VfxDizin;
  let orijinal: MetinTablosu;
  let yeni: MetinTablosu;

  beforeAll(() => {
    y = turkceYamaHazirla(METRO_DIR, CEVIRILER, { vfx: METRO_VFX });
    gecici = mkdtempSync(join(tmpdir(), "tv-tam-"));
    for (const [ad, b] of Object.entries(y.eklenecek)) writeFileSync(join(gecici, ad), b);
    orijinalD = vfxOku(METRO_VFX);
    yeniD = vfxOku(y.degisecek["content.vfx"]!);
    orijinal = metinTablosuOku(dosyaCikar([METRO_DIR], orijinalD, girdiBul(orijinalD, "localization/stable_us.lng")[0]!));
    yeni = metinTablosuOku(dosyaCikar([gecici, METRO_DIR], yeniD, girdiBul(yeniD, "localization/stable_us.lng")[0]!));
  });
  afterAll(() => rmSync(gecici, { recursive: true, force: true }));

  it("yalnızca verilen satırlar değişir; diğerleri orijinal baytlarıyla aynı kalır", () => {
    for (const [a, tr] of CEVIRILER) expect(yeni.satirlar.find((s) => s.anahtar === a)?.metin).toBe(tr);
    let degisen = 0;
    orijinal.satirlar.forEach((s, i) => {
      if (CEVIRILER.has(s.anahtar)) return;
      if (!orijinal.kodlu[i]!.equals(yeni.kodlu[i]!)) degisen++;
    });
    expect(degisen).toBe(0);
  });

  it("bütün metin fontları yamalanır, hiçbiri atlanmaz (harita/daktilo dahil)", () => {
    expect(y.atlananFontlar).toEqual([]);
    expect(y.yamalananFontlar).toContain("font\\font_metro_for_map_us");
    const f = fontlariOku(dosyaCikar([gecici, METRO_DIR], yeniD, girdiBul(yeniD, "content/config.bin")[0]!), "us");
    for (const x of f.filter((x) => x.glifler.length === 211)) expect(x.glifler[176]!.gen, x.rol).toBeGreaterThan(0);
  });

  it("harita fontunun iki doku parçası da yeni harfleri içerir", () => {
    const f = fontlariOku(dosyaCikar([gecici, METRO_DIR], yeniD, girdiBul(yeniD, "content/config.bin")[0]!), "us").find((x) => x.rol === "map")!;
    const g = f.glifler[178]!; // ş
    const c = (yol: string) => dosyaCikar([gecici, METRO_DIR], yeniD, girdiBul(yeniD, yol)[0]!);
    const buyuk = bolunmusDokuOku([c("textures/font/font_metro_for_map_us.1024")], 1024, 1024);
    const kucuk = bolunmusDokuOku([c("textures/font/font_metro_for_map_us.512")], 512, 512);
    const parlak = (d: { gen: number; rgba: Buffer }, x0: number, y0: number, w: number, h: number) => {
      let n = 0;
      for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) if (d.rgba[(yy * d.gen + xx) * 4]! > 150) n++;
      return n;
    };
    expect(parlak(buyuk, g.x, g.y, g.gen, g.yuk)).toBeGreaterThan(40);
    expect(parlak(kucuk, g.x >> 1, g.y >> 1, g.gen >> 1, g.yuk >> 1)).toBeGreaterThan(10);
  });

  it("tekrarlanan anahtarın iki satırı ayrı ayrı çevrilir ('#2' eki)", () => {
    const y2 = turkceYamaHazirla(METRO_DIR, new Map([["2033\\intro", "<time=4000>BİR"], ["2033\\intro#2", "<time=4080>İKİ"]]), { vfx: METRO_VFX });
    const g = mkdtempSync(join(tmpdir(), "tv-cift-"));
    try {
      for (const [ad, b] of Object.entries(y2.eklenecek)) writeFileSync(join(g, ad), b);
      const d2 = vfxOku(y2.degisecek["content.vfx"]!);
      const t2 = metinTablosuOku(dosyaCikar([g, METRO_DIR], d2, girdiBul(d2, "localization/stable_us.lng")[0]!));
      expect(t2.satirlar.filter((s) => s.anahtar === "2033\\intro").map((s) => s.metin)).toEqual(["<time=4000>BİR", "<time=4080>İKİ"]);
    } finally {
      rmSync(g, { recursive: true, force: true });
    }
  });

  it("oyunda olmayan bir anahtar verilirse anlaşılır hata verir", () => {
    expect(() => turkceYamaHazirla(METRO_DIR, new Map([["boyle_bir_anahtar_yok", "x"]]), { vfx: METRO_VFX })).toThrow(/bulunamadı/);
  });
});
