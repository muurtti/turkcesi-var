import { describe, expect, it } from "vitest";
import { turkceHata } from "../../uygulama/arayuz/hata.js";

describe("hataları Türkçeye çevirme", () => {
  it("dosya hatalarını Türkçeye çevirir", () => {
    expect(turkceHata(new Error("EBUSY: resource busy or locked, rename 'content.vfx'"))).toBe("Dosya kullanımda; oyun açık olabilir. Oyunu kapatıp tekrar deneyin.");
    expect(turkceHata(new Error("EACCES: permission denied, open 'content.vfx'"))).toBe("Dosya kullanımda; oyun açık olabilir. Oyunu kapatıp tekrar deneyin.");
    expect(turkceHata(new Error("ENOSPC: no space left on device, write"))).toBe("Diskte yer kalmamış. Biraz yer açıp tekrar deneyin.");
  });

  it("Electron'un 'Error invoking remote method' önekini atar, Türkçe mesajları aynen bırakır", () => {
    expect(turkceHata(new Error("Error invoking remote method 'tv:cagir': Error: Oyun şu an açık. Lütfen önce oyunu kapatın."))).toBe(
      "Oyun şu an açık. Lütfen önce oyunu kapatın.",
    );
    expect(turkceHata("düz metin")).toBe("düz metin");
  });
});
