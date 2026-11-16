import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { girdiBul, vfxOku, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

describe.skipIf(metroYok)("VFX dizin okuyucu (gerçek Metro 2033 Redux)", () => {
  let d: VfxDizin;
  beforeAll(() => {
    d = vfxOku(METRO_VFX);
  });

  it("paket tablosunu okur", () => {
    expect(d.paketler.length).toBe(30);
    expect(d.paketler[0]?.ad).toBe("content00.vfs0");
    for (const p of d.paketler) {
      expect(p.boyut).toBe(statSync(join(METRO_DIR, p.ad)).size);
    }
  });

  it("bilinen dosyaları bulur", () => {
    expect(girdiBul(d, "font_metro_for_menu_us.512").length).toBe(1);
    expect(girdiBul(d, "localization/stable_us.lng")[0]?.yol).toBe("content/localization/stable_us.lng");
    expect(girdiBul(d, "stable_ru.lng").length).toBe(1);
  });

  it("bütün adlar temiz çözülür", () => {
    expect(d.dosyalar.length).toBe(80403);
    const bozuk = d.dosyalar.filter((g) => !/^[A-Za-z0-9_.\/\-+ ()&#@!~$,'=\[\]`]+$/.test(g.yol));
    expect(bozuk.map((g) => g.yol).slice(0, 5)).toEqual([]);
  });

  it("her dosya paketinin sınırları içindedir", () => {
    for (const g of d.dosyalar) {
      const p = d.paketler[g.paketNo];
      expect(p, g.yol).toBeDefined();
      expect(g.ofset + g.sikistirilmisBoyut, g.yol).toBeLessThanOrEqual(p!.boyut);
    }
  });

  it("kopya tablosunu okur", () => {
    expect(d.kopyalar.length).toBe(25959);
    expect(d.kopyalar.every((k) => d.kayitlar[k.kayitSirasi]?.tur === "dosya")).toBe(true);
  });
});
