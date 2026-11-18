import { describe, expect, it } from "vitest";
import { pakOku, pakYaz } from "../../../src/motorlar/ue/pak.js";

describe("Unreal pak v3", () => {
  it("tek dosyalık v3 pak: yapı ve içerik", () => {
    const veri = Buffer.from("deneme");
    const p = pakYaz("../../../MafiaTheOldCountry/Content/Localization/Game/en/", "Game.locres", veri);
    expect(p.length).toBe(53 + veri.length + (4 + 58) + 4 + (4 + 12) + 53 + 44);
    expect(p.readUInt32LE(p.length - 44)).toBe(0x5a6f12e1);
    expect(p.readUInt32LE(p.length - 40)).toBe(3);
    expect(pakOku(p)).toEqual({ mount: "../../../MafiaTheOldCountry/Content/Localization/Game/en/", dosyalar: [{ ad: "Game.locres", veri }] });
  });
});
