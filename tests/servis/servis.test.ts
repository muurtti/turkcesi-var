import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bosDepo, depoYaz, insanDuzeltmesi, modelCevirisiEkle } from "../../src/ceviri/depo.js";
import { METRO_2033_REDUX as METRO } from "../../src/oyunlar/metro2033redux.js";
import { uygula } from "../../src/ortak/yedek.js";
import { yamaDurumu, yedekKlasoruSec } from "../../src/ortak/yedek.js";
import { Servis } from "../../src/servis/servis.js";
import { servisIstemcisi } from "../../src/servis/is-parcacigi-istemci.js";
import { METRO_DIR, METRO_VFX, metroYok } from "../yardimci.js";

describe("yama durumu", () => {
  it("yok → kurulu → oyun değişmiş", async () => {
    const k = mkdtempSync(join(tmpdir(), "tv-ydurum-"));
    try {
      const oyun = join(k, "oyun"), yedek = join(k, "yedek");
      mkdirSync(oyun);
      writeFileSync(join(oyun, "content.vfx"), "orijinal");
      expect(yamaDurumu(oyun, yedek)).toBe("yok");
      await uygula(oyun, yedek, { "content.vfx": Buffer.from("yamalı") }, {});
      expect(yamaDurumu(oyun, yedek)).toBe("kurulu");
      writeFileSync(join(oyun, "content.vfx"), "steam güncellemesi");
      expect(yamaDurumu(oyun, yedek)).toBe("degismis");
    } finally {
      rmSync(k, { recursive: true, force: true });
    }
  });
});

describe.skipIf(metroYok)("servis (gerçek Metro dosyaları yalnızca okunur)", () => {
  let uyg: string;
  let servis: Servis;
  const ilk = () => {
    // Geçici uygulama klasöründe yedek yok → orijinal dizin olarak yedeklenmiş temiz dizini kullanması için
    // testte yedek klasörüne orijinali koyarız (oyun yamalı olsa bile kaynak temiz okunur).
    const yedek = yedekKlasoruSec(join(uyg, "yedekler", "metro2033redux"), METRO_DIR);
    mkdirSync(join(yedek, "orijinal"), { recursive: true });
    writeFileSync(join(yedek, "orijinal", "content.vfx"), METRO_VFX);
  };

  beforeAll(() => {
    uyg = mkdtempSync(join(tmpdir(), "tv-servis-"));
    ilk();
    const d = bosDepo("metro2033redux", "model");
    const { satirlar } = METRO.kaynak(METRO_DIR, METRO_VFX);
    const bul = (a: string) => satirlar.find((x) => x.anahtar === a)!;
    modelCevirisiEkle(d, bul("$new_game"), "YENİ OYUN", []);
    modelCevirisiEkle(d, bul("voices\\l00_intro\\int_001_khan_intro_1"), "Artyom! Uyan, Artyom! Benim, Khan!", [], "emin değil");
    insanDuzeltmesi(d, bul("$game_subtitles"), "ALTYAZILAR", []);
    depoYaz(join(uyg, "ceviriler", "metro2033redux"), d);
    servis = new Servis({ uygulamaKlasoru: uyg, oyunAcikMi: () => false });
  });
  afterAll(() => rmSync(uyg, { recursive: true, force: true }));

  it("oyun durumu: çeviri sayıları", () => {
    const o = servis.oyunDurumu(METRO, METRO_DIR);
    expect(o.tanim).toEqual({ kimlik: "metro2033redux", ad: "Metro 2033 Redux" });
    expect(o.ceviri).toMatchObject({ toplam: 21442, cevrili: 3 });
  });

  it("oyunAcikkenUygulanmaz", async () => {
    const acik = new Servis({ uygulamaKlasoru: uyg, oyunAcikMi: () => true });
    await expect(acik.turkceYap(METRO, METRO_DIR, () => {})).rejects.toThrow(/Oyun şu an açık/);
    await expect(acik.kaldir(METRO, METRO_DIR)).rejects.toThrow(/Oyun şu an açık/);
  });
});

describe("iş parçacığı (worker)", () => {
  it("yöntemleri çağırır, ilerleme olaylarını iletir, hataları Promise reddi yapar", async () => {
    const uyg = mkdtempSync(join(tmpdir(), "tv-worker-"));
    const istemci = servisIstemcisi({ uygulamaKlasoru: uyg, tsx: true });
    try {
      expect(await istemci.cagir("yankı", ["merhaba"])).toBe("merhaba");
      const olaylar: string[] = [];
      await istemci.cagir("ilerlemeDene", [3], (i) => olaylar.push(i.tur === "mesaj" ? i.metin : ""));
      expect(olaylar).toEqual(["1", "2", "3"]);
      await expect(istemci.cagir("oyunDurumu", ["boyle-bir-oyun-yok", "C:/yok"])).rejects.toThrow(/Bilinmeyen oyun/);
    } finally {
      await istemci.kapat();
      rmSync(uyg, { recursive: true, force: true });
    }
  });

  it("aynı oyunda ikinci kilitli işlem reddedilir, başka oyunda ve iş bitince çalışır", async () => {
    const uyg = mkdtempSync(join(tmpdir(), "tv-worker-"));
    const istemci = servisIstemcisi({ uygulamaKlasoru: uyg, tsx: true });
    try {
      const ilk = istemci.cagir("bekleDene", ["oyunA", 400]);
      await expect(istemci.cagir("bekleDene", ["oyunA", 1])).rejects.toThrow(/şu an .* sürüyor/);
      expect(await istemci.cagir("bekleDene", ["oyunB", 1])).toBe(true);
      expect(await ilk).toBe(true);
      expect(await istemci.cagir("bekleDene", ["oyunA", 1])).toBe(true);
    } finally {
      await istemci.kapat();
      rmSync(uyg, { recursive: true, force: true });
    }
  });

  it("iş parçacığı çökerse bekleyen çağrı reddedilir, sonraki çağrı yeni iş parçacığıyla çalışır", async () => {
    const uyg = mkdtempSync(join(tmpdir(), "tv-worker-"));
    const istemci = servisIstemcisi({ uygulamaKlasoru: uyg, tsx: true });
    try {
      await expect(istemci.cagir("cokDene", [])).rejects.toThrow(/beklenmedik biçimde durdu/);
      expect(await istemci.cagir("yankı", ["yine"])).toBe("yine");
    } finally {
      await istemci.kapat();
      rmSync(uyg, { recursive: true, force: true });
    }
  });
});
