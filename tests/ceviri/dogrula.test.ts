import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ceviriSorunlari, korunacakIsaretler } from "../../src/ceviri/dogrula.js";
import { cevrilecekSatirlar, type CeviriSatiri } from "../../src/ceviri/satirlar.js";
import { metinTablosuOku } from "../../src/motorlar/4a/metin-tablosu.js";
import { dosyaCikar } from "../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../../src/motorlar/4a/vfx.js";
import { TURKCE_HARFLER } from "../../src/ortak/turkce.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../yardimci.js";

const HER_SEY = new Set([..." abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?'<>[]{}%\\_#$-:", ...TURKCE_HARFLER]);
const satir = (en: string, tur: CeviriSatiri["tur"] = "altyazi"): CeviriSatiri => ({ anahtar: "k", en, tur, grup: "g", sira: 0 });

describe("korunacak işaretler", () => {
  it("işaretleri metindeki sırasıyla bulur", () => {
    expect(korunacakIsaretler("Press [E] to %s\\n<b>x</b> {0}")).toEqual(["[E]", "%s", "\\n", "<b>", "</b>", "{0}"]);
  });

  it("oyundaki tuş etiketlerini ve değişkenleri bulur, boşluklu köşeli parantezi ve yüzdeyi saymaz", () => {
    expect(korunacakIsaretler("Hold <use> and <#crouch_toggle><br>$ed_adv_5 [not a tag] 100% done")).toEqual([
      "<use>",
      "<#crouch_toggle>",
      "<br>",
      "$ed_adv_5",
    ]);
  });
});

describe("yüzde", () => {
  it("Türkçede başa gelen yüzde işareti (%40) işaret sayılmaz", () => {
    expect(korunacakIsaretler("%40")).toEqual([]);
    expect(ceviriSorunlari(satir("40%", "arayuz"), "%40", HER_SEY)).toEqual([]);
  });
});

describe("çeviri sorunları", () => {
  it("işaretlerin sırası değişse de aynıysa sorun yok", () => {
    expect(ceviriSorunlari(satir("Press <use> to <jump>"), "<jump> için <use> tuşuna bas", HER_SEY)).toEqual([]);
  });

  it("eksik ya da fazladan işaret → isaret-bozuk", () => {
    expect(ceviriSorunlari(satir("Press <use> to <jump>"), "<use> tuşuna bas", HER_SEY)).toContain("isaret-bozuk");
    expect(ceviriSorunlari(satir("Press <use>"), "<use> <use> bas", HER_SEY)).toContain("isaret-bozuk");
  });

  it("tablodaOlmayanKarakterIsaretlenir", () => {
    expect(ceviriSorunlari(satir("Hello"), "Merhaba 😀", HER_SEY)).toContain("karakter-yok");
  });

  it("arayüzde çok uzun çeviri → cok-uzun; altyazıda uygulanmaz", () => {
    expect(ceviriSorunlari(satir("BACK", "arayuz"), "GERİ DÖNMEK İÇİN BURAYA TIKLAYIN", HER_SEY)).toContain("cok-uzun");
    expect(ceviriSorunlari(satir("BACK", "arayuz"), "GERİ", HER_SEY)).toEqual([]);
    expect(ceviriSorunlari(satir("Go"), "Hadi gidelim artık buradan çabuk", HER_SEY)).not.toContain("cok-uzun");
  });

  it("boş çeviri → bos; uzun satır aynen kalmışsa → ingilizce-kalmis", () => {
    expect(ceviriSorunlari(satir("Hello"), "  ", HER_SEY)).toContain("bos");
    const en = "This sentence was not translated at all";
    expect(ceviriSorunlari(satir(en), en, HER_SEY)).toContain("ingilizce-kalmis");
  });
});

describe.skipIf(metroYok)("doğrulama (gerçek stable_us.lng)", () => {
  it("bütün satırlar kendi İngilizceleriyle işaret ya da karakter sorunu vermez", () => {
    const d = vfxOku(METRO_VFX);
    const t = metinTablosuOku(dosyaCikar([METRO_DIR], d, girdiBul(d, "localization/stable_us.lng")[0]!));
    const kullanilabilir = new Set([...t.karakterler.slice(1), ...TURKCE_HARFLER]);
    const sorunlu = cevrilecekSatirlar(t)
      .map((s) => ({ s, sorun: ceviriSorunlari(s, s.en, kullanilabilir).filter((x) => x !== "ingilizce-kalmis") }))
      .filter((x) => x.sorun.length > 0);
    expect(sorunlu.slice(0, 5).map((x) => `${x.s.anahtar}: ${x.sorun.join(",")}`)).toEqual([]);
  });
});
