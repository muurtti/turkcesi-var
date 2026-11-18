import { describe, expect, it } from "vitest";
import type { CeviriPaketi } from "../../../src/ceviri/paket.js";
import { locresOku } from "../../../src/motorlar/ue/locres.js";
import { pakOku } from "../../../src/motorlar/ue/pak.js";
import { uePaketCevirileri, ueYamaHazirla } from "../../../src/motorlar/ue/turkce-yama.js";

const T = {
  pakYolu: "MafiaTheOldCountry/Content/Paks/pakchunk0-Windows_TurkcesiVar_P.pak",
  mount: "../../../MafiaTheOldCountry/Content/Localization/Game/en/",
};

const ceviriler = () =>
  new Map<string, { tr: string; ue: [number, number, number] }>([
    ["ST_NeroUI_Texts::MainMenu_Action_NewGame", { tr: "YENİ OYUN", ue: [11, 12, 13] }],
    ["ST_Hints_Texts::Ipucu", { tr: "İpucu", ue: [21, 22, 23] }],
    ["ST_NeroUI_Texts::Action_QuitGame", { tr: "OYUNDAN ÇIK", ue: [11, 14, 15] }],
  ]);

describe("Unreal Türkçe yaması", () => {
  it("tek eklenecek pak üretir; içindeki tablo çevirileri ve hash'leri taşır", () => {
    const y = ueYamaHazirla(T, ceviriler());
    expect(y.degisecek).toEqual({});
    expect(Object.keys(y.eklenecek)).toEqual([T.pakYolu]);
    expect(y.satir).toBe(3);
    const p = pakOku(y.eklenecek[T.pakYolu]!);
    expect(p.mount).toBe(T.mount);
    expect(p.dosyalar.map((d) => d.ad)).toEqual(["Game.locres"]);
    const g = locresOku(p.dosyalar[0]!.veri);
    expect(g).toHaveLength(3);
    const yeni = g.find((x) => x.adAlani === "ST_NeroUI_Texts" && x.anahtar === "MainMenu_Action_NewGame")!;
    expect(yeni).toMatchObject({ metin: "YENİ OYUN", adAlaniHash: 11, anahtarHash: 12, kaynakHash: 13 });
  });

  it("aynı girdiyle bayt bayt aynı çıktı (sıra bağımsız)", () => {
    const a = ueYamaHazirla(T, ceviriler()).eklenecek[T.pakYolu]!;
    const ters = new Map([...ceviriler()].reverse());
    const b = ueYamaHazirla(T, ters).eklenecek[T.pakYolu]!;
    expect(a.equals(b)).toBe(true);
  });

  it("anahtar yalnızca ilk '::'den bölünür", () => {
    const y = ueYamaHazirla(T, new Map([["NS::a::b", { tr: "x", ue: [1, 2, 3] as [number, number, number] }]]));
    const g = locresOku(pakOku(y.eklenecek[T.pakYolu]!).dosyalar[0]!.veri);
    expect(g[0]).toMatchObject({ adAlani: "NS", anahtar: "a::b" });
  });

  it("uePaketCevirileri ue'siz ve boş satırları atlar", () => {
    const p: CeviriPaketi = {
      bicim: 1, oyun: "mafiatheoldcountry", dil: "tr", oyunSurumu: "", model: "", tarih: "", cevirenler: [],
      satirlar: {
        "A::1": { tr: "Bir", kaynakOzeti: "o", ue: [1, 2, 3] },
        "A::2": { tr: "  ", kaynakOzeti: "o", ue: [1, 4, 5] },
        "A::3": { tr: "Üç", kaynakOzeti: "o" },
      },
    };
    expect([...uePaketCevirileri(p)]).toEqual([["A::1", { tr: "Bir", ue: [1, 2, 3] }]]);
  });
});
