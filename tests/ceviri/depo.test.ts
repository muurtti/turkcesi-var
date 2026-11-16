import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bosDepo,
  depoOku,
  depoYaz,
  insanDuzeltmesi,
  modelCevirisiEkle,
  topluIsiBirak,
  uygulanabilirCeviriler,
} from "../../src/ceviri/depo.js";
import { paketiDepoyaAl, paketOlustur } from "../../src/ceviri/paket.js";
import { kaynakOzeti, type CeviriSatiri } from "../../src/ceviri/satirlar.js";

const HER_SEY = new Set([..." abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,!<>ğşıİçöüĞŞÇÖÜ"]);
const s = (anahtar: string, en: string, tur: CeviriSatiri["tur"] = "altyazi"): CeviriSatiri => ({
  anahtar, en, tur, grup: "g", sira: 0,
});

describe("çeviri deposu", () => {
  let klasor: string;
  beforeEach(() => {
    klasor = mkdtempSync(join(tmpdir(), "tv-depo-"));
  });
  afterEach(() => rmSync(klasor, { recursive: true, force: true }));

  it("I6: takılı kalan toplu işten çıkılabilir (çevirilere dokunmadan)", () => {
    const d = bosDepo("metro2033redux", "m");
    modelCevirisiEkle(d, s("a", "Hello"), "Merhaba", []);
    d.toplu = { id: "msgbatch_x", gruplar: [], gonderim: "t" };
    expect(topluIsiBirak(d)).toBe(true);
    expect(d.toplu).toBeUndefined();
    expect(d.satirlar.a!.tr).toBe("Merhaba");
    expect(topluIsiBirak(d)).toBe(false);
  });

  it("insanDuzeltmesiEzilmez", () => {
    const d = bosDepo("metro2033redux", "model");
    const a = s("a", "Wake up");
    insanDuzeltmesi(d, a, "Uyan be", []);
    modelCevirisiEkle(d, a, "Uyan", []);
    expect(d.satirlar.a).toMatchObject({ tr: "Uyan be", kaynak: "insan" });
  });

  it("kaynak metin değişmişse insan düzeltmesi de modelce yenilenebilir", () => {
    const d = bosDepo("metro2033redux", "m");
    insanDuzeltmesi(d, s("a", "Wake up"), "Uyan be", []);
    modelCevirisiEkle(d, s("a", "Wake up now"), "Hemen uyan", []);
    expect(d.satirlar.a).toMatchObject({ tr: "Hemen uyan", kaynak: "model" });
  });

  it("kaynakOzetiDegisenSatirUygulanmaz", () => {
    const d = bosDepo("metro2033redux", "m");
    modelCevirisiEkle(d, s("a", "Old text"), "Eski metin", []);
    const sonuc = uygulanabilirCeviriler(d, [s("a", "New text")], HER_SEY);
    expect(sonuc.ceviriler.size).toBe(0);
    expect(sonuc.guncelDegil).toEqual(["a"]);
  });

  it("sorunlar uygularken yeniden hesaplanır: bozuk olanlar girmez, çok uzun girer ama listelenir", () => {
    const d = bosDepo("metro2033redux", "m");
    const satirlar = [
      s("iyi", "Hello"),
      s("isaret", "Press <use>"),
      s("karakter", "Hi"),
      s("uzun", "BACK", "arayuz"),
      s("yok", "Untranslated"),
    ];
    modelCevirisiEkle(d, satirlar[0]!, "Merhaba", []);
    modelCevirisiEkle(d, satirlar[1]!, "Bas", []); // depoda sorun yazılmamış olsa bile
    modelCevirisiEkle(d, satirlar[2]!, "Selam ♥", []);
    modelCevirisiEkle(d, satirlar[3]!, "GERI DONMEK ICIN BURAYA TIKLAYIN", []);
    const sonuc = uygulanabilirCeviriler(d, satirlar, HER_SEY);
    expect([...sonuc.ceviriler.keys()].sort()).toEqual(["iyi", "uzun"]);
    expect(sonuc.sorunlu.sort()).toEqual(["isaret", "karakter", "uzun"]);
    expect(sonuc.guncelDegil).toEqual([]);
  });

  it("yazıp okuyunca aynı depo gelir; yarım kalan yazma eski depoyu bozmaz", () => {
    const d = bosDepo("metro2033redux", "m");
    modelCevirisiEkle(d, s("a", "Hello"), "Merhaba", []);
    depoYaz(klasor, d);
    expect(depoOku(klasor)).toEqual(d);
    writeFileSync(join(klasor, "depo.json.tv-gecici"), '{"yarım');
    expect(depoOku(klasor)).toEqual(d);
  });

  it("depo yoksa undefined döner", () => {
    expect(depoOku(join(klasor, "yok"))).toBeUndefined();
    expect(existsSync(join(klasor, "yok"))).toBe(false);
  });
});

describe("çeviri paketi", () => {
  it("İngilizce metin içermez; paket → depo → paket aynıdır", () => {
    const d = bosDepo("metro2033redux", "model");
    const ingilizce = ["Artyom! Wake up, Artyom!", "Get ready, I'll be waiting at the exit"];
    modelCevirisiEkle(d, s("a", ingilizce[0]!), "Artyom! Uyan, Artyom!", []);
    insanDuzeltmesi(d, s("b", ingilizce[1]!), "Hazırlan, çıkışta bekliyor olacağım", []);
    const p = paketOlustur(d, "abc123", ["turkcesivar"]);
    const json = JSON.stringify(p);
    for (const en of ingilizce) expect(json).not.toContain(en);
    expect(p.satirlar.a).toEqual({ tr: "Artyom! Uyan, Artyom!", kaynakOzeti: kaynakOzeti(ingilizce[0]!) });
    const p2 = paketOlustur(paketiDepoyaAl(p), "abc123", ["turkcesivar"]);
    expect({ ...p2, tarih: "" }).toEqual({ ...p, tarih: "" });
  });
});
