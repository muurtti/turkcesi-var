// Çevrilecek satırları metin tablosundan çıkarır ve bağlamı koruyan gruplara böler. Motordan bağımsız.

import { createHash } from "node:crypto";
import { benzersizAnahtarlar, type MetinTablosu } from "../motorlar/4a/metin-tablosu.js";

export { benzersizAnahtarlar };

export type SatirTuru = "altyazi" | "arayuz" | "diger";

export interface CeviriSatiri {
  anahtar: string;
  en: string;
  ru?: string;
  tur: SatirTuru;
  /** Bağlam grubu: altyazıda seviye ("voices\\l00_intro"), arayüzde önek ("$game"). */
  grup: string;
  /** Grup içindeki sıra. */
  sira: number;
}

export interface CeviriGrubu {
  kimlik: string;
  satirlar: CeviriSatiri[];
}

const ARAYUZ_ONEKLERI = ["menu", "main_", "options", "ACH", "rich_presence_"];

export function kaynakOzeti(en: string): string {
  return createHash("sha256").update(en, "utf8").digest("hex").slice(0, 16);
}

/** "voices\\" ya da "<önek>\\voices\\" ile başlayan anahtarlar konuşma altyazısıdır. */
const ALTYAZI = /^(?:[^\\]+\\)?voices\\[^\\]+/;

function turBul(anahtar: string): SatirTuru {
  if (ALTYAZI.test(anahtar)) return "altyazi";
  if (anahtar.startsWith("$") || ARAYUZ_ONEKLERI.some((o) => anahtar.startsWith(o))) return "arayuz";
  return "diger";
}

function grupBul(anahtar: string, tur: SatirTuru): string {
  if (tur === "altyazi") return ALTYAZI.exec(anahtar)![0];
  if (tur === "arayuz") return anahtar.split("_")[0]!;
  return anahtar.split(/[._\\]/)[0]!;
}

export function cevrilecekSatirlar(us: MetinTablosu, ru?: MetinTablosu): CeviriSatiri[] {
  const ruAnahtar = ru ? benzersizAnahtarlar(ru) : [];
  const rusca = new Map((ru?.satirlar ?? []).map((s, i) => [ruAnahtar[i]!, s.metin]));
  const usAnahtar = benzersizAnahtarlar(us);
  const gruplar = new Map<string, CeviriSatiri[]>();
  us.satirlar.forEach((s, i) => {
    if (s.metin.trim() === "") return;
    const anahtar = usAnahtar[i]!;
    const tur = turBul(s.anahtar);
    const grup = grupBul(s.anahtar, tur);
    const r = rusca.get(anahtar);
    const satir: CeviriSatiri = { anahtar, en: s.metin, tur, grup, sira: 0 };
    if (r && r.trim() !== "") satir.ru = r;
    let liste = gruplar.get(grup);
    if (!liste) gruplar.set(grup, (liste = []));
    liste.push(satir);
  });
  // Gruplar türe göre art arda dizilir (altyazı, arayüz, diğer); böylece gruplama türleri bölmez.
  const SIRA: Record<SatirTuru, number> = { altyazi: 0, arayuz: 1, diger: 2 };
  const sirali = [...gruplar.values()].sort((a, b) => SIRA[a[0]!.tur] - SIRA[b[0]!.tur]);
  const sonuc: CeviriSatiri[] = [];
  for (const liste of sirali) {
    liste.sort((a, b) => a.anahtar.localeCompare(b.anahtar, "en", { numeric: true }));
    liste.forEach((s, i) => {
      s.sira = i;
      sonuc.push(s);
    });
  }
  return sonuc;
}

/** Altyazıda sahne (grup) sınırı korunur; arayüz ve diğer satırlarda aynı türdeki ardışık küçük gruplar birleşir. */
function bolum(s: CeviriSatiri): string {
  return s.tur === "altyazi" ? s.grup : `(${s.tur})`;
}

/** Aynı bölümdeki ardışık satırları satır ve karakter sınırına göre böler. */
export function grupla(satirlar: CeviriSatiri[], enFazlaSatir = 40, enFazlaKarakter = 4000): CeviriGrubu[] {
  const sonuc: CeviriGrubu[] = [];
  const sayac = new Map<string, number>();
  let mevcut: CeviriSatiri[] = [];
  let karakter = 0;
  const kapat = () => {
    if (mevcut.length === 0) return;
    const b = bolum(mevcut[0]!);
    const n = sayac.get(b) ?? 0;
    sayac.set(b, n + 1);
    sonuc.push({ kimlik: `${b}#${n}`, satirlar: mevcut });
    mevcut = [];
    karakter = 0;
  };
  for (const s of satirlar) {
    const farkliGrup = mevcut.length > 0 && bolum(mevcut[0]!) !== bolum(s);
    const tasar = mevcut.length >= enFazlaSatir || (mevcut.length > 0 && karakter + s.en.length > enFazlaKarakter);
    if (farkliGrup || tasar) kapat();
    mevcut.push(s);
    karakter += s.en.length;
  }
  kapat();
  return sonuc;
}
