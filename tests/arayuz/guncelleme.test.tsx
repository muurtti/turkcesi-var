// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuncellemeUyarisi } from "../../uygulama/arayuz/bilesenler/GuncellemeUyarisi.js";

afterEach(cleanup);

describe("güncelleme uyarısı", () => {
  it("güncelleme yoksa hiçbir şey göstermez", () => {
    const { container } = render(<GuncellemeUyarisi g={{ durum: "guncel" }} kur={vi.fn()} indir={vi.fn()} />);
    expect(container.textContent).toBe("");
  });

  it("yeni sürüm bulununca pencere açılır ama indirme kullanıcı 'Şimdi indir' deyince başlar", () => {
    const indir = vi.fn();
    render(<GuncellemeUyarisi g={{ durum: "var", surum: "0.1.1" }} kur={vi.fn()} indir={indir} />);
    expect(screen.getByRole("alertdialog", { name: "Güncelleme var" })).toBeTruthy();
    expect(screen.getByText("0.1.1")).toBeTruthy();
    expect(indir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Şimdi indir/ }));
    expect(indir).toHaveBeenCalledTimes(1);
  });

  it("indirirken ilerleme görünür; inince 'Yeniden başlat ve güncelle' çalışır", () => {
    const kur = vi.fn();
    const { rerender } = render(<GuncellemeUyarisi g={{ durum: "indiriliyor", yuzde: 40, surum: "0.1.1" }} kur={kur} indir={vi.fn()} />);
    expect(screen.getByText(/%40/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Yeniden başlat ve güncelle/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<GuncellemeUyarisi g={{ durum: "hazir", surum: "0.1.1" }} kur={kur} indir={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Yeniden başlat ve güncelle/ }));
    expect(kur).toHaveBeenCalled();
  });

  it("'Sonra' denince HİÇBİR ŞEY İNMEZ; üstteki şeritte elle 'İndir' düğmesi kalır", async () => {
    const indir = vi.fn();
    render(<GuncellemeUyarisi g={{ durum: "var", surum: "0.1.1" }} kur={vi.fn()} indir={indir} />);
    fireEvent.click(screen.getByRole("button", { name: "Sonra" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(indir).not.toHaveBeenCalled();
    expect(screen.getByText("Güncelleme var (0.1.1).")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /İndir/ }));
    expect(indir).toHaveBeenCalledTimes(1);
  });

  it("indirme bittiyse şeritte 'Yeniden başlat ve güncelle' çıkar", async () => {
    const kur = vi.fn();
    render(<GuncellemeUyarisi g={{ durum: "hazir", surum: "0.1.1" }} kur={kur} indir={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sonra" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Yeniden başlat ve güncelle/ }));
    expect(kur).toHaveBeenCalled();
  });
});
