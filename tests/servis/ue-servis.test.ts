// Unreal oyunu (Mafia: The Old Country): hazır paketle kurulum, durum ve kaldırma. Sahte oyun klasörüyle.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { locresOku } from "../../src/motorlar/ue/locres.js";
import { pakOku } from "../../src/motorlar/ue/pak.js";
import { MAFIA_THE_OLD_COUNTRY as M } from "../../src/oyunlar/mafiatheoldcountry.js";
import { Servis } from "../../src/servis/servis.js";

let kok: string, oyun: string, uyg: string, paketler: string, servis: Servis;
const OYUN_PAKI = "MafiaTheOldCountry/Content/Paks/pakchunk0-Windows.pak";
const sessiz = () => {};
const paketYaz = () =>
  writeFileSync(
    join(paketler, "mafiatheoldcountry.tr.json"),
    JSON.stringify({
      bicim: 1, oyun: "mafiatheoldcountry", dil: "tr", oyunSurumu: "x", model: "", tarih: "2026-11-18T00:00:00.000Z", cevirenler: [],
      satirlar: {
        "ST_NeroUI_Texts::MainMenu_Action_NewGame": { tr: "YENİ OYUN", kaynakOzeti: "o1", ue: [1, 2, 3] },
        "ST_NeroUI_Texts::Action_QuitGame": { tr: "OYUNDAN ÇIK", kaynakOzeti: "o2", ue: [1, 4, 5] },
      },
    }),
  );

beforeEach(() => {
  kok = mkdtempSync(join(tmpdir(), "tv-ue-"));
  oyun = join(kok, "Mafia The Old Country");
  uyg = join(kok, "uyg");
  paketler = join(kok, "paketler");
  mkdirSync(join(oyun, "MafiaTheOldCountry", "Binaries", "Win64"), { recursive: true });
  mkdirSync(join(oyun, "MafiaTheOldCountry", "Content", "Paks"), { recursive: true });
  mkdirSync(paketler);
  writeFileSync(join(oyun, "MafiaTheOldCountry", "Binaries", "Win64", "MafiaTheOldCountry.exe"), "");
  writeFileSync(join(oyun, OYUN_PAKI), "oyunun kendi paketi v1");
  servis = new Servis({ uygulamaKlasoru: uyg, paketKlasoru: paketler });
});
afterEach(() => rmSync(kok, { recursive: true, force: true }));

describe("Unreal oyunu servisi", () => {
  it("durum: paketteki satır sayısı, yama yok", () => {
    paketYaz();
    const d = servis.oyunDurumu(M, oyun);
    expect(d.yama).toBe("yok");
    expect(d.ceviri).toEqual({ toplam: 2, cevrili: 2, sorunlu: 0, uygulanabilir: 2 });
  });

  it("Türkçe yap: yalnızca bizim pak eklenir, içinde iki satır; durum kurulu", async () => {
    paketYaz();
    await servis.turkceYap(M, oyun, sessiz);
    const yol = join(oyun, M.pakYolu);
    expect(existsSync(yol)).toBe(true);
    const g = locresOku(pakOku(readFileSync(yol)).dosyalar[0]!.veri);
    expect(g.map((x) => x.metin).sort()).toEqual(["OYUNDAN ÇIK", "YENİ OYUN"]);
    expect(readFileSync(join(oyun, OYUN_PAKI), "utf8")).toBe("oyunun kendi paketi v1");
    expect(servis.oyunDurumu(M, oyun).yama).toBe("kurulu");
  });

  it("oyun güncellendikten sonra kaldır: bizim pak silinir, oyunun yeni dosyası aynen kalır", async () => {
    paketYaz();
    await servis.turkceYap(M, oyun, sessiz);
    writeFileSync(join(oyun, OYUN_PAKI), "oyunun kendi paketi v2");
    await servis.kaldir(M, oyun);
    expect(existsSync(join(oyun, M.pakYolu))).toBe(false);
    expect(readFileSync(join(oyun, OYUN_PAKI), "utf8")).toBe("oyunun kendi paketi v2");
    expect(servis.oyunDurumu(M, oyun).yama).toBe("yok");
  });

  it("paket yoksa Türkçe yap hata verir ve oyun klasörüne bir şey yazmaz", async () => {
    await expect(servis.turkceYap(M, oyun, sessiz)).rejects.toThrow("Bu oyun için Türkçe çeviri bulunamadı");
    expect(readdirSync(join(oyun, "MafiaTheOldCountry", "Content", "Paks"))).toEqual(["pakchunk0-Windows.pak"]);
    expect(servis.oyunDurumu(M, oyun).ceviri.toplam).toBe(0);
  });
});
