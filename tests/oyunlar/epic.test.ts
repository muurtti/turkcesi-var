import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { epicOyunlariTara } from "../../src/oyunlar/epic.js";

let kok: string;
let manifestler: string;
beforeEach(() => {
  kok = mkdtempSync(join(tmpdir(), "tv-epic-"));
  manifestler = join(kok, "Manifests");
  mkdirSync(manifestler);
});
afterEach(() => rmSync(kok, { recursive: true, force: true }));

function manifest(ad: string, alanlar: Record<string, unknown>, kur = true) {
  const yer = String(alanlar.InstallLocation ?? join(kok, "Epic Games", ad));
  if (kur) mkdirSync(yer, { recursive: true });
  writeFileSync(
    join(manifestler, `${ad}.item`),
    JSON.stringify({ DisplayName: ad, InstallLocation: yer, AppName: ad, bIsApplication: true, bIsIncompleteInstall: false, AppCategories: ["public", "games", "applications"], ...alanlar }),
  );
  return yer;
}

describe("Epic Games taraması", () => {
  it("kurulu oyunları bulur; motor, yarım kurulum ve silinmiş klasörü atlar; Metro'yu dosyalarından tanır", () => {
    const metro = manifest("Metro 2033 Redux", { InstallLocation: join(kok, "Epic Games", "Metro2033Redux") });
    mkdirSync(join(metro, "2033"));
    writeFileSync(join(metro, "metro.exe"), "");
    writeFileSync(join(metro, "content.vfx"), "");
    manifest("Hades", {});
    manifest("Fortnite", {});
    manifest("Unreal Engine", { bIsApplication: false, AppCategories: ["engines/ue5", "engines"] });
    manifest("Yarim Oyun", { bIsIncompleteInstall: true });
    manifest("Silinmis Oyun", {}, false);
    writeFileSync(join(manifestler, "bozuk.item"), "{ bozuk");

    const o = epicOyunlariTara(manifestler);
    expect(Object.fromEntries(o.map((x) => [x.ad, x.durum]))).toEqual({
      "Metro 2033 Redux": "destekleniyor",
      Hades: "desteklenmiyor",
      Fortnite: "hile-korumali",
    });
    const m = o.find((x) => x.ad === "Metro 2033 Redux")!;
    expect(m).toMatchObject({ klasor: metro, platform: "epic", tanim: { kimlik: "metro2033redux" } });
    expect(o.every((x) => x.platform === "epic")).toBe(true);
  });

  it("biçimi bozuk kayıtlar (null, yanlış tipler) yalnızca kendileri atlanır; liste boşalmaz", () => {
    manifest("Hades", {});
    writeFileSync(join(manifestler, "bos.item"), "null");
    writeFileSync(join(manifestler, "dizi.item"), "[1,2]");
    writeFileSync(join(manifestler, "kategori.item"), JSON.stringify({ DisplayName: "X", InstallLocation: kok, AppCategories: "games", bIsApplication: true }));
    writeFileSync(join(manifestler, "ad.item"), JSON.stringify({ DisplayName: 42, InstallLocation: 7, bIsApplication: true }));
    // "X": kategori alanı tuhaf ama geri kalanı geçerli bir oyun kaydı, listelenir; null, dizi ve tipi bozuk ad/yer atlanır.
    expect(epicOyunlariTara(manifestler).map((o) => o.ad).sort()).toEqual(["Hades", "X"]);
  });

  it("Epic kurulu değilse boş döner", () => {
    expect(epicOyunlariTara(join(kok, "yok"))).toEqual([]);
  });
});
