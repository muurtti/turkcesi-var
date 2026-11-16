// Uygulamanın kendini güncellemesi: açılışta ve açıkken birkaç saatte bir yeni sürümü denetler,
// bulunca arayüze "Güncelleme var" uyarısı gönderir. Kendiliğinden İNDİRMEZ: indirme yalnızca kullanıcı
// "İndir" deyince başlar; inince "Yeniden başlat"a basınca ya da uygulama kapanınca kurulur.

import electronUpdater from "electron-updater";
import { guncellemeHatasiNeden } from "../../src/ortak/guncelleme-hata.js";
import type { GuncellemeDurumu } from "../../src/servis/api.js";

/**
 * Sürümlerin yayımlandığı adres (içinde latest.yml ve kurulum dosyası olmalı). GitHub'a yüklenince:
 *   https://github.com/<kullanıcı>/turkcesi-var/releases/latest/download
 * Boşken otomatik güncelleme kapalıdır.
 */
export const GUNCELLEME_ADRESI = "https://github.com/turkcesivar/turkcesi-var/releases/latest/download";

const DENETLEME_ARALIGI_MS = 3 * 60 * 60 * 1000;
const { autoUpdater } = electronUpdater;

function hataDurumu(e: unknown): GuncellemeDurumu {
  const mesaj = e instanceof Error ? e.message : String(e);
  return { durum: "hata", mesaj: mesaj.split("\n")[0]!, neden: guncellemeHatasiNeden(mesaj) };
}

/** Yeni sürüm bulunmuş ya da iniyor/inmişse yeniden denetim bu durumu bozmamalı. */
const surumBulundu = (d: GuncellemeDurumu) => d.durum === "var" || d.durum === "indiriliyor" || d.durum === "hazir";

export function guncellemeyiBaslat(
  paketli: boolean,
  bildir: (d: GuncellemeDurumu) => void,
): { durum: () => GuncellemeDurumu; kur: () => void; indir: () => Promise<void>; denetle: () => Promise<GuncellemeDurumu> } {
  let son: GuncellemeDurumu = { durum: "kapali" };
  const ayarla = (d: GuncellemeDurumu) => {
    son = d;
    bildir(d);
  };
  const adres = GUNCELLEME_ADRESI;
  if (paketli && adres) {
    autoUpdater.setFeedURL({ provider: "generic", url: adres });
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => !surumBulundu(son) && ayarla({ durum: "denetleniyor" }));
    autoUpdater.on("update-not-available", () => ayarla({ durum: "guncel" }));
    autoUpdater.on("update-available", (b) => son.durum !== "indiriliyor" && son.durum !== "hazir" && ayarla({ durum: "var", surum: b.version }));
    autoUpdater.on("download-progress", (p) => son.durum === "indiriliyor" && ayarla({ ...son, yuzde: Math.round(p.percent) }));
    autoUpdater.on("update-downloaded", (b) => ayarla({ durum: "hazir", surum: b.version }));
    autoUpdater.on("error", (e) => !surumBulundu(son) && ayarla(hataDurumu(e)));
    // İnternet yoksa uygulama yine çalışır; hata yalnızca Hakkında'da görünür.
    const kendiliginden = () => {
      if (son.durum !== "indiriliyor" && son.durum !== "hazir") void autoUpdater.checkForUpdates().catch(() => {});
    };
    kendiliginden();
    setInterval(kendiliginden, DENETLEME_ARALIGI_MS).unref?.();
  }
  return {
    durum: () => son,
    /** "Güncellemeleri denetle" düğmesi: denetler ve sonucu (güncel / var / hata …) döndürür. */
    denetle: async () => {
      if (!(paketli && adres) || surumBulundu(son)) return son;
      try {
        await autoUpdater.checkForUpdates();
      } catch (e) {
        ayarla(hataDurumu(e));
      }
      return son;
    },
    /** "İndir" düğmesi: yalnızca yeni sürüm bulunmuşsa indirmeye başlar. Hata olursa yeniden denenebilir. */
    indir: async () => {
      if (son.durum !== "var") return;
      const surum = son.surum;
      ayarla({ durum: "indiriliyor", yuzde: 0, surum });
      try {
        await autoUpdater.downloadUpdate();
      } catch (e) {
        ayarla({ durum: "var", surum });
        throw e;
      }
    },
    kur: () => {
      if (son.durum === "hazir") autoUpdater.quitAndInstall(true, true);
    },
  };
}
