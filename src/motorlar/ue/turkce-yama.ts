// Unreal oyunları için Türkçe yama: hazır paketteki çevirilerden yalnızca çevrilen satırları içeren bir metin
// tablosu ve onu taşıyan tek dosyalık ek pak üretir. Oyunun kendi dosyalarına dokunulmaz; tabloda olmayan ve
// İngilizcesi değişmiş (kaynak hash'i tutmayan) satırları oyun kendi İngilizcesiyle gösterir.

import type { CeviriPaketi } from "../../ceviri/paket.js";
import { locresYaz, type LocresGirdisi } from "./locres.js";
import { pakYaz } from "./pak.js";

export interface UeYamasi {
  degisecek: Record<string, Buffer>;
  eklenecek: Record<string, Buffer>;
  satir: number;
}

export type UeCevirisi = { tr: string; ue: [number, number, number] };

const kodSirasi = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Paketteki Unreal kimliği olan, boş olmayan çeviriler (anahtar "<ad alanı>::<anahtar>"). */
export function uePaketCevirileri(p: CeviriPaketi): Map<string, UeCevirisi> {
  const m = new Map<string, UeCevirisi>();
  for (const [anahtar, s] of Object.entries(p.satirlar)) if (s.ue && s.tr.trim() !== "") m.set(anahtar, { tr: s.tr, ue: s.ue });
  return m;
}

export function ueYamaHazirla(t: { pakYolu: string; mount: string }, ceviriler: Map<string, UeCevirisi>): UeYamasi {
  const girdiler: LocresGirdisi[] = [];
  for (const [tam, c] of ceviriler) {
    const i = tam.indexOf("::");
    if (i < 0) throw new Error(`Unreal satır anahtarı "<ad alanı>::<anahtar>" biçiminde değil: ${tam}`);
    girdiler.push({ adAlani: tam.slice(0, i), anahtar: tam.slice(i + 2), adAlaniHash: c.ue[0], anahtarHash: c.ue[1], kaynakHash: c.ue[2], metin: c.tr });
  }
  // Deterministik çıktı: ad alanı, sonra anahtar (kod noktası sırası).
  girdiler.sort((a, b) => kodSirasi(a.adAlani, b.adAlani) || kodSirasi(a.anahtar, b.anahtar));
  const pak = pakYaz(t.mount, "Game.locres", locresYaz(girdiler));
  return { degisecek: {}, eklenecek: { [t.pakYolu]: pak }, satir: girdiler.length };
}
