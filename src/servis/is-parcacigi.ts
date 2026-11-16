// Arka plan iş parçacığı: Servis'i ana süreçten ayrı çalıştırır ki uzun işler (yama hazırlama)
// arayüzü dondurmasın. Mesaj: { kimlik, yontem, argumanlar } → { kimlik, sonuc } | { kimlik, hata } | { kimlik, ilerleme }.

import { parentPort, workerData } from "node:worker_threads";
import { OYUNLAR, type OyunTanimi } from "../oyunlar/tanim.js";
import { surecAcikMi } from "../ortak/surec.js";
import { Servis } from "./servis.js";
import type { Ilerleme } from "./tipler.js";

interface Istek {
  kimlik: number;
  yontem: string;
  argumanlar: unknown[];
}

const veri = workerData as { uygulamaKlasoru: string; paketKlasoru?: string };
const servis = new Servis({
  uygulamaKlasoru: veri.uygulamaKlasoru,
  ...(veri.paketKlasoru ? { paketKlasoru: veri.paketKlasoru } : {}),
  oyunAcikMi: surecAcikMi,
});

function oyun(kimlik: unknown): OyunTanimi {
  const t = OYUNLAR.find((x) => x.kimlik === kimlik);
  if (!t) throw new Error(`Bilinmeyen oyun: ${String(kimlik)}`);
  return t;
}

type Yontem = (a: unknown[], ilerleme: (i: Ilerleme) => void) => unknown;
const YONTEMLER: Record<string, Yontem> = {
  // Tanılama
  yankı: (a) => a[0],
  ilerlemeDene: (a, il) => {
    for (let i = 1; i <= Number(a[0]); i++) il({ tur: "mesaj", metin: String(i) });
    return true;
  },
  /** Tanılama: kilitli bir işlem gibi `a[1]` ms bekler (kilit testi). */
  bekleDene: (a) => new Promise((r) => setTimeout(() => r(true), Number(a[1]))),
  /** Tanılama: iş parçacığını çökertir (toparlanma testi). */
  cokDene: () => process.exit(3),
  // Servis
  oyunDurumu: (a) => servis.oyunDurumu(oyun(a[0]), String(a[1])),
  turkceYap: (a, il) => servis.turkceYap(oyun(a[0]), String(a[1]), il),
  kaldir: (a) => servis.kaldir(oyun(a[0]), String(a[1])),
  unut: (a) => servis.unut(oyun(a[0]), String(a[1])),
};

/** Aynı oyunda aynı anda yalnızca biri çalışabilir (oyun dosyasını değiştirenler). */
const KILITLI = new Set(["bekleDene", "turkceYap", "kaldir", "unut"]);
const ISLEM_ADI: Record<string, string> = { turkceYap: "Türkçe kurulumu", kaldir: "Türkçe kaldırma", unut: "temizlik" };
const suren = new Map<string, string>();

parentPort!.on("message", async (m: Istek) => {
  const kilit = KILITLI.has(m.yontem) ? String(m.argumanlar[0]) : undefined;
  let aldim = false;
  try {
    const y = YONTEMLER[m.yontem];
    if (!y) throw new Error(`Bilinmeyen işlem: ${m.yontem}`);
    if (kilit !== undefined) {
      const s = suren.get(kilit);
      if (s) throw new Error(`Bu oyunda şu an ${ISLEM_ADI[s] ?? s} sürüyor. Bitmesini bekleyip tekrar dene.`);
      suren.set(kilit, m.yontem);
      aldim = true;
    }
    const sonuc = await y(m.argumanlar, (ilerleme) => parentPort!.postMessage({ kimlik: m.kimlik, ilerleme }));
    parentPort!.postMessage({ kimlik: m.kimlik, sonuc });
  } catch (e) {
    parentPort!.postMessage({ kimlik: m.kimlik, hata: e instanceof Error ? e.message : String(e) });
  } finally {
    if (aldim) suren.delete(kilit!);
  }
});
