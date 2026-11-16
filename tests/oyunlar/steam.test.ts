import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gorselleriBul, kutuphaneleriOku, oyunlariTara, vdfOku } from "../../src/oyunlar/steam.js";

let kok: string;
beforeEach(() => {
  kok = mkdtempSync(join(tmpdir(), "tv-steam-"));
});
afterEach(() => rmSync(kok, { recursive: true, force: true }));

function kutuphane(ad: string, oyunlar: { id?: number; ad: string; klasor: string; kurulu?: boolean }[]): string {
  const k = join(kok, ad);
  mkdirSync(join(k, "steamapps", "common"), { recursive: true });
  for (const o of oyunlar) {
    if (o.kurulu !== false) mkdirSync(join(k, "steamapps", "common", o.klasor), { recursive: true });
    if (o.id !== undefined) {
      writeFileSync(
        join(k, "steamapps", `appmanifest_${o.id}.acf`),
        `"AppState"\n{\n\t"appid"\t\t"${o.id}"\n\t"name"\t\t"${o.ad}"\n\t"installdir"\t\t"${o.klasor}"\n}\n`,
      );
    }
  }
  return k;
}

describe("VDF okuyucu", () => {
  it("iç içe anahtar-değerleri ve kaçışlı ters eğik çizgiyi okur", () => {
    const v = vdfOku('"a"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"\n\t}\n}\n');
    expect(v).toEqual({ a: { "0": { path: "C:\\Program Files (x86)\\Steam" } } });
  });
  it("bozuk dosyada hata fırlatmaz", () => {
    expect(() => vdfOku('"a"\n{\n\t"b"')).not.toThrow();
  });
});

describe("Steam kütüphaneleri", () => {
  it("ikinciKutuphaneBulunur", () => {
    const steam = kutuphane("Steam", []);
    const ikinci = kutuphane("SteamLibrary", []);
    const kac = (y: string) => y.replaceAll("\\", "\\\\");
    writeFileSync(
      join(steam, "steamapps", "libraryfolders.vdf"),
      `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${kac(steam)}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${kac(ikinci)}"\n\t}\n}\n`,
    );
    expect(kutuphaneleriOku(steam)).toEqual([steam, ikinci]);
  });

  it("vdf yoksa yalnızca Steam klasörünü döndürür", () => {
    const steam = kutuphane("Steam", []);
    expect(kutuphaneleriOku(steam)).toEqual([steam]);
  });
});

describe("oyun taraması", () => {
  it("oyunları durumlarıyla bulur; manifestsiz klasörleri ve araçları ayırır", () => {
    const a = kutuphane("A", [
      { id: 286690, ad: "Metro 2033 Redux", klasor: "Metro 2033 Redux" },
      { id: 730, ad: "Counter-Strike 2", klasor: "Counter-Strike Global Offensive" },
      { id: 397900, ad: "Business Tour", klasor: "Business Tour" },
      { id: 999, ad: "Kaldırılmış Oyun", klasor: "Kaldirilmis", kurulu: false },
      { id: 228980, ad: "Steamworks Common Redistributables", klasor: "Steamworks Shared" },
      { ad: "FiveM", klasor: "FiveM" },
      { ad: "GodOfWar", klasor: "GodOfWar" },
      { ad: "Gercek Oyun", klasor: "Gercek Oyun" },
    ]);
    // Steam'de kaydı olmayan ama gerçekten kurulu bir oyun: exe + çok dosya + steam_appid.txt.
    const gercek = join(a, "steamapps", "common", "Gercek Oyun");
    mkdirSync(join(gercek, "veri"), { recursive: true });
    writeFileSync(join(gercek, "oyun.exe"), "");
    writeFileSync(join(gercek, "steam_appid.txt"), "12345\n");
    for (let i = 0; i < 40; i++) writeFileSync(join(gercek, "veri", `d${i}.pak`), "");
    // Kaldırılmış oyunlardan kalan artıklar: exe yok / birkaç dosya.
    writeFileSync(join(a, "steamapps", "common", "GodOfWar", "ayarlar.ini"), "");
    const o = oyunlariTara([a]);
    const durum = Object.fromEntries(o.map((x) => [x.ad, x.durum]));
    expect(durum).toEqual({
      "Metro 2033 Redux": "destekleniyor",
      "Counter-Strike 2": "hile-korumali",
      "Business Tour": "desteklenmiyor",
      "Gercek Oyun": "desteklenmiyor",
    });
    expect(o.find((x) => x.ad === "Gercek Oyun")!.appId).toBe(12345);
    const metro = o.find((x) => x.appId === 286690)!;
    expect(metro.klasor).toBe(join(a, "steamapps", "common", "Metro 2033 Redux"));
    expect(metro.tanim?.kimlik).toBe("metro2033redux");
    expect(o[0]!.durum).toBe("destekleniyor"); // desteklenenler önce
  });
});

describe("oyun görselleri (Steam yerel önbelleği)", () => {
  it("yeni düzeni (alt klasörlü) ve eski düzeni bulur", () => {
    const steam = join(kok, "Steam");
    const yeni = join(steam, "appcache", "librarycache", "286690");
    mkdirSync(join(yeni, "aaa"), { recursive: true });
    mkdirSync(join(yeni, "bbb"), { recursive: true });
    writeFileSync(join(yeni, "aaa", "library_capsule.jpg"), "x");
    writeFileSync(join(yeni, "bbb", "logo.png"), "x");
    writeFileSync(join(steam, "appcache", "librarycache", "730_library_hero.jpg"), "x");
    expect(gorselleriBul(steam, 286690)).toEqual({ kapak: join(yeni, "aaa", "library_capsule.jpg"), logo: join(yeni, "bbb", "logo.png") });
    expect(gorselleriBul(steam, 730)).toEqual({ afis: join(steam, "appcache", "librarycache", "730_library_hero.jpg") });
    expect(gorselleriBul(steam, 5)).toEqual({});
  });
});

describe("artık klasörler", () => {
  it("yalnızca adı desteklenen oyunla aynı olan, dosyaları olmayan klasör listelenmez", () => {
    const a = kutuphane("Artik", [{ ad: "Metro 2033 Redux", klasor: "Metro 2033 Redux" }]);
    writeFileSync(join(a, "steamapps", "common", "Metro 2033 Redux", "ayarlar.cfg"), "");
    expect(oyunlariTara([a])).toEqual([]);
  });
});
