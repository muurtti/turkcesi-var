import { beforeAll, describe, expect, it } from "vitest";
import { exodusDokuOku } from "../../../src/motorlar/4a/bc7.js";
import { fontlariOku } from "../../../src/motorlar/4a/font.js";
import { TURKCE_YUVALAR_EXODUS } from "../../../src/motorlar/4a/font-turkce.js";
import { metinTablosuOku } from "../../../src/motorlar/4a/metin-tablosu.js";
import { turkceYamaHazirla, type TurkceYama } from "../../../src/motorlar/4a/turkce-yama.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { EXODUS_DIR, exodusVfx, exodusYok } from "../../yardimci.js";

describe.skipIf(exodusYok)("Türkçe yama (gerçek Metro Exodus, yalnız bellekte; oyuna yazmaz)", () => {
  const ORIJINAL = exodusVfx();
  let y: TurkceYama;
  let d: VfxDizin;
  let anahtar: string;
  const tmp = new Map<string, Buffer>();
  const cikar = (yol: string) => {
    const g = girdiBul(d, yol)[0]!;
    const paket = d.paketler[g.paketNo]!.ad;
    // Yeni paket bellekte; diğerleri oyun klasöründe.
    if (tmp.has(paket)) {
      const v = tmp.get(paket)!;
      return g.boyut === g.sikistirilmisBoyut ? v.subarray(g.ofset, g.ofset + g.boyut) : dosyaCikar([EXODUS_DIR], d, g);
    }
    return dosyaCikar([EXODUS_DIR], d, g);
  };

  beforeAll(() => {
    const o = vfxOku(ORIJINAL);
    const t = metinTablosuOku(dosyaCikar([EXODUS_DIR], o, girdiBul(o, "localization/stable_us.lng")[0]!));
    anahtar = t.satirlar.find((s) => s.metin.trim() !== "")!.anahtar;
    y = turkceYamaHazirla(EXODUS_DIR, new Map([[anahtar, "Ağır şişe, ılık İçki: ÇĞİÖŞÜ çğıöşü"]]), { vfx: ORIJINAL });
    d = vfxOku(y.degisecek["content.vfx"]!);
    for (const [ad, v] of Object.entries(y.eklenecek)) tmp.set(ad, v);
  }, 600_000);

  it("bütün metin fontları yamalanır, atlanan olmaz", () => {
    expect(y.atlananFontlar).toEqual([]);
    expect(y.yamalananFontlar.length).toBe(8);
  });

  it("yeni paket Exodus adlandırmasıyla eklenir ve dizin onu gösterir", () => {
    expect(Object.keys(y.eklenecek)).toEqual(["content_53.vfs0"]);
    expect(d.paketler.at(-1)).toMatchObject({ ad: "content_53.vfs0", klasorler: ["m3\\000"], boyut: 53 });
    expect(d.icerikSurumu).toBe(vfxOku(ORIJINAL).icerikSurumu);
    const p = y.eklenecek["content_53.vfs0"]!;
    expect(p.readUInt32LE(p.length - 24)).toBe(3); // sonek: 3, 16, guid
    expect(p.subarray(p.length - 16).equals(d.guid)).toBe(true);
  });

  it("Türkçe satır yeni karakter tablosuyla okunur", () => {
    const t = metinTablosuOku(cikar("localization/stable_us.lng"));
    expect(t.satirlar.find((s) => s.anahtar === anahtar)?.metin).toBe("Ağır şişe, ılık İçki: ÇĞİÖŞÜ çğıöşü");
    expect(t.karakterler.slice(105, 111).join("")).toBe("ğĞşŞıİ");
  });

  it("her metin fontunda Türkçe yuvalar dolu ve glifler dokuda çizili", () => {
    const config = cikar("content/config.bin");
    const fontlar = fontlariOku(config, "us").filter((f) => f.glifler.length === 201);
    expect(fontlar.length).toBe(8);
    for (const f of fontlar) {
      const taban = `font/${f.dokuAdi.replace(/^font\\/, "")}`;
      const parcalar = [".1024", ".512"]
        .map((u) => girdiBul(d, `${taban}${u}`)[0])
        .filter((g) => g !== undefined)
        .map((g) => ({ yol: g.yol, veri: cikar(g.yol) }));
      if (parcalar.length === 0) {
        // Dokusu arşivde olmayan font (main_menu): yine de Türkçe yuvaları dolu olmalı.
        for (const sira of Object.values(TURKCE_YUVALAR_EXODUS)) expect(f.glifler[sira]!.gen, f.rol).toBeGreaterThan(0);
        continue;
      }
      const { doku } = exodusDokuOku(parcalar);
      for (const [harf, sira] of Object.entries(TURKCE_YUVALAR_EXODUS)) {
        const g = f.glifler[sira]!;
        expect(g.gen, `${f.rol} ${harf}`).toBeGreaterThan(0);
        // Glifin içinde parlak (dolgu) piksel olmalı.
        let parlak = 0;
        for (let yy = Math.max(0, g.y); yy < g.y + g.yuk; yy++)
          for (let xx = Math.max(0, g.x); xx < g.x + g.gen; xx++) if (doku.rgba[(yy * doku.gen + xx) * 4]! > 150) parlak++;
        expect(parlak, `${f.rol} ${harf}`).toBeGreaterThan(5);
      }
    }
  });
});
