import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hileKorumaliMi } from "../../src/oyunlar/hile-korumali.js";
import { METRO_2033_REDUX } from "../../src/oyunlar/metro2033redux.js";
import { METRO_EXODUS, METRO_EXODUS_NORMAL } from "../../src/oyunlar/metroexodus.js";
import { OYUNLAR, depoKlasoru, katmanSirala, paketKimligi, tanimBul, uygulamaKlasoru, yedekKlasoru } from "../../src/oyunlar/tanim.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../yardimci.js";

describe("oyun tanımları", () => {
  it("Metro 2033 Redux tanımı", () => {
    expect(METRO_2033_REDUX).toMatchObject({
      kimlik: "metro2033redux",
      ad: "Metro 2033 Redux",
      steamAppId: 286690,
      klasorAdi: "Metro 2033 Redux",
      motor: "4a",
      surecAdi: "metro.exe",
    });
    expect(OYUNLAR).toContain(METRO_2033_REDUX);
    expect(tanimBul(286690, "x")).toBe(METRO_2033_REDUX);
    expect(tanimBul(undefined, "Metro 2033 Redux")).toBe(METRO_2033_REDUX);
    expect(tanimBul(730, "Counter-Strike Global Offensive")).toBeUndefined();
  });

  it("Metro Exodus Enhanced Edition tanımı", () => {
    expect(METRO_EXODUS).toMatchObject({ kimlik: "metroexodus", ad: "Metro Exodus Enhanced Edition", steamAppId: 1449560, surecAdi: "MetroExodus.exe" });
    expect(OYUNLAR).toContain(METRO_EXODUS);
    expect(tanimBul(1449560, "x")).toBe(METRO_EXODUS);
    expect(tanimBul(undefined, "Metro Exodus Enhanced Edition")).toBe(METRO_EXODUS);
  });

  it("Metro Exodus normal sürüm (412020): ayrı yedek, EE ile ortak çeviri paketi ve deposu", () => {
    expect(METRO_EXODUS_NORMAL).toMatchObject({ kimlik: "metroexodus-normal", ad: "Metro Exodus", steamAppId: 412020, klasorAdi: "Metro Exodus" });
    expect(OYUNLAR).toContain(METRO_EXODUS_NORMAL);
    expect(tanimBul(412020, "x")).toBe(METRO_EXODUS_NORMAL);
    expect(tanimBul(undefined, "Metro Exodus")).toBe(METRO_EXODUS_NORMAL);
    expect(paketKimligi(METRO_EXODUS_NORMAL)).toBe("metroexodus");
    expect(depoKlasoru(METRO_EXODUS_NORMAL)).toBe(depoKlasoru(METRO_EXODUS));
    expect(yedekKlasoru(METRO_EXODUS_NORMAL)).not.toBe(yedekKlasoru(METRO_EXODUS));
    const desen = METRO_EXODUS_NORMAL.katmanDeseni!;
    const adlar = ["patch_04.vfx", "content.vfx", "patch_01_shared.vfx", "patch.vfx0", "patch_00.vfx", "patch_01.vfx", "patch_05.vfx", "patch_04.vfs0"];
    expect(katmanSirala(adlar.filter((a) => desen.test(a)))).toEqual(
      ["patch_00.vfx", "patch_01.vfx", "patch_01_shared.vfx", "patch_04.vfx", "patch_05.vfx"],
    );
  });

  it("hile korumalı oyunları tanır", () => {
    expect(hileKorumaliMi(730, "Counter-Strike Global Offensive")).toBe(true);
    expect(hileKorumaliMi(undefined, "FiveM")).toBe(true);
    expect(hileKorumaliMi(undefined, "Escape from Tarkov")).toBe(true);
    expect(hileKorumaliMi(1422450, "Deadlock")).toBe(true);
    expect(hileKorumaliMi(286690, "Metro 2033 Redux")).toBe(false);
    // Manifesti olmayan klasörler (gerçek bir kullanıcı kütüphanesinde görüldü)
    for (const k of ["Deadlock", "Hunt Showdown 1896", "csgo legacy", "Rust", "PUBG", "Apex Legends", "Call of Duty"]) {
      expect(hileKorumaliMi(undefined, k), k).toBe(true);
    }
    expect(hileKorumaliMi(undefined, "Rusty Lake")).toBe(false);
    expect(hileKorumaliMi(undefined, "Risk of Rain 2")).toBe(false);
  });

  it("uygulama klasörleri APPDATA altında", () => {
    const k = uygulamaKlasoru();
    expect(k.endsWith("turkcesi-var")).toBe(true);
    expect(yedekKlasoru(METRO_2033_REDUX)).toBe(join(k, "yedekler", "metro2033redux"));
    expect(depoKlasoru(METRO_2033_REDUX)).toBe(join(k, "ceviriler", "metro2033redux"));
  });
});

describe.skipIf(metroYok)("Metro tanımı (gerçek oyun)", () => {
  it("kaynak satırları ve kullanılabilir karakterleri verir", () => {
    const k = METRO_2033_REDUX.kaynak(METRO_DIR, METRO_VFX);
    expect(k.satirlar.length).toBe(21442);
    expect(k.kullanilabilir.has("ğ")).toBe(true);
    expect(k.kullanilabilir.has("\u0001")).toBe(false);
  });
});
