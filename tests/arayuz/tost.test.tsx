// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CIKIS_MS, Tost, tostSuresi } from "../../uygulama/arayuz/bilesenler/Tost.js";
import { guncellemeHatasiMetni } from "../../uygulama/arayuz/sayfalar/Hakkinda.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("bildirimler (tost)", () => {
  it("kısa başarı mesajı ~3 sn, hata daha uzun kalır; uzun metin biraz daha uzun; en fazla 9 sn", () => {
    expect(tostSuresi({ tur: "basari", metin: "Yeni oyun bulunamadı; liste güncel." })).toBeLessThan(3500);
    expect(tostSuresi({ tur: "tehlike", metin: "Dosya kullanımda." })).toBeGreaterThan(4500);
    expect(tostSuresi({ tur: "bilgi", metin: "x".repeat(1000) })).toBe(9000);
  });

  it("süre dolunca yumuşak çıkış sınıfı alır, sonra kaldırılır", () => {
    const bitti = vi.fn();
    const m = { tur: "basari" as const, metin: "Türkçe kuruldu." };
    render(<Tost mesaj={m} onBitti={bitti} />);
    const t = screen.getByText("Türkçe kuruldu.").closest(".tost")!;
    act(() => vi.advanceTimersByTime(tostSuresi(m) + 10));
    expect(t.className).toContain("cikiyor");
    expect(bitti).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CIKIS_MS + 10));
    expect(bitti).toHaveBeenCalled();
  });

  it("fare üzerindeyken kaybolmaz; kapatma düğmesiyle hemen kapanır", () => {
    const bitti = vi.fn();
    const m = { tur: "bilgi" as const, metin: "Liste güncel." };
    render(<Tost mesaj={m} onBitti={bitti} />);
    const t = screen.getByText("Liste güncel.").closest(".tost")!;
    fireEvent.mouseEnter(t);
    act(() => vi.advanceTimersByTime(20000));
    expect(t.className).not.toContain("cikiyor");
    fireEvent.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    expect(t.className).toContain("cikiyor");
    act(() => vi.advanceTimersByTime(CIKIS_MS + 10));
    expect(bitti).toHaveBeenCalled();
  });

  it("güncelleme sunucusunda sürüm yokken 'internet' denmez", () => {
    expect(guncellemeHatasiMetni("yayin-yok")).toMatch(/Henüz yayımlanmış yeni bir sürüm yok/);
    expect(guncellemeHatasiMetni("yayin-yok")).not.toMatch(/İnternet/);
    expect(guncellemeHatasiMetni("internet")).toMatch(/İnternete bağlanılamadı/);
  });
});
