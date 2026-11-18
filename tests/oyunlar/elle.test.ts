import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { elleKlasorleriOku, elleKlasorEkle, klasorTani, secimHatasi } from "../../src/oyunlar/elle.js";
import { OYUNLAR } from "../../src/oyunlar/tanim.js";

let k: string;
const metroYap = (yol: string, appId?: string) => {
  mkdirSync(join(yol, "2033"), { recursive: true });
  writeFileSync(join(yol, "metro.exe"), "");
  writeFileSync(join(yol, "content.vfx"), "");
  if (appId) writeFileSync(join(yol, "steam_appid.txt"), appId);
};
const mafiaYap = (yol: string, eksik?: string) => {
  for (const d of ["MafiaTheOldCountry/Binaries/Win64/MafiaTheOldCountry.exe", "MafiaTheOldCountry/Content/Paks/pakchunk0-Windows.pak"]) {
    if (d === eksik) continue;
    mkdirSync(join(yol, d, ".."), { recursive: true });
    writeFileSync(join(yol, d), "");
  }
};
beforeEach(() => (k = mkdtempSync(join(tmpdir(), "tv-elle-"))));
afterEach(() => rmSync(k, { recursive: true, force: true }));

describe("elle klasör seçimi", () => {
  it("doğru klasörü tanır", () => {
    metroYap(join(k, "Metro 2033 Redux"), "286690");
    expect(klasorTani(join(k, "Metro 2033 Redux"))).toMatchObject({ tanim: { kimlik: "metro2033redux" }, klasor: join(k, "Metro 2033 Redux") });
  });

  it("Mafia: The Old Country klasörünü alt klasördeki dosyalarından tanır; biri eksikse tanımaz", () => {
    mafiaYap(join(k, "Mafia The Old Country"));
    expect(klasorTani(join(k, "Mafia The Old Country"))).toMatchObject({ tanim: { kimlik: "mafiatheoldcountry" } });
    mafiaYap(join(k, "Yarim"), "MafiaTheOldCountry/Content/Paks/pakchunk0-Windows.pak");
    expect(klasorTani(join(k, "Yarim"))).toBeUndefined();
  });

  it("üst klasör (ör. Steam kütüphanesi) seçilirse içinde arar", () => {
    const yol = join(k, "SteamLibrary", "steamapps", "common", "Metro 2033 Redux");
    metroYap(yol);
    expect(klasorTani(join(k, "SteamLibrary"))?.klasor).toBe(yol);
    expect(klasorTani(join(k, "SteamLibrary", "steamapps", "common"))?.klasor).toBe(yol);
  });

  it("başka bir oyunu (aynı dosya adları, farklı Steam kimliği) ya da boş klasörü kabul etmez", () => {
    metroYap(join(k, "Last Light"), "287390");
    expect(klasorTani(join(k, "Last Light"))).toBeUndefined();
    mkdirSync(join(k, "bos"));
    expect(klasorTani(join(k, "bos"))).toBeUndefined();
  });

  it("hata mesajı: genel seçimde Metro sanmaz; oyun kartından seçimde neyin aranacağını söyler", () => {
    const genel = secimHatasi(join(k, "Cyberpunk 2077"));
    expect(genel).toContain('"Cyberpunk 2077" klasöründe Türkçesi hazır bir oyun bulunamadı');
    expect(genel).toContain("Şu an Türkçesi hazır oyunlar: Metro 2033 Redux");
    expect(genel).not.toContain("metro.exe");
    const kart = secimHatasi(join(k, "Cyberpunk 2077"), OYUNLAR[0]);
    expect(kart).toContain('"Cyberpunk 2077" klasörü Metro 2033 Redux klasörü değil');
    expect(kart).toContain("metro.exe, content.vfx, 2033");
    expect(kart).toContain("…\\steamapps\\common\\Metro 2033 Redux");
    expect(kart).toContain("Steam dışından kurduysan");
  });

  it("Steam dışı kurulum (steam_appid.txt yok, farklı klasör adı) tanınır", () => {
    metroYap(join(k, "Oyunlarim", "M2033R"));
    expect(klasorTani(join(k, "Oyunlarim"))?.tanim.kimlik).toBe("metro2033redux");
  });

  it("Metro Exodus klasörü tanınır; Metro 2033 ile karışmaz; normal sürümün Steam kimliği reddedilir", () => {
    const ex = join(k, "Epic", "MetroExodusEnhanced");
    mkdirSync(ex, { recursive: true });
    writeFileSync(join(ex, "MetroExodus.exe"), "");
    writeFileSync(join(ex, "content.vfx"), "");
    metroYap(join(k, "Epic", "Metro2033Redux"));
    expect(klasorTani(ex)?.tanim.kimlik).toBe("metroexodus");
    expect(klasorTani(join(k, "Epic", "Metro2033Redux"))?.tanim.kimlik).toBe("metro2033redux");
    writeFileSync(join(ex, "steam_appid.txt"), "412020");
    expect(klasorTani(ex)).toBeUndefined(); // 412020 ama güncelleme dizini yok: ikisi de değil
  });

  it("Metro Exodus normal sürüm, patch_04.vfx'ten tanınır; EE ile karışmaz", () => {
    const n = join(k, "Steam", "Metro Exodus");
    mkdirSync(n, { recursive: true });
    for (const d of ["MetroExodus.exe", "content.vfx", "patch_04.vfx"]) writeFileSync(join(n, d), "");
    expect(klasorTani(n)?.tanim.kimlik).toBe("metroexodus-normal");
    writeFileSync(join(n, "steam_appid.txt"), "412020");
    expect(klasorTani(n)?.tanim.kimlik).toBe("metroexodus-normal");
    writeFileSync(join(n, "steam_appid.txt"), "1449560");
    expect(klasorTani(n)?.tanim.kimlik).toBe("metroexodus");
  });

  it("Last Light Redux, outro_good.ogv'den tanınır; Metro 2033 ile karışmaz", () => {
    const ll = join(k, "Oyunlar", "Metro Last Light Redux");
    mkdirSync(ll, { recursive: true });
    for (const d of ["metro.exe", "content.vfx", "outro_good.ogv"]) writeFileSync(join(ll, d), "");
    metroYap(join(k, "Oyunlar", "Metro 2033 Redux"));
    expect(klasorTani(ll)?.tanim.kimlik).toBe("metrolastlightredux");
    expect(klasorTani(join(k, "Oyunlar", "Metro 2033 Redux"))?.tanim.kimlik).toBe("metro2033redux");
    writeFileSync(join(ll, "steam_appid.txt"), "287390");
    expect(klasorTani(ll)?.tanim.kimlik).toBe("metrolastlightredux");
    writeFileSync(join(ll, "steam_appid.txt"), "286690");
    expect(klasorTani(ll)).toBeUndefined();
  });

  it("seçilen klasörler kaydedilir, aynısı iki kez eklenmez", () => {
    const uyg = join(k, "uyg");
    elleKlasorEkle(uyg, { kimlik: "metro2033redux", klasor: "D:/Oyunlar/Metro" });
    elleKlasorEkle(uyg, { kimlik: "metro2033redux", klasor: "D:/Oyunlar/Metro" });
    expect(elleKlasorleriOku(uyg)).toEqual([{ kimlik: "metro2033redux", klasor: "D:/Oyunlar/Metro" }]);
  });
});
