import { describe, expect, it, vi } from "vitest";
import type { Ilerleme } from "../../src/servis/tipler.js";
import { calistirici } from "../../uygulama/arayuz/islem.js";

function kur() {
  let suren: Ilerleme | undefined;
  const bildir = vi.fn();
  const yenile = vi.fn().mockResolvedValue(undefined);
  const c = calistirici({ suren: () => suren, ayarla: (i) => (suren = i), bildir, yenile });
  return { c, bildir, yenile, suren: () => suren };
}

describe("işlem yürütücü", () => {
  it("sürerken ikinci işlemi başlatmaz; bitince durumu yeniler ve temizler", async () => {
    const { c, bildir, yenile, suren } = kur();
    let bitir!: (v: number) => void;
    const ilk = c("Uzun iş", () => new Promise<number>((r) => (bitir = r)), "bitti");
    expect(suren()?.metin).toBe("Uzun iş…");
    const ikinci = vi.fn();
    expect(await c("İkinci", ikinci)).toBeUndefined();
    expect(ikinci).not.toHaveBeenCalled();
    bitir(5);
    expect(await ilk).toBe(5);
    expect(suren()).toBeUndefined();
    expect(yenile).toHaveBeenCalledTimes(1);
    expect(bildir).toHaveBeenLastCalledWith({ tur: "basari", metin: "bitti" });
  });

  it("hatayı Türkçe bildirir; başarı metni fonksiyonu undefined dönerse bildirim yok", async () => {
    const { c, bildir } = kur();
    expect(await c("x", () => Promise.reject(new Error("EBUSY: resource busy")))).toBeUndefined();
    expect(bildir).toHaveBeenLastCalledWith({ tur: "tehlike", metin: "Dosya kullanımda; oyun açık olabilir. Oyunu kapatıp tekrar deneyin." });
    bildir.mockClear();
    await c("y", async () => "iptal", (r) => (r === "iptal" ? undefined : "tamam"));
    expect(bildir).not.toHaveBeenCalled();
  });
});
