import { describe, expect, it } from "vitest";
import { girdiBul, vfxOku, vfxYaz, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { exodusVfx, exodusYok } from "../../yardimci.js";

describe("VFX sürüm 3 (yapay örnek)", () => {
  it("içerik sürümü olan başlığı okuyup aynen yazar", () => {
    const d: VfxDizin = {
      surum: [3, 1],
      icerikSurumu: "src_1-shdr_1-script_1",
      guid: Buffer.alloc(16, 0xab),
      paketler: [{ ad: "content_03.vfs0", klasorler: ["m3\\000"], boyut: 3 }],
      kayitlar: [
        { tur: "klasor", sira: 0, ad: "", yol: "", bayrak: 8, xorAnahtari: 0, cocukSayisi: 1, ilkCocuk: 1 },
        { tur: "dosya", sira: 1, ad: "a.txt", yol: "", bayrak: 0, xorAnahtari: 0x5a, paketNo: 0, ofset: 8, boyut: 3, sikistirilmisBoyut: 3 },
      ],
      dosyalar: [],
      kopyalar: [],
      sonek: Buffer.alloc(8),
    };
    const b = vfxYaz(d);
    const geri = vfxOku(b);
    expect(geri.surum).toEqual([3, 1]);
    expect(geri.icerikSurumu).toBe("src_1-shdr_1-script_1");
    expect(geri.dosyalar[0]?.yol).toBe("a.txt");
    expect(vfxYaz(geri).equals(b)).toBe(true);
  });
});

describe.skipIf(exodusYok)("VFX sürüm 3 (gerçek Metro Exodus)", () => {
  const ham = exodusVfx();
  const d = exodusYok ? undefined : vfxOku(ham);

  it("başlığı ve tabloları okur", () => {
    expect(d!.surum).toEqual([3, 1]);
    expect(d!.icerikSurumu).toMatch(/^src_\d+-shdr_\d+-script_\d+$/);
    expect(d!.paketler.length).toBe(65);
    expect(d!.paketler[1]).toMatchObject({ ad: "content_03.vfs0", klasorler: ["m3\\000"], boyut: 3 });
    expect(d!.kopyalar.length).toBe(0);
    expect(d!.dosyalar.length).toBe(282465);
  });

  it("dil, font ve ayar dosyalarını bulur", () => {
    expect(girdiBul(d!, "localization/stable_us.lng")[0]?.yol).toBe("content/localization/stable_us.lng");
    expect(girdiBul(d!, "content/config.bin").length).toBe(1);
    expect(girdiBul(d!, "font/font_font_regular_us.512").length).toBe(1);
  });

  it("değiştirilmeden yazılınca bayt bayt aynı çıkar", () => {
    expect(vfxYaz(d!).equals(ham)).toBe(true);
  });
});
