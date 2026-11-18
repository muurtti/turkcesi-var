// Oyuncu sürümü: hazır paketle kurulum ve oyun güncellenince kendiliğinden onarım. Sahte oyun klasörüyle.
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { kaynakOzeti, type CeviriSatiri } from "../../src/ceviri/satirlar.js";
import type { Tanim4A } from "../../src/oyunlar/tanim.js";
import { Servis } from "../../src/servis/servis.js";

const SATIRLAR: CeviriSatiri[] = [
  { anahtar: "$new_game", en: "NEW GAME", tur: "arayuz", grup: "$menu", sira: 0 },
  { anahtar: "$quit", en: "QUIT", tur: "arayuz", grup: "$menu", sira: 1 },
];

/** Sahte oyun: dizin = content.vfx; yama = dizinin sonuna çevirileri ekler + content28.vfs0. */
const SAHTE: Tanim4A = {
  kimlik: "sahteoyun",
  ad: "Sahte Oyun",
  steamAppId: 1,
  klasorAdi: "Sahte Oyun",
  motor: "4a",
  surecAdi: "sahte.exe",
  tanimaDosyalari: ["sahte.exe"],
  kaynak: () => ({ satirlar: SATIRLAR, kullanilabilir: new Set([..." ABCDEFGHIJKLMNOPQRSTUVWXYZİŞĞÇÖÜ"]) }),
  yamaHazirla: (_k, ceviriler, vfx) => ({
    degisecek: { "content.vfx": Buffer.concat([vfx, Buffer.from(`|${[...ceviriler.values()].join(",")}`)]) },
    eklenecek: { "content28.vfs0": Buffer.from("paket") },
    yamalananFontlar: [],
    atlananFontlar: [],
  }),
};

let kok: string;
let oyun: string;
let uyg: string;
let paketler: string;
let servis: Servis;
const sessiz = () => {};

beforeEach(() => {
  kok = mkdtempSync(join(tmpdir(), "tv-oyuncu-"));
  oyun = join(kok, "oyun");
  uyg = join(kok, "uyg");
  paketler = join(kok, "paketler");
  mkdirSync(oyun);
  mkdirSync(paketler);
  writeFileSync(join(oyun, "content.vfx"), "v1");
  writeFileSync(
    join(paketler, "sahteoyun.tr.json"),
    JSON.stringify({
      bicim: 1, oyun: "sahteoyun", dil: "tr", oyunSurumu: "x", model: "m", tarih: "2026-11-14T00:00:00.000Z", cevirenler: [],
      satirlar: { $new_game: { tr: "YENİ OYUN", kaynakOzeti: kaynakOzeti("NEW GAME") }, $quit: { tr: "ÇIKIŞ", kaynakOzeti: kaynakOzeti("QUIT") } },
    }),
  );
  servis = new Servis({ uygulamaKlasoru: uyg, oyunAcikMi: () => false, paketKlasoru: paketler });
});
afterEach(() => rmSync(kok, { recursive: true, force: true }));

describe("oyuncu sürümü", () => {
  it("hazır paketle kurar ve kaldırır; API ya da yerel depo gerekmez", async () => {
    const d = servis.oyunDurumu(SAHTE, oyun);
    expect(d).toMatchObject({ yama: "yok", ceviri: { uygulanabilir: 2 }, paket: { satir: 2 } });
    await servis.turkceYap(SAHTE, oyun, sessiz);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v1|YENİ OYUN,ÇIKIŞ");
    expect(servis.oyunDurumu(SAHTE, oyun).yama).toBe("kurulu");
    await servis.kaldir(SAHTE, oyun);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v1");
    expect(existsSync(join(oyun, "content28.vfs0"))).toBe(false);
  });

  it("uygulama yeni bir çeviri paketi getirince 'çeviri eski' der; yeniden kurulunca düzeltmeler oyuna gider", async () => {
    await servis.turkceYap(SAHTE, oyun, sessiz);
    expect(servis.oyunDurumu(SAHTE, oyun).ceviriEski).toBeUndefined();
    // 0.4.1: aynı oyun için daha yeni paket (bir satır düzeltildi)
    writeFileSync(
      join(paketler, "sahteoyun.tr.json"),
      JSON.stringify({
        bicim: 1, oyun: "sahteoyun", dil: "tr", oyunSurumu: "x", model: "m", tarih: "2026-11-15T00:00:00.000Z", cevirenler: [],
        satirlar: { $new_game: { tr: "YENİ OYUN", kaynakOzeti: kaynakOzeti("NEW GAME") }, $quit: { tr: "ÇIK", kaynakOzeti: kaynakOzeti("QUIT") } },
      }),
    );
    const yeni = new Servis({ uygulamaKlasoru: uyg, oyunAcikMi: () => false, paketKlasoru: paketler });
    expect(yeni.oyunDurumu(SAHTE, oyun)).toMatchObject({ yama: "kurulu", ceviriEski: true });
    await yeni.turkceYap(SAHTE, oyun, sessiz);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v1|YENİ OYUN,ÇIK");
    expect(yeni.oyunDurumu(SAHTE, oyun).ceviriEski).toBeUndefined();
    // Kaldırınca yine birebir orijinal
    await yeni.kaldir(SAHTE, oyun);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v1");
  });

  it("0.4.0 ile kurulmuş (paket notu olmayan) Türkçe de bir kez 'çeviri eski' sayılır", async () => {
    await servis.turkceYap(SAHTE, oyun, sessiz);
    const yedekler = join(uyg, "yedekler");
    for (const y of readdirSync(yedekler)) rmSync(join(yedekler, y, "kurulu-paket.json"), { force: true });
    expect(servis.oyunDurumu(SAHTE, oyun).ceviriEski).toBe(true);
  });

  it("Steam oyunu güncelleyince Türkçe yap eski yamayı temizler ve YENİ sürüme yeniden kurar", async () => {
    await servis.turkceYap(SAHTE, oyun, sessiz);
    writeFileSync(join(oyun, "content.vfx"), "v2"); // Steam güncellemesi
    expect(servis.oyunDurumu(SAHTE, oyun).yama).toBe("degismis");
    await servis.turkceYap(SAHTE, oyun, sessiz);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v2|YENİ OYUN,ÇIKIŞ"); // v1'den değil v2'den
    await servis.kaldir(SAHTE, oyun);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v2");
  });

  it("Steam güncellemesinden sonra Kaldır da çalışır (yalnızca yamanın artıkları silinir, Steam'in dosyasına dokunulmaz)", async () => {
    await servis.turkceYap(SAHTE, oyun, sessiz);
    writeFileSync(join(oyun, "content.vfx"), "v2");
    await servis.kaldir(SAHTE, oyun);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v2");
    expect(existsSync(join(oyun, "content28.vfs0"))).toBe(false);
    expect(servis.oyunDurumu(SAHTE, oyun).yama).toBe("yok");
  });

  it("yarım kalan kurulum (eklenen dosya yok) önce orijinale döndürülüp yeniden kurulur", async () => {
    await servis.turkceYap(SAHTE, oyun, sessiz);
    rmSync(join(oyun, "content28.vfs0"));
    expect(servis.oyunDurumu(SAHTE, oyun).yama).toBe("degismis");
    await servis.turkceYap(SAHTE, oyun, sessiz);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v1|YENİ OYUN,ÇIKIŞ");
    expect(servis.oyunDurumu(SAHTE, oyun).yama).toBe("kurulu");
  });

  it("bu bilgisayardaki elle düzeltme paketin önüne geçer", async () => {
    mkdirSync(join(uyg, "ceviriler", "sahteoyun"), { recursive: true });
    writeFileSync(
      join(uyg, "ceviriler", "sahteoyun", "depo.json"),
      JSON.stringify({ oyun: "sahteoyun", model: "m", sozluk: [], satirlar: { $quit: { tr: "OYUNDAN ÇIK", kaynakOzeti: kaynakOzeti("QUIT"), kaynak: "insan", sorunlar: [] } } }),
    );
    await servis.turkceYap(SAHTE, oyun, sessiz);
    expect(readFileSync(join(oyun, "content.vfx"), "utf8")).toBe("v1|YENİ OYUN,OYUNDAN ÇIK");
  });
});
