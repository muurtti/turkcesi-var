import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, vfxYaz, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { yamaPaketiOlustur } from "../../../src/motorlar/4a/yama-paketi.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

describe.skipIf(metroYok)("arşiv yazıcı (gerçek Metro 2033 Redux)", () => {
  let ham: Buffer;
  let d: VfxDizin;
  let gecici: string;

  beforeAll(() => {
    ham = METRO_VFX;
    d = vfxOku(ham);
    gecici = mkdtempSync(join(tmpdir(), "tv-yama-"));
  });
  afterAll(() => rmSync(gecici, { recursive: true, force: true }));

  it("dizini bayt bayt aynı geri yazar", () => {
    expect(vfxYaz(d).equals(ham)).toBe(true);
  });

  it("değişen dosyaları yeni pakete koyar, diğerlerine dokunmaz", () => {
    const hedef = girdiBul(d, "localization/stable_us.lng")[0]!;
    const yeniIcerik = Buffer.from("Türkçesi Var denemesi", "utf8");
    const sonuc = yamaPaketiOlustur(d, new Map([[hedef.yol, yeniIcerik]]));
    expect(sonuc.paketAdi).toBe("content28.vfs0");

    // Paket: u32 0, u32 veriUzunluğu, veri, u32 3, u32 16, GUID
    const p = sonuc.paketIcerik;
    expect(p.readUInt32LE(0)).toBe(0);
    expect(p.readUInt32LE(4)).toBe(p.length - 32);
    expect(p.subarray(p.length - 24, p.length - 16).equals(Buffer.from([3, 0, 0, 0, 16, 0, 0, 0]))).toBe(true);
    expect(p.subarray(p.length - 16).equals(d.guid)).toBe(true);

    writeFileSync(join(gecici, "content.vfx"), sonuc.yeniVfx);
    writeFileSync(join(gecici, sonuc.paketAdi), p);
    const yeni = vfxOku(readFileSync(join(gecici, "content.vfx")));
    expect(yeni.paketler.length).toBe(d.paketler.length + 1);
    expect(yeni.paketler.at(-1)).toEqual({
      ad: "content28.vfs0",
      klasorler: d.paketler[0]!.klasorler,
      boyut: p.length,
    });
    const okunan = dosyaCikar([gecici, METRO_DIR], yeni, girdiBul(yeni, "localization/stable_us.lng")[0]!);
    expect(okunan.equals(yeniIcerik)).toBe(true);

    // Değişmeyen 50 küçük dosya orijinal içeriği verir.
    const kucukler = d.dosyalar.filter((g) => g.sikistirilmisBoyut < 200_000 && g.yol !== hedef.yol);
    for (let i = 0; i < 50; i++) {
      const g = kucukler[Math.floor((i * kucukler.length) / 50)]!;
      const yg = yeni.kayitlar[g.sira];
      expect(yg?.tur === "dosya" && yg.paketNo).toBe(g.paketNo);
      expect(dosyaCikar([gecici, METRO_DIR], yeni, yg as typeof g).equals(dosyaCikar([METRO_DIR], d, g))).toBe(true);
    }
  });

  it("kopya tablosundaki kayıtları da yeni pakete yönlendirir", () => {
    const k = d.kopyalar[0]!;
    const g = d.kayitlar[k.kayitSirasi]!;
    const sonuc = yamaPaketiOlustur(d, new Map([[g.yol, Buffer.from("x")]]));
    const yeni = vfxOku(sonuc.yeniVfx);
    const yeniPaketNo = yeni.paketler.length - 1;
    const ilgili = yeni.kopyalar.filter((x) => x.kayitSirasi === k.kayitSirasi);
    expect(ilgili.length).toBe(d.kopyalar.filter((x) => x.kayitSirasi === k.kayitSirasi).length);
    for (const x of ilgili) expect([x.paketNo, x.boyut, x.sikistirilmisBoyut]).toEqual([yeniPaketNo, 1, 1]);
    // İlgisiz kopyalar aynı kalır.
    const ilgisiz = d.kopyalar.findIndex((x) => x.kayitSirasi !== k.kayitSirasi);
    expect(yeni.kopyalar[ilgisiz]).toEqual(d.kopyalar[ilgisiz]);
  });

  it("dizinde olmayan bir yol verilirse anlaşılır hata verir", () => {
    expect(() => yamaPaketiOlustur(d, new Map([["content/yok/boyle.bir", Buffer.alloc(1)]]))).toThrow(/bulunamadı/);
  });
});
