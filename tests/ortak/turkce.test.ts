import { describe, expect, it } from "vitest";
import { TURKCE_HARFLER, eksikKarakterler } from "../../src/ortak/turkce.js";

describe("Türkçe karakter yardımcıları", () => {
  it("Türkçeye özgü harfleri içerir", () => {
    expect([...TURKCE_HARFLER].sort().join("")).toBe([..."ğĞşŞıİçÇöÖüÜ"].sort().join(""));
  });

  it("eksikKarakterleriBulur: tabloda olmayan karakterleri kod sırasıyla ve tekrarsız verir", () => {
    const tablo = ["", "\0", " ", "A", "a", "ç"];
    expect(eksikKarakterler(["Ağaç ışık", "ş"], tablo)).toEqual(["k", "ğ", "ı", "ş"]);
  });

  it("satır sonu (\\0) ve tablo başı yuvası eksik sayılmaz, hepsi varsa boş döner", () => {
    expect(eksikKarakterler(["Aa a"], ["", "\0", " ", "A", "a"])).toEqual([]);
  });
});
