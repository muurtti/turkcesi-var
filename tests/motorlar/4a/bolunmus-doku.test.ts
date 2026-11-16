import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bolunmusDokuOku, bolunmusDokuYaz, dokuBilgisiOku, dokuYariya, type Doku } from "../../../src/motorlar/4a/font.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../../../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

describe("doku yarıya indirme", () => {
  it("2×2 blokların ortalamasını alır", () => {
    const rgba = Buffer.alloc(4 * 4 * 4);
    for (let i = 0; i < 16; i++) rgba.set([i * 10, 0, 0, 255], i * 4); // satır satır 0..150
    const y = dokuYariya({ gen: 4, yuk: 4, rgba });
    expect([y.gen, y.yuk]).toEqual([2, 2]);
    // sol üst blok: pikseller 0,1,4,5 → (0+10+40+50)/4 = 25
    expect(y.rgba[0]).toBe(25);
  });
});

describe.skipIf(metroYok)("bölünmüş doku (font_metro_for_map_us: .1024 + .512)", () => {
  const d = metroYok ? undefined : vfxOku(METRO_VFX);
  const c = (y: string) => dosyaCikar([METRO_DIR], d!, girdiBul(d!, y)[0]!);

  it("en büyük seviyeyi .1024'ten okur; yazınca parçalar aynı boyutta ve .512 yeni dokunun küçültülmüşü olur", () => {
    const bilgi = dokuBilgisiOku(c("textures/font/font_metro_for_map_us.bin"));
    const parcalar = [c("textures/font/font_metro_for_map_us.1024"), c("textures/font/font_metro_for_map_us.512")];
    const doku = bolunmusDokuOku(parcalar, bilgi.gen, bilgi.yuk);
    expect([doku.gen, doku.yuk]).toEqual([1024, 1024]);

    // Boş bir köşeye beyaz bir kare çiz (1000..1023, 1000..1023).
    const yeni: Doku = { ...doku, rgba: Buffer.from(doku.rgba) };
    for (let y = 1000; y < 1024; y++) for (let x = 1000; x < 1024; x++) yeni.rgba.set([255, 255, 255, 255], (y * 1024 + x) * 4);
    const yazilan = bolunmusDokuYaz(yeni, parcalar);
    expect(yazilan.map((b) => b.length)).toEqual(parcalar.map((b) => b.length));

    const kucuk = bolunmusDokuOku([yazilan[1]!], 512, 512);
    const p = (510 * 512 + 510) * 4;
    expect(kucuk.rgba[p]!).toBeGreaterThan(200); // kare küçük seviyede de görünür
  });
});
