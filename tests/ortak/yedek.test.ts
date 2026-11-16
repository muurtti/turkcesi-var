import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { geriYukle, uygula, yamaDurumu, yamayiUnut, yedekKlasoruSec } from "../../src/ortak/yedek.js";

describe("aynı oyunun iki kurulumu (Steam + Epic) ayrı yedeklenir", () => {
  let kok: string;
  beforeEach(() => (kok = mkdtempSync(join(tmpdir(), "tv-ikikurulum-"))));
  afterEach(() => rmSync(kok, { recursive: true, force: true }));

  it("eski tek yedek klasörü kendi oyununa ait kalır; ikinci kurulum ayrı klasör alır; ikisi birbirini bozmaz", async () => {
    const kokYedek = join(kok, "yedekler", "metro2033redux");
    const steam = join(kok, "Steam", "Metro 2033 Redux");
    const epic = join(kok, "Epic Games", "Metro2033Redux");
    for (const k of [steam, epic]) {
      mkdirSync(k, { recursive: true });
      writeFileSync(join(k, "content.vfx"), `orijinal ${k}`);
    }
    // Eski sürümden kalma: Steam kurulumunun yedeği doğrudan kök yedek klasöründe.
    await uygula(steam, kokYedek, { "content.vfx": Buffer.from("yamalı steam") }, { "content28.vfs0": Buffer.from("p") });
    expect(yedekKlasoruSec(kokYedek, steam)).toBe(kokYedek);
    expect(yedekKlasoruSec(kokYedek, steam.toUpperCase())).toBe(kokYedek); // Windows: büyük/küçük harf fark etmez
    const epicYedek = yedekKlasoruSec(kokYedek, epic);
    expect(epicYedek).not.toBe(kokYedek);
    expect(yedekKlasoruSec(kokYedek, epic)).toBe(epicYedek); // kararlı

    await uygula(epic, epicYedek, { "content.vfx": Buffer.from("yamalı epic") }, { "content28.vfs0": Buffer.from("p") });
    expect(yamaDurumu(steam, kokYedek)).toBe("kurulu");
    expect(yamaDurumu(epic, epicYedek)).toBe("kurulu");
    await geriYukle(epic, epicYedek);
    expect(readFileSync(join(epic, "content.vfx"), "utf8")).toBe(`orijinal ${epic}`);
    expect(yamaDurumu(steam, kokYedek)).toBe("kurulu"); // Steam'inki etkilenmedi
    await geriYukle(steam, yedekKlasoruSec(kokYedek, steam));
    expect(readFileSync(join(steam, "content.vfx"), "utf8")).toBe(`orijinal ${steam}`);
  });

  it("hiç yedek yokken yeni kurulumlar klasöre özel yere gider", () => {
    const kokYedek = join(kok, "yedekler", "metro2033redux");
    expect(yedekKlasoruSec(kokYedek, join(kok, "A"))).toMatch(/metro2033redux@[0-9a-f]{10}$/);
    expect(yedekKlasoruSec(kokYedek, join(kok, "A"))).not.toBe(yedekKlasoruSec(kokYedek, join(kok, "B")));
  });

  it("oyun klasörü taşınırsa (D:→E:, Steam 'klasörü taşı') yedeği bulunur ve Türkçe kaldırılabilir", async () => {
    const kokYedek = join(kok, "yedekler", "metro2033redux");
    const eskiYer = join(kok, "D", "Metro 2033 Redux");
    const yeniYer = join(kok, "E", "Metro 2033 Redux");
    mkdirSync(eskiYer, { recursive: true });
    writeFileSync(join(eskiYer, "content.vfx"), "orijinal");
    const yedek = yedekKlasoruSec(kokYedek, eskiYer);
    await uygula(eskiYer, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") });
    mkdirSync(join(kok, "E"));
    renameSync(eskiYer, yeniYer); // taşındı
    expect(yedekKlasoruSec(kokYedek, yeniYer)).toBe(yedek);
    expect(yamaDurumu(yeniYer, yedekKlasoruSec(kokYedek, yeniYer))).toBe("kurulu");
    await geriYukle(yeniYer, yedekKlasoruSec(kokYedek, yeniYer));
    expect(readFileSync(join(yeniYer, "content.vfx"), "utf8")).toBe("orijinal");
  });

  it("öteki kurulum hâlâ yerindeyse onun yedeği sahiplenilmez (Steam + Epic aynı dosyalarla)", async () => {
    const kokYedek = join(kok, "yedekler", "metro2033redux");
    const steam = join(kok, "Steam", "Metro");
    const epic = join(kok, "Epic", "Metro");
    for (const k of [steam, epic]) {
      mkdirSync(k, { recursive: true });
      writeFileSync(join(k, "content.vfx"), "aynı orijinal");
    }
    const steamYedek = yedekKlasoruSec(kokYedek, steam);
    await uygula(steam, steamYedek, { "content.vfx": Buffer.from("aynı yama") }, {});
    writeFileSync(join(epic, "content.vfx"), "aynı yama"); // Epic kopyası da aynı içerikte
    expect(yedekKlasoruSec(kokYedek, epic)).not.toBe(steamYedek);
  });

  it("'unut' yedeği silmez, tarihli arşiv olarak saklar; arşiv yeni kurulumlarca sahiplenilmez", async () => {
    const kokYedek = join(kok, "yedekler", "metro2033redux");
    const oyun = join(kok, "Oyun");
    mkdirSync(oyun);
    writeFileSync(join(oyun, "content.vfx"), "orijinal v1");
    const yedek = yedekKlasoruSec(kokYedek, oyun);
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") });
    writeFileSync(join(oyun, "content.vfx"), "steam v2");
    await yamayiUnut(oyun, yedek);
    expect(existsSync(yedek)).toBe(false);
    const arsiv = readdirSync(join(kok, "yedekler")).filter((a) => a.includes(".eski-"));
    expect(arsiv.length).toBe(1);
    expect(readFileSync(join(kok, "yedekler", arsiv[0]!, "orijinal", "content.vfx"), "utf8")).toBe("orijinal v1");
    expect(yedekKlasoruSec(kokYedek, oyun)).toBe(yedek);
  });

  it("Steam doğrulamasından kalan, birebir aynı Türkçe paket dosyası kurulumu engellemez", async () => {
    const kokYedek = join(kok, "yedekler", "metro2033redux");
    const oyun = join(kok, "Oyun");
    mkdirSync(oyun);
    writeFileSync(join(oyun, "content.vfx"), "orijinal");
    writeFileSync(join(oyun, "content28.vfs0"), "p"); // artık
    const yedek = yedekKlasoruSec(kokYedek, oyun);
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") });
    expect(yamaDurumu(oyun, yedek)).toBe("kurulu");
    await geriYukle(oyun, yedek);
    expect(existsSync(join(oyun, "content28.vfs0"))).toBe(false);
  });
});

const ozet = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function klasorOzeti(k: string): Record<string, string> {
  const s: Record<string, string> = {};
  for (const ad of readdirSync(k).sort()) s[ad] = ozet(readFileSync(join(k, ad)));
  return s;
}

describe("yedek, güvenli uygulama ve geri alma", () => {
  let kok: string;
  let oyun: string;
  let yedek: string;

  beforeEach(() => {
    kok = mkdtempSync(join(tmpdir(), "tv-yedek-"));
    oyun = join(kok, "Türkçe Klasör (x86)", "Metro 2033 Redux");
    yedek = join(kok, "yedekler", "metro2033redux");
    mkdirSync(oyun, { recursive: true });
    writeFileSync(join(oyun, "content.vfx"), "orijinal dizin");
    writeFileSync(join(oyun, "content00.vfs0"), "dokunulmayacak büyük paket");
  });
  afterEach(() => {
    try {
      chmodSync(join(oyun, "content.vfx"), 0o666);
    } catch {
      /* yok */
    }
    rmSync(kok, { recursive: true, force: true });
  });

  it("uygulaSonraGeriYukleOrijinaliDondurur", async () => {
    const ilk = klasorOzeti(oyun);
    const kayit = await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı dizin") }, { "content28.vfs0": Buffer.from("yeni paket") });
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("yamalı dizin");
    expect(readFileSync(join(oyun, "content28.vfs0"), "utf8")).toBe("yeni paket");
    expect(kayit.orijinalOzetler["content.vfx"]).toBe(ozet("orijinal dizin"));
    expect(kayit.eklenenDosyalar).toEqual(["content28.vfs0"]);

    await geriYukle(oyun, yedek);
    expect(klasorOzeti(oyun)).toEqual(ilk);
  });

  it("ikinciUygulamaOrijinalYedegiKorur", async () => {
    const ilk = klasorOzeti(oyun);
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yama 1") }, { "content28.vfs0": Buffer.from("p1") });
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yama 2") }, { "content28.vfs0": Buffer.from("p2") });
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("yama 2");
    await geriYukle(oyun, yedek);
    expect(klasorOzeti(oyun)).toEqual(ilk);
  });

  it("geriYukle_ozetUyusmazsaReddeder", async () => {
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı dizin") }, { "content28.vfs0": Buffer.from("p") });
    writeFileSync(join(oyun, "content.vfx"), "steam güncellemesi");
    const once = klasorOzeti(oyun);
    await expect(geriYukle(oyun, yedek)).rejects.toThrow(/Oyun dosyaları yamadan sonra değişmiş/);
    expect(klasorOzeti(oyun)).toEqual(once);
  });

  it("uygula_yazmaHatasindaHicbirSeyDegismez", async () => {
    const once = klasorOzeti(oyun);
    chmodSync(join(oyun, "content.vfx"), 0o444); // salt okunur: yerine yazma başarısız olur
    await expect(
      uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") }),
    ).rejects.toThrow();
    expect(klasorOzeti(oyun)).toEqual(once);
    expect(readdirSync(oyun).some((a) => a.endsWith(".tv-gecici"))).toBe(false);
    expect(existsSync(join(yedek, "kayit.json"))).toBe(false);
  });

  it("bizim eklemediğimiz bir dosyanın üzerine yazmaz", async () => {
    writeFileSync(join(oyun, "content28.vfs0"), "başka bir yamanın dosyası");
    await expect(uygula(oyun, yedek, {}, { "content28.vfs0": Buffer.from("p") })).rejects.toThrow(/zaten var/);
    expect(readFileSync(join(oyun, "content28.vfs0"), "utf8")).toBe("başka bir yamanın dosyası");
  });

  it("oyun dosyaları yazıldıktan sonra çökme olursa geri yükleme çalışır ve asıl yedek ezilmez", async () => {
    const ilk = klasorOzeti(oyun);
    await expect(
      uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") }, {
        oyunYazildi: () => {
          throw new Error("çökme benzetimi");
        },
      }),
    ).rejects.toThrow("çökme benzetimi");
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("yamalı"); // oyun yamalı kaldı
    // Yeniden uygulamak asıl yedeği ezmez:
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı 2") }, { "content28.vfs0": Buffer.from("p2") });
    await geriYukle(oyun, yedek);
    expect(klasorOzeti(oyun)).toEqual(ilk);
  });

  it("çökmeden sonra doğrudan geri yükleme de orijinali döndürür", async () => {
    const ilk = klasorOzeti(oyun);
    await expect(
      uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") }, {
        oyunYazildi: () => {
          throw new Error("çökme");
        },
      }),
    ).rejects.toThrow();
    await geriYukle(oyun, yedek);
    expect(klasorOzeti(oyun)).toEqual(ilk);
  });

  it("yazma yarıda kesildiyse (eklenen dosya yok) durum 'kurulu' değil 'degismis' olur", async () => {
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") });
    expect(yamaDurumu(oyun, yedek)).toBe("kurulu");
    rmSync(join(oyun, "content28.vfs0"));
    expect(yamaDurumu(oyun, yedek)).toBe("degismis");
  });

  it("kayıtsız ama farklı içerikli bir yedek varsa üzerine yazmaz, durur", async () => {
    mkdirSync(join(yedek, "orijinal"), { recursive: true });
    writeFileSync(join(yedek, "orijinal", "content.vfx"), "asıl orijinal");
    writeFileSync(join(oyun, "content.vfx"), "bilinmeyen durum");
    await expect(uygula(oyun, yedek, { "content.vfx": Buffer.from("y") }, {})).rejects.toThrow(/yedek/i);
    expect(readFileSync(join(yedek, "orijinal", "content.vfx"), "utf8")).toBe("asıl orijinal");
  });

  it("bozuk kayıt dosyası anlaşılır Türkçe hata verir", async () => {
    mkdirSync(yedek, { recursive: true });
    writeFileSync(join(yedek, "kayit.json"), '{"oyun": "yar');
    await expect(geriYukle(oyun, yedek)).rejects.toThrow(/kayıt dosyası bozuk/i);
  });

  it("Steam doğrulaması orijinali geri getirdiyse geri yükleme yalnızca artıkları temizler", async () => {
    const ilk = klasorOzeti(oyun);
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") });
    writeFileSync(join(oyun, "content.vfx"), "orijinal dizin"); // Steam doğrulaması
    await geriYukle(oyun, yedek);
    expect(klasorOzeti(oyun)).toEqual(ilk);
    expect(existsSync(join(yedek, "kayit.json"))).toBe(false);
  });

  it("yamayiUnut: Steam güncellemesinden sonra yalnızca eklenen dosyaları siler ve kaydı unutur", async () => {
    await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, { "content28.vfs0": Buffer.from("p") });
    writeFileSync(join(oyun, "content.vfx"), "steam güncellemesi");
    await yamayiUnut(oyun, yedek);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("steam güncellemesi");
    expect(existsSync(join(oyun, "content28.vfs0"))).toBe(false);
    expect(existsSync(join(yedek, "kayit.json"))).toBe(false);
  });

  it("yama yokken geri yükleme anlaşılır hata verir", async () => {
    await expect(geriYukle(oyun, yedek)).rejects.toThrow(/yaması kurulu değil/);
  });
});
