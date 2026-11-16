import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { dosyaCikar, lz4ParcaliAc } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

describe("LZ4 parçalı açma", () => {
  it("bağlı blokta önceki parçayı sözlük olarak kullanır", () => {
    // Parça 1: "abcd" (yalnız literal). Parça 2: önceki çıktıdan 4 geri, 4 bayt kopya → "abcd".
    const p1 = Buffer.from([0x40, 0x61, 0x62, 0x63, 0x64]);
    const p2 = Buffer.from([0x00, 0x04, 0x00, 0x00]); // 0 literal, ofset 4, eşleşme 0+4; son: boş literal
    const parca = (veri: Buffer, acik: number) => {
      const b = Buffer.alloc(8);
      b.writeUInt32LE(veri.length + 8, 0);
      b.writeUInt32LE(acik, 4);
      return Buffer.concat([b, veri]);
    };
    const sonuc = lz4ParcaliAc(Buffer.concat([parca(p1, 4), parca(p2, 4)]), 8);
    expect(sonuc.toString("latin1")).toBe("abcdabcd");
  });

  it("açık boyut uyuşmazsa hata verir", () => {
    const b = Buffer.from([13, 0, 0, 0, 9, 0, 0, 0, 0x40, 0x61, 0x62, 0x63, 0x64]);
    expect(() => lz4ParcaliAc(b, 9)).toThrow(/boyut/);
  });
});

describe.skipIf(metroYok)("VFS dosya çıkarma (gerçek Metro 2033 Redux)", () => {
  let d: VfxDizin;
  beforeAll(() => {
    d = vfxOku(METRO_VFX);
  });

  it("stable_us.lng dosyasını açar", () => {
    const g = girdiBul(d, "localization/stable_us.lng")[0]!;
    const b = dosyaCikar([METRO_DIR], d, g);
    expect(b.length).toBe(g.boyut);
    // İlk bölüm: tür 0, boyut 4; ikinci bölüm: tür 1 (karakter tablosu), boyut 422
    expect([b.readUInt32LE(0), b.readUInt32LE(4), b.readUInt32LE(12), b.readUInt32LE(16)]).toEqual([0, 4, 1, 422]);
    expect(b.subarray(24, 24 + 20).toString("utf16le")).toBe(" etoanirhs");
    expect(b.includes(Buffer.from("ps4_speaker_volume\0", "latin1"))).toBe(true);
  });

  it("sıkıştırılmamış küçük dosyayı olduğu gibi okur", () => {
    const g = girdiBul(d, "font_metro_for_menu_us.bin")[0]!;
    expect(g.boyut).toBe(g.sikistirilmisBoyut);
    expect(dosyaCikar([METRO_DIR], d, g).length).toBe(44);
  });

  it("paketi listedeki ilk bulunan klasörden okur", () => {
    const g = girdiBul(d, "font_metro_for_menu_us.512")[0]!;
    const b = dosyaCikar([join(METRO_DIR, "olmayan-klasor"), METRO_DIR], d, g);
    expect(b.length).toBe(g.boyut);
  });
});
