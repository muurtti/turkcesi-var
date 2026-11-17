import { beforeAll, describe, expect, it } from "vitest";
import { EXODUS_I_KODU, TURKCE_YUVALAR_EXODUS, exodusYuvalari } from "../../../src/motorlar/4a/font-turkce.js";
import { metinTablosuOku } from "../../../src/motorlar/4a/metin-tablosu.js";
import { turkceYamaHazirla, type TurkceYama } from "../../../src/motorlar/4a/turkce-yama.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku, type VfxDizin } from "../../../src/motorlar/4a/vfx.js";
import { METRO_EXODUS_NORMAL } from "../../../src/oyunlar/metroexodus.js";
import { EXODUS_NORMAL_DIR, exodusNormalOrijinal, exodusNormalYok } from "../../yardimci.js";

describe("Exodus Türkçe harf yuvaları", () => {
  it("kontrol karakterlerinin yerinden bulunur (EE tablosunda eski sabitlerle aynı)", () => {
    const ee = Array.from({ length: 201 }, (_, i) => `k${i}`);
    "\x01\x02\x03\x04\x05\x06\x07".split("").forEach((c, i) => (ee[105 + i] = c));
    expect(exodusYuvalari(ee)).toEqual(TURKCE_YUVALAR_EXODUS);
    const normal = Array.from({ length: 203 }, (_, i) => `k${i}`);
    "\x01\x02\x03\x04\x05\x06\x07".split("").forEach((c, i) => (normal[114 + i] = c));
    expect(exodusYuvalari(normal)).toEqual({ ğ: 114, Ğ: 115, ş: 116, Ş: 117, ı: 118, İ: 120 });
    expect(exodusYuvalari(normal.map((c) => (c === "\x03" ? "ş" : c)))).toBeUndefined();
  });
});

describe.skipIf(exodusNormalYok)("Türkçe yama (gerçek Metro Exodus normal sürüm, yalnız bellekte; oyuna yazmaz)", () => {
  let y: TurkceYama;
  let anahtar: string;
  const katmanlar = () =>
    METRO_EXODUS_NORMAL.katmanlar!.map((ad) => ({ ad, vfx: exodusNormalOrijinal(ad) }));
  /** Yeni dizindeki dosyayı okur: yeni paket bellekte, diğerleri oyun klasöründe. */
  const oku = (d: VfxDizin, yol: string) => {
    const g = girdiBul(d, yol)[0]!;
    const ad = d.paketler[g.paketNo]!.ad;
    const bellek = y.eklenecek[ad];
    return bellek && g.boyut === g.sikistirilmisBoyut ? bellek.subarray(g.ofset, g.ofset + g.boyut) : dosyaCikar([EXODUS_NORMAL_DIR], d, g);
  };

  beforeAll(() => {
    const p4 = vfxOku(exodusNormalOrijinal("patch_04.vfx"));
    const t = metinTablosuOku(dosyaCikar([EXODUS_NORMAL_DIR], p4, girdiBul(p4, "localization/stable_us.lng")[0]!));
    anahtar = t.satirlar.find((s) => s.metin.trim() !== "")!.anahtar;
    y = turkceYamaHazirla(EXODUS_NORMAL_DIR, new Map([[anahtar, "Ağır şişe, ılık İçki"]]), {
      vfx: exodusNormalOrijinal("content.vfx"),
      katmanlar: katmanlar(),
    });
  }, 600_000);

  it("metin, config.bin ve font dokularının en yeni kopyaları patch_04'te: yalnız o yamalanır, content.vfx'e dokunulmaz", () => {
    expect(Object.keys(y.degisecek)).toEqual(["patch_04.vfx"]);
    expect(Object.keys(y.eklenecek)).toEqual(["patch_04_tr.vfs0"]);
    expect(y.atlananFontlar).toEqual([]);
    expect(y.yamalananFontlar.length).toBeGreaterThanOrEqual(8);
  });

  it("patch_04'ün yeni dizininde Türkçe satır ve harfler kendi yuvalarında", () => {
    const d = vfxOku(y.degisecek["patch_04.vfx"]!);
    expect(d.paketler.at(-1)?.ad).toBe("patch_04_tr.vfs0");
    const t = metinTablosuOku(oku(d, "localization/stable_us.lng"));
    expect(t.satirlar.find((s) => s.anahtar === anahtar)?.metin).toBe("Ağır şişe, ılık İçki".replaceAll("İ", EXODUS_I_KODU));
    for (const h of ["ğ", "Ğ", "ş", "Ş", "ı", EXODUS_I_KODU]) expect(t.karakterler).toContain(h);
  });
});
