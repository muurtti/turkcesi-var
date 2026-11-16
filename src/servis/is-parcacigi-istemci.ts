// Ana süreç tarafı: arka plan iş parçacığını başlatır ve yöntemlerini Promise olarak çağırır.

import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { Ilerleme } from "./tipler.js";

export interface ServisIstemcisi {
  cagir<T = unknown>(yontem: string, argumanlar: unknown[], ilerleme?: (i: Ilerleme) => void): Promise<T>;
  kapat(): Promise<void>;
}

export interface IstemciSecenekleri {
  uygulamaKlasoru: string;
  /** Uygulamayla gelen hazır çeviri paketlerinin klasörü. */
  paketKlasoru?: string;
  /** Derlenmiş iş parçacığı dosyası (paketlenmiş uygulamada). Verilmezse kaynaktaki .ts dosyası tsx ile çalışır. */
  workerYolu?: string;
  /** Geliştirme/test: .ts dosyasını tsx ile çalıştır. */
  tsx?: boolean;
}

const COKTU = "Arka plan servisi beklenmedik biçimde durdu. İşlemi tekrar deneyin.";

export function servisIstemcisi(s: IstemciSecenekleri): ServisIstemcisi {
  const yol = s.workerYolu ?? fileURLToPath(new URL("./is-parcacigi.ts", import.meta.url));
  let kapandi = false;
  let worker: Worker | undefined;
  let sayac = 0;
  const bekleyen = new Map<number, { coz: (v: unknown) => void; reddet: (e: Error) => void; ilerleme?: (i: Ilerleme) => void }>();

  const hepsiniReddet = (e: Error) => {
    for (const b of bekleyen.values()) b.reddet(e);
    bekleyen.clear();
  };

  /** İş parçacığını (gerekirse yeniden) başlatır; çökerse bekleyen çağrılar reddedilir, sonraki çağrı yenisini açar. */
  function baslat(): Worker {
    if (worker) return worker;
    const w = new Worker(yol, {
      workerData: { uygulamaKlasoru: s.uygulamaKlasoru, paketKlasoru: s.paketKlasoru },
      ...(s.workerYolu && !s.tsx ? {} : { execArgv: ["--import", "tsx"] }),
    });
    w.on("message", (m: { kimlik: number; sonuc?: unknown; hata?: string; ilerleme?: Ilerleme }) => {
      const b = bekleyen.get(m.kimlik);
      if (!b) return;
      if (m.ilerleme) return b.ilerleme?.(m.ilerleme);
      bekleyen.delete(m.kimlik);
      if (m.hata !== undefined) b.reddet(new Error(m.hata));
      else b.coz(m.sonuc);
    });
    w.on("error", (e: Error) => hepsiniReddet(new Error(`${COKTU} (${e.message})`)));
    w.on("exit", () => {
      if (worker === w) worker = undefined;
      hepsiniReddet(new Error(COKTU));
    });
    worker = w;
    return w;
  }

  return {
    cagir<T>(yontem: string, argumanlar: unknown[], ilerleme?: (i: Ilerleme) => void) {
      if (kapandi) return Promise.reject(new Error("Servis kapatıldı."));
      const w = baslat();
      const kimlik = ++sayac;
      return new Promise<T>((coz, reddet) => {
        bekleyen.set(kimlik, { coz: coz as (v: unknown) => void, reddet, ilerleme });
        w.postMessage({ kimlik, yontem, argumanlar });
      });
    },
    async kapat() {
      kapandi = true;
      await worker?.terminate();
    },
  };
}
