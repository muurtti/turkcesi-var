import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lz4BlokAc, lz4BlokSikistir } from "../../../src/motorlar/4a/lz4.js";

describe("LZ4 tek blok", () => {
  const ornekler: [string, Buffer][] = [
    ["boş", Buffer.alloc(0)],
    ["kısa", Buffer.from("abc")],
    ["tekrarlı metin", Buffer.from("Türkçesi Var ".repeat(500))],
    ["sıfırlar", Buffer.alloc(100_000)],
    ["rastgele", randomBytes(70_000)],
    ["karışık", Buffer.concat([randomBytes(5000), Buffer.alloc(40_000, 7), randomBytes(3), Buffer.from("x".repeat(70_000))])],
  ];
  for (const [ad, veri] of ornekler) {
    it(`sıkıştırıp açınca aynısı çıkar: ${ad}`, () => {
      const s = lz4BlokSikistir(veri);
      expect(lz4BlokAc(s, veri.length).equals(veri)).toBe(true);
    });
  }

  it("tekrarlı veriyi gerçekten küçültür", () => {
    const veri = Buffer.alloc(349_552, 0);
    expect(lz4BlokSikistir(veri).length).toBeLessThan(veri.length / 50);
  });

  it("bozuk veride hata verir, sessizce yanlış sonuç üretmez", () => {
    const s = lz4BlokSikistir(Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
    expect(() => lz4BlokAc(s, 10)).toThrow();
    expect(() => lz4BlokAc(Buffer.from([0x0f, 0x00, 0x00]), 100)).toThrow();
  });
});
