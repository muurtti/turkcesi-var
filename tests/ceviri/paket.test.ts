import { describe, expect, it } from "vitest";
import { bosDepo } from "../../src/ceviri/depo.js";
import { paketOlustur, type UeKimligi } from "../../src/ceviri/paket.js";

function depo() {
  const d = bosDepo("mafiatheoldcountry", "");
  d.satirlar["ST_A::k1"] = { tr: "Bir", kaynakOzeti: "o1", kaynak: "model", sorunlar: [] };
  d.satirlar["ST_A::k2"] = { tr: "İki", kaynakOzeti: "o2", kaynak: "model", sorunlar: [] };
  return d;
}

describe("çeviri paketi: Unreal kimliği", () => {
  it("ue haritası verilince yalnızca kimliği bilinen satırlar girer ve ue alanı yazılır", () => {
    const ue = new Map<string, UeKimligi>([["ST_A::k1", { adAlaniHash: 1, anahtarHash: 2, kaynakHash: 3 }]]);
    const p = paketOlustur(depo(), "s", ["turkcesivar"], ue);
    expect(p.satirlar["ST_A::k1"]).toEqual({ tr: "Bir", kaynakOzeti: "o1", ue: [1, 2, 3] });
    expect(p.satirlar["ST_A::k2"]).toBeUndefined();
  });

  it("ue verilmezse çıktı eski biçimdedir (ue alanı yok)", () => {
    const p = paketOlustur(depo(), "s", ["turkcesivar"]);
    expect(p.satirlar["ST_A::k2"]).toEqual({ tr: "İki", kaynakOzeti: "o2" });
    expect("ue" in p.satirlar["ST_A::k1"]!).toBe(false);
  });
});
