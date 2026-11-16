import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { metinTablosuOku, metinTablosuYaz, type MetinTablosu } from "../../../src/motorlar/4a/metin-tablosu.js";
import { dosyaCikar } from "../../../src/motorlar/4a/vfs.js";
import { girdiBul, vfxOku } from "../../../src/motorlar/4a/vfx.js";
import { ALTYAZI_ANAHTARI, MENU_ANAHTARI } from "../../../src/fizibilite.js";
import { TURKCE_YUVALAR } from "../../../src/motorlar/4a/font-turkce.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../../yardimci.js";

function kucukTablo(): Buffer {
  // bölüm 0 (4 bayt 0), bölüm 1 karakter tablosu ["\uf8ff","\0","a","b"], bölüm 2: "k1\0" + [2,3] + "\0"
  const tablo = Buffer.from("\0ab", "utf16le");
  const govde = Buffer.from([...Buffer.from("k1\0", "latin1"), 2, 3, 0]);
  const bolum = (tur: number, veri: Buffer) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(tur, 0);
    b.writeUInt32LE(veri.length, 4);
    return Buffer.concat([b, veri]);
  };
  return Buffer.concat([bolum(0, Buffer.alloc(4)), bolum(1, tablo), bolum(2, govde)]);
}

describe("metin tablosu (küçük örnek)", () => {
  it("okur ve aynen yazar", () => {
    const t = metinTablosuOku(kucukTablo());
    expect(t.satirlar).toEqual([{ anahtar: "k1", metin: "ab" }]);
    expect(metinTablosuYaz(t).equals(kucukTablo())).toBe(true);
  });

  it("tabloda olmayan karakterde varsayılan olarak durur ve karakterleri adlandırır", () => {
    const t = metinTablosuOku(kucukTablo());
    t.satirlar[0]!.metin = "ağİ";
    expect(() => metinTablosuYaz(t)).toThrow(/ğ.*İ|İ.*ğ/);
  });

  it("açıkça istenirse yeni karakterleri tabloya ekler", () => {
    const t = metinTablosuOku(kucukTablo());
    t.satirlar[0]!.metin = "ağİ";
    const geri = metinTablosuOku(metinTablosuYaz(t, { tabloyuGenislet: true }));
    expect(geri.satirlar[0]!.metin).toBe("ağİ");
    expect(geri.karakterler.slice(0, 4)).toEqual(["\uf8ff", "\0", "a", "b"]);
  });

  it("tabloya sığmayacak kadar çok yeni karakterde anlaşılır hata verir", () => {
    const t = metinTablosuOku(kucukTablo());
    t.satirlar[0]!.metin = Array.from({ length: 300 }, (_, i) => String.fromCharCode(0x4e00 + i)).join("");
    expect(() => metinTablosuYaz(t, { tabloyuGenislet: true })).toThrow(/karakter tablosu/i);
  });
});

describe.skipIf(metroYok)("metin tablosu (gerçek stable_us.lng)", () => {
  let ham: Buffer;
  let t: MetinTablosu;
  beforeAll(() => {
    const d = vfxOku(METRO_VFX);
    ham = dosyaCikar([METRO_DIR], d, girdiBul(d, "localization/stable_us.lng")[0]!);
    t = metinTablosuOku(ham);
  });

  it("bayt bayt aynı geri yazar", () => {
    expect(metinTablosuYaz(t).equals(ham)).toBe(true);
  });

  it("bütün satırları okur", () => {
    expect(t.satirlar.length).toBe(23947);
  });

  it("deneme satırlarını bulur", () => {
    const bul = (a: string) => t.satirlar.find((s) => s.anahtar === a)?.metin;
    expect(bul(MENU_ANAHTARI)).toBe("NEW GAME");
    expect(bul(ALTYAZI_ANAHTARI)).toBe("Artyom! Wake up, Artyom! It's me, Khan!");
  });

  it("Türkçe metni yazıp aynen geri okur", () => {
    const kopya = metinTablosuOku(ham);
    for (const [harf, sira] of Object.entries(TURKCE_YUVALAR)) kopya.karakterler[sira] = harf;
    const s = kopya.satirlar.find((x) => x.anahtar === MENU_ANAHTARI)!;
    s.metin = "Ğğ Şş İı Çç Öö Üü";
    const geri = metinTablosuOku(metinTablosuYaz(kopya));
    expect(geri.satirlar.find((x) => x.anahtar === MENU_ANAHTARI)!.metin).toBe("Ğğ Şş İı Çç Öö Üü");
    expect(geri.satirlar.length).toBe(23947);
    expect(geri.karakterler.length).toBe(211); // tablo büyümedi
  });

  it("yuvalar doldurulmadan Türkçe yazmak hata verir (sessizce tablo büyümez)", () => {
    const kopya = metinTablosuOku(ham);
    kopya.satirlar.find((x) => x.anahtar === MENU_ANAHTARI)!.metin = "Ğğ";
    expect(() => metinTablosuYaz(kopya)).toThrow(/karakter tablosunda olmayan/);
  });
});
