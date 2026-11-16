import { describe, expect, it } from "vitest";
import {
  bc7BlokCoz,
  bc7BlokKodla,
  bc7SeviyeCoz,
  exodusDokuOku,
  exodusDokuYaz,
  exodusParcaBilgisi,
} from "../../../src/motorlar/4a/bc7.js";
import { lz4BlokAc } from "../../../src/motorlar/4a/lz4.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../../../src/motorlar/4a/vfx.js";
import { EXODUS_DIR, exodusVfx, exodusYok } from "../../yardimci.js";

const blokHatasi = (a: Uint8Array, b: Uint8Array) => {
  let enBuyuk = 0;
  for (let i = 0; i < 64; i++) enBuyuk = Math.max(enBuyuk, Math.abs(a[i]! - b[i]!));
  return enBuyuk;
};
const blok = (f: (i: number) => [number, number, number, number]) => {
  const p = new Uint8Array(64);
  for (let i = 0; i < 16; i++) p.set(f(i), i * 4);
  return p;
};

describe("BC7 blok kodlayıcı", () => {
  const ornekler: [string, Uint8Array, number][] = [
    ["düz opak siyah", blok(() => [0, 0, 0, 255]), 0],
    ["düz saydam", blok(() => [0, 0, 0, 0]), 0],
    ["sarı dolgu", blok(() => [255, 255, 0, 255]), 2],
    ["harf kenarı: siyah → yeşil çizgi → sarı dolgu", blok((i) => [[0, 0, 0, 255], [0, 126, 0, 255], [255, 255, 0, 255], [222, 239, 0, 255]][i & 3] as [number, number, number, number]), 12],
    ["glif kutusu sınırı: saydam ve opak yan yana", blok((i) => ((i & 3) < 2 ? [0, 0, 0, 0] : [0, 120, 0, 255])), 10],
    ["yumuşak geçiş", blok((i) => [i * 16, i * 16, 0, 255]), 12],
  ];
  for (const [ad, piks, sinir] of ornekler) {
    it(`kodlayıp çözünce yakın sonuç verir: ${ad}`, () => {
      const kod = bc7BlokKodla(piks);
      expect(kod.length).toBe(16);
      expect(blokHatasi(bc7BlokCoz(kod, 0), piks)).toBeLessThanOrEqual(sinir);
    });
  }
});

describe.skipIf(exodusYok)("Exodus font dokusu (gerçek dosya, yalnız okuma)", () => {
  const d = exodusYok ? undefined : vfxOku(exodusVfx());
  const parca = (yol: string) => {
    const g = girdiBul(d!, yol)[0]!;
    return { yol: g.yol, veri: dosyaCikar([EXODUS_DIR], d!, g) };
  };

  it(".512 dosyası LZ4 + BC7, 512×512, 10 mip", () => {
    const p = parca("font/font_font_regular_us.512");
    const b = exodusParcaBilgisi(p.yol);
    expect(b).toEqual({ boyut: 512, mipSayisi: 10, acikBoyut: 349552 });
    expect(lz4BlokAc(p.veri, b.acikBoyut).length).toBe(349552);
  });

  it("dokuyu çözer: harflerin bulunduğu üst kısım dolu, alt kısım boş (saydam)", () => {
    const { doku } = exodusDokuOku([parca("font/font_font_regular_us.512")]);
    expect(doku.gen).toBe(512);
    const alfa = (x: number, y: number) => doku.rgba[(y * 512 + x) * 4 + 3]!;
    expect(alfa(300, 480)).toBe(0);
    let opak = 0;
    for (let x = 0; x < 512; x++) if (alfa(x, 20) === 255) opak++;
    expect(opak).toBeGreaterThan(350);
  });

  it("değişmemiş doku yazılınca bütün BC7 blokları aynen kalır", () => {
    const p = parca("font/font_font_regular_us.512");
    const { doku } = exodusDokuOku([p]);
    const [yeni] = exodusDokuYaz(doku, [p]);
    expect(lz4BlokAc(yeni!, 349552).equals(lz4BlokAc(p.veri, 349552))).toBe(true);
  });

  it("bir bölge değişince yalnız o bölgenin blokları ve küçük mipleri değişir", () => {
    const p = parca("font/font_font_regular_us.512");
    const { doku } = exodusDokuOku([p]);
    const rgba = Buffer.from(doku.rgba);
    for (let y = 460; y < 476; y++) for (let x = 40; x < 60; x++) rgba.set([255, 255, 0, 255], (y * 512 + x) * 4);
    const [yeni] = exodusDokuYaz({ ...doku, rgba }, [p]);
    const eski = lz4BlokAc(p.veri, 349552), son = lz4BlokAc(yeni!, 349552);
    let degisen = 0;
    for (let o = 0; o < 128 * 128 * 16; o += 16) if (!eski.subarray(o, o + 16).equals(son.subarray(o, o + 16))) degisen++;
    expect(degisen).toBeGreaterThan(0);
    expect(degisen).toBeLessThanOrEqual(6 * 5);
    // Yeni bölge doğru çözülür.
    const seviye0 = bc7SeviyeCoz(son, 0, 512, 512);
    const i = (468 * 512 + 50) * 4;
    // BC7 kayıplıdır: ±2 fark kabul.
    [255, 255, 0, 255].forEach((v, c) => expect(Math.abs(seviye0[i + c]! - v)).toBeLessThanOrEqual(2));
  });

  it("1024'lük dokuda .1024 (1 mip) ve .512 (10 mip) tek doku olarak okunur", () => {
    const parcalar = [parca("font/font_metro_for_map_us.1024"), parca("font/font_metro_for_map_us.512")];
    const { doku } = exodusDokuOku(parcalar);
    expect(doku.gen).toBe(1024);
    const yeni = exodusDokuYaz(doku, parcalar);
    expect(yeni.length).toBe(2);
    expect(lz4BlokAc(yeni[1]!, 349552).equals(lz4BlokAc(parcalar[1]!.veri, 349552))).toBe(true);
  });
});
