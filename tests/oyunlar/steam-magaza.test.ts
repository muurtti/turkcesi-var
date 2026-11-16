import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adNormal, steamKimligiAra } from "../../src/oyunlar/steam-magaza.js";

let k: string;
beforeEach(() => (k = mkdtempSync(join(tmpdir(), "tv-magaza-"))));
afterEach(() => rmSync(k, { recursive: true, force: true }));

const yanit = (items: { type: string; name: string; id: number }[]) =>
  vi.fn(async (_adres: URL | RequestInfo, _s?: RequestInit) => ({ ok: true, json: async () => ({ total: items.length, items }) }) as unknown as Response);

describe("Steam mağazasında ad ile oyun numarası", () => {
  it("adı birebir eşleşen oyunu seçer (Demo gibi benzerleri değil); sonucu saklar, ikinci kez sormaz", async () => {
    const getir = yanit([
      { type: "app", name: "Cat Quest II Demo", id: 1179900 },
      { type: "app", name: "Cat Quest II", id: 914710 },
    ]);
    expect(await steamKimligiAra("Cat Quest II", k, getir)).toBe(914710);
    expect(await steamKimligiAra("Cat Quest II", k, getir)).toBe(914710);
    expect(getir).toHaveBeenCalledTimes(1);
    expect(String(getir.mock.calls[0]![0])).toContain("term=Cat%20Quest%20II");
    expect(JSON.parse(readFileSync(join(k, "magaza-onbellek.json"), "utf8"))).toEqual({ "cat quest ii": 914710 });
  });

  it("™/® ve noktalama farklarını yok sayar; eşleşme yoksa undefined (ve bunu da hatırlar)", async () => {
    expect(adNormal("Metro 2033 Redux™")).toBe(adNormal("METRO 2033: Redux"));
    const getir = yanit([{ type: "app", name: "Başka Oyun", id: 1 }]);
    expect(await steamKimligiAra("Bilinmeyen Oyun", k, getir)).toBeUndefined();
    expect(await steamKimligiAra("Bilinmeyen Oyun", k, getir)).toBeUndefined();
    expect(getir).toHaveBeenCalledTimes(1);
  });

  it("internet yoksa hata fırlatmaz, sonucu saklamaz (sonra yeniden dener)", async () => {
    const getir = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    expect(await steamKimligiAra("Cat Quest II", k, getir as never)).toBeUndefined();
    expect(await steamKimligiAra("Cat Quest II", k, getir as never)).toBeUndefined();
    expect(getir).toHaveBeenCalledTimes(2);
  });
});

describe("aynı anda aramalar", () => {
  it("birbirinin sonucunu ezmez; ikisi de saklanır", async () => {
    const getir = vi.fn(async (adres: URL | RequestInfo) => {
      const ad = decodeURIComponent(String(adres).split("term=")[1]!.split("&")[0]!);
      return { ok: true, json: async () => ({ items: [{ type: "app", name: ad, id: ad.length }] }) } as unknown as Response;
    });
    await Promise.all([steamKimligiAra("Oyun Bir", k, getir), steamKimligiAra("Oyun İkinci", k, getir)]);
    const sakli = JSON.parse(readFileSync(join(k, "magaza-onbellek.json"), "utf8"));
    expect(Object.keys(sakli).sort()).toEqual(["oyun bir", "oyun ikinci"]);
  });
});
