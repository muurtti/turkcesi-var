import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { benzersizAnahtarlar, cevrilecekSatirlar, grupla, kaynakOzeti, type CeviriSatiri } from "../../src/ceviri/satirlar.js";
import { metinTablosuOku, type MetinTablosu } from "../../src/motorlar/4a/metin-tablosu.js";
import { dosyaCikar } from "../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../../src/motorlar/4a/vfx.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../yardimci.js";

function tablo(satirlar: [string, string][]): MetinTablosu {
  return {
    satirlar: satirlar.map(([anahtar, metin]) => ({ anahtar, metin })),
    karakterler: [],
    kodlama: "karakter-tablosu",
    bolumler: [],
    kodlu: [],
  };
}

describe("tekrarlanan anahtarlar (ör. iki sürümlü video altyazısı)", () => {
  it("ikinci geçiş '#2' ekiyle ayrı satır olur; Rusça da sırasıyla eşlenir", () => {
    const us = tablo([["2033\\intro", "<time=4000>v1"], ["x", "X"], ["2033\\intro", "<time=4080>v2"]]);
    const ru = tablo([["2033\\intro", "р1"], ["2033\\intro", "р2"]]);
    const s = cevrilecekSatirlar(us, ru);
    expect(s.filter((x) => x.anahtar.startsWith("2033\\intro")).map((x) => [x.anahtar, x.en, x.ru])).toEqual([
      ["2033\\intro", "<time=4000>v1", "р1"],
      ["2033\\intro#2", "<time=4080>v2", "р2"],
    ]);
  });

  it("benzersizAnahtarlar tablodaki sırayla anahtar üretir", () => {
    expect(benzersizAnahtarlar(tablo([["a", "1"], ["b", "2"], ["a", "3"], ["a", "4"]]))).toEqual(["a", "b", "a#2", "a#3"]);
  });
});

describe("çevrilecek satırlar", () => {
  it("boş satırları atlar, Rusçayı anahtardan eşler", () => {
    const us = tablo([["a", "Hello"], ["b", "   "], ["c", ""], ["d", "Bye"]]);
    const ru = tablo([["d", "Пока"], ["a", "Привет"]]);
    const s = cevrilecekSatirlar(us, ru);
    expect(s.map((x) => [x.anahtar, x.en, x.ru])).toEqual([["a", "Hello", "Привет"], ["d", "Bye", "Пока"]]);
  });

  it("türleri sınıflandırır", () => {
    const s = cevrilecekSatirlar(
      tablo([
        ["voices\\l00_intro\\int_001_khan", "Wake up"],
        ["$game_subtitles", "SUBTITLES"],
        ["menu_back", "BACK"],
        ["ACH_01_name", "Ranger"],
        ["2033_l00_title", "Prologue"],
      ]),
    );
    expect(s.map((x) => x.tur)).toEqual(["altyazi", "arayuz", "arayuz", "arayuz", "diger"]);
    expect(s.map((x) => x.grup)).toEqual(["voices\\l00_intro", "$game", "menu", "ACH", "2033"]);
  });

  it("önekli altyazı anahtarlarını (2033\\voices\\...) da altyazı sayar", () => {
    const s = cevrilecekSatirlar(tablo([["2033\\voices\\l34_biomass\\vlad_20", "Give me a minute"]]));
    expect([s[0]!.tur, s[0]!.grup]).toEqual(["altyazi", "2033\\voices\\l34_biomass"]);
  });

  it("grup içinde anahtarları sayı sırasıyla dizer", () => {
    const s = cevrilecekSatirlar(
      tablo([
        ["voices\\l01\\x_10", "c"],
        ["voices\\l01\\x_2", "b"],
        ["voices\\l01\\x_1", "a"],
      ]),
    );
    expect(s.map((x) => x.en)).toEqual(["a", "b", "c"]);
  });

  it("kaynak özeti sha256'nın ilk 16 hanesidir", () => {
    expect(kaynakOzeti("abc")).toBe("ba7816bf8f01cfea");
  });
});

describe("gruplama", () => {
  const satir = (grup: string, i: number, uzunluk = 10, tur: CeviriSatiri["tur"] = "altyazi"): CeviriSatiri => ({
    anahtar: `${grup}_${i}`,
    en: "x".repeat(uzunluk),
    tur,
    grup,
    sira: i,
  });

  it("satır ve karakter sınırını aşmaz, farklı altyazı sahnelerini karıştırmaz", () => {
    const satirlar = [
      ...Array.from({ length: 95 }, (_, i) => satir("A", i)),
      ...Array.from({ length: 5 }, (_, i) => satir("B", i, 1500)),
    ];
    const gruplar = grupla(satirlar, 40, 4000);
    for (const g of gruplar) {
      expect(g.satirlar.length).toBeLessThanOrEqual(40);
      expect(g.satirlar.reduce((t, s) => t + s.en.length, 0)).toBeLessThanOrEqual(4000);
      expect(new Set(g.satirlar.map((s) => s.grup)).size).toBe(1);
    }
    expect(gruplar.flatMap((g) => g.satirlar).length).toBe(100);
    expect(new Set(gruplar.map((g) => g.kimlik)).size).toBe(gruplar.length);
  });

  it("arayüz ve diğer satırlarda küçük grupları aynı türde birleştirir, türleri karıştırmaz", () => {
    const satirlar = [
      ...Array.from({ length: 30 }, (_, i) => satir(`$credits.${i}`, 0, 10, "arayuz")),
      ...Array.from({ length: 30 }, (_, i) => satir(`yazi${i}`, 0, 10, "diger")),
    ];
    const gruplar = grupla(satirlar, 40, 4000);
    expect(gruplar.length).toBe(2);
    for (const g of gruplar) expect(new Set(g.satirlar.map((x) => x.tur)).size).toBe(1);
    expect(new Set(gruplar.map((g) => g.kimlik)).size).toBe(2);
  });

  it("sınırdan uzun tek satır kendi grubunda yer alır", () => {
    const gruplar = grupla([satir("A", 0, 9000), satir("A", 1)], 40, 4000);
    expect(gruplar.map((g) => g.satirlar.length)).toEqual([1, 1]);
  });
});

describe.skipIf(metroYok)("çevrilecek satırlar (gerçek Metro 2033 Redux)", () => {
  it("bütün dolu satırları türleriyle çıkarır", () => {
    const d = vfxOku(METRO_VFX);
    const oku = (y: string) => metinTablosuOku(dosyaCikar([METRO_DIR], d, girdiBul(d, y)[0]!));
    const s = cevrilecekSatirlar(oku("localization/stable_us.lng"), oku("localization/stable_ru.lng"));
    expect(s.length).toBe(21442);
    const bul = (a: string) => s.find((x) => x.anahtar === a)!;
    expect(bul("voices\\l00_intro\\int_002_khan_intro_2").tur).toBe("altyazi");
    expect(bul("voices\\l00_intro\\int_002_khan_intro_2").ru).toBeTruthy();
    expect(bul("$game_subtitles").tur).toBe("arayuz");
    expect(grupla(s).length).toBeLessThan(700); // istek sayısı makul (önceden 3237)
  });
});
