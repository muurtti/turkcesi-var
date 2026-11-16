// Uzun işlemleri oyun başına yürütür: ilerlemeyi kabukta tutar (sayfa değişse de kaybolmaz),
// aynı oyunda ikinci işlemi başlatmaz, bitince durumu yeniler, sonucu Türkçe bildirir.

import type { Ilerleme } from "../../src/servis/tipler.js";
import { turkceHata } from "./hata.js";

export type Mesaj = { tur: "basari" | "tehlike" | "bilgi"; metin: string } | undefined;

/** `basari`: düz metin ya da sonuca göre metin (undefined → bildirim yok, ör. dosya penceresi kapatıldı). */
export type Calistir = <T>(ad: string, is: (il: (i: Ilerleme) => void) => Promise<T>, basari?: string | ((r: T) => string | undefined)) => Promise<T | undefined>;

export function calistirici(s: {
  /** Şu an süren işlem (yoksa undefined). */
  suren: () => Ilerleme | undefined;
  ayarla: (i: Ilerleme | undefined) => void;
  bildir: (m: Mesaj) => void;
  yenile: () => Promise<void>;
}): Calistir {
  return async (ad, is, basari) => {
    if (s.suren()) {
      s.bildir({ tur: "bilgi", metin: "Bu oyunda bir işlem sürüyor; bitmesini bekle." });
      return undefined;
    }
    s.ayarla({ tur: "mesaj", metin: `${ad}…` });
    try {
      const r = await is((i) => s.ayarla(i));
      const metin = typeof basari === "function" ? basari(r) : basari;
      if (metin) s.bildir({ tur: "basari", metin });
      return r;
    } catch (e) {
      s.bildir({ tur: "tehlike", metin: turkceHata(e) });
      return undefined;
    } finally {
      s.ayarla(undefined);
      await s.yenile();
    }
  };
}
