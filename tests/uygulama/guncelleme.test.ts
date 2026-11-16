import { beforeEach, describe, expect, it, vi } from "vitest";

// electron-updater'ın yerine olayları elle tetikleyebildiğimiz sahte bir güncelleyici.
const sahte = vi.hoisted(() => {
  const dinleyiciler = new Map<string, (a?: unknown) => void>();
  return {
    dinleyiciler,
    autoUpdater: {
      autoDownload: true,
      autoInstallOnAppQuit: false,
      setFeedURL: vi.fn(),
      on: vi.fn((olay: string, f: (a?: unknown) => void) => dinleyiciler.set(olay, f)),
      checkForUpdates: vi.fn(() => Promise.resolve()),
      downloadUpdate: vi.fn(() => Promise.resolve([])),
      quitAndInstall: vi.fn(),
    },
  };
});
vi.mock("electron-updater", () => ({ default: { autoUpdater: sahte.autoUpdater } }));

import { guncellemeyiBaslat } from "../../uygulama/ana/guncelleme.js";

const tetikle = (olay: string, a?: unknown) => sahte.dinleyiciler.get(olay)!(a);

describe("uygulama güncellemesi (ana süreç)", () => {
  beforeEach(() => {
    sahte.dinleyiciler.clear();
    vi.clearAllMocks();
  });

  it("yeni sürüm bulununca kendiliğinden İNDİRMEZ; yalnızca 'var' bildirir", () => {
    const bildir = vi.fn();
    const g = guncellemeyiBaslat(true, bildir);
    expect(sahte.autoUpdater.autoDownload).toBe(false);
    tetikle("update-available", { version: "0.5.0" });
    expect(g.durum()).toEqual({ durum: "var", surum: "0.5.0" });
    expect(sahte.autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it("indirme yalnızca indir() çağrılınca başlar; bitince 'hazir' olur", async () => {
    const g = guncellemeyiBaslat(true, vi.fn());
    tetikle("update-available", { version: "0.5.0" });
    await g.indir();
    expect(sahte.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(g.durum()).toEqual({ durum: "indiriliyor", yuzde: 0, surum: "0.5.0" });
    tetikle("download-progress", { percent: 41.6 });
    expect(g.durum()).toEqual({ durum: "indiriliyor", yuzde: 42, surum: "0.5.0" });
    tetikle("update-downloaded", { version: "0.5.0" });
    expect(g.durum()).toEqual({ durum: "hazir", surum: "0.5.0" });
  });

  it("güncelleme yokken indir() hiçbir şey yapmaz", async () => {
    const g = guncellemeyiBaslat(true, vi.fn());
    tetikle("update-not-available");
    await g.indir();
    expect(sahte.autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it("indirme hata verirse kullanıcı yeniden deneyebilsin diye 'var' durumuna döner", async () => {
    sahte.autoUpdater.downloadUpdate.mockRejectedValueOnce(new Error("net::ERR_INTERNET_DISCONNECTED"));
    const g = guncellemeyiBaslat(true, vi.fn());
    tetikle("update-available", { version: "0.5.0" });
    await expect(g.indir()).rejects.toThrow();
    expect(g.durum()).toEqual({ durum: "var", surum: "0.5.0" });
  });

  it("'var' iken arka plandaki yeniden denetim durumu 'denetleniyor'a çevirmez (şerit kaybolmaz)", () => {
    const g = guncellemeyiBaslat(true, vi.fn());
    tetikle("update-available", { version: "0.5.0" });
    tetikle("checking-for-update");
    expect(g.durum().durum).toBe("var");
  });
});
