import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locresOku, locresYaz, type LocresGirdisi } from "../../../src/motorlar/ue/locres.js";
import { uygulamaKlasoru } from "../../../src/oyunlar/tanim.js";

const EN_LOCRES = join(uygulamaKlasoru(), "kaynaklar", "mafiatheoldcountry", "en-Game.locres");

describe("Unreal locres v3", () => {
  it("yazılan tablo okununca aynı girdileri verir (ASCII + Türkçe + boş + tekrar eden metin)", () => {
    const g: LocresGirdisi[] = [
      { adAlani: "ST_NeroUI_Texts", adAlaniHash: 0x11111111, anahtar: "MainMenu_Action_NewGame", anahtarHash: 0x22222222, kaynakHash: 0x33333333, metin: "YENİ OYUN" },
      { adAlani: "ST_NeroUI_Texts", adAlaniHash: 0x11111111, anahtar: "Action_QuitGame", anahtarHash: 0x44444444, kaynakHash: 0x55555555, metin: "OYUNDAN ÇIK" },
      { adAlani: "ST_Hints_Texts", adAlaniHash: 0x66666666, anahtar: "Bos", anahtarHash: 7, kaynakHash: 8, metin: "" },
      { adAlani: "ST_Hints_Texts", adAlaniHash: 0x66666666, anahtar: "Tekrar", anahtarHash: 9, kaynakHash: 10, metin: "YENİ OYUN" },
    ];
    const v = locresYaz(g);
    expect(v.subarray(0, 16).toString("hex")).toBe("0e147475674a03fc4a15909dc3377f1b");
    expect(v[16]).toBe(3);
    expect(locresOku(v)).toEqual(g);
  });

  it.skipIf(!existsSync(EN_LOCRES))("gerçek İngilizce tablo birebir geri yazılır", () => {
    const v = readFileSync(EN_LOCRES);
    expect(locresYaz(locresOku(v)).equals(v)).toBe(true);
    expect(locresOku(v)).toHaveLength(29182);
  });
});
