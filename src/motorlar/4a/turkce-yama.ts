// Metro 2033 Redux için Türkçe yamayı bellekte hazırlar (oyun klasörüne YAZMAZ; uygulama: src/ortak/yedek.ts).
// Verilen satırlar Türkçeleşir, bütün metin fontlarına ğ Ğ ş Ş ı İ eklenir, değişenler yeni bir pakete konur.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bolunmusDokuOku, bolunmusDokuYaz, dokuBilgisiOku, fontlariOku, glifYaz, type Glif } from "./font.js";
import { TURKCE_YUVALAR, turkceHarfEkle } from "./font-turkce.js";
import { benzersizAnahtarlar, metinTablosuOku, metinTablosuYaz } from "./metin-tablosu.js";
import { dosyaCikar } from "./vfs.js";
import { girdiBul, vfxOku } from "./vfx.js";
import { yamaPaketiOlustur } from "./yama-paketi.js";

export interface TurkceYama {
  /** Oyun klasöründe değişecek dosyalar (göreli yol → içerik). */
  degisecek: Record<string, Buffer>;
  /** Oyun klasörüne eklenecek dosyalar. */
  eklenecek: Record<string, Buffer>;
  yamalananFontlar: string[];
  atlananFontlar: { font: string; neden: string }[];
}

export interface HazirlamaSecenekleri {
  /** Oyun klasöründeki yerine kullanılacak content.vfx (ör. yamalı oyunda yedekteki orijinal). */
  vfx?: Buffer;
  /** Paket dosyalarının ek olarak aranacağı klasörler (önce bunlar). */
  ekPaketKlasorleri?: string[];
}

const ZATEN_YAMALI =
  "Oyun zaten yamalı görünüyor (Türkçe harf yuvaları dolu). Önce 'geri-al' ile geri alın ya da yedekteki orijinal dizini kullanın.";

const boyutu = (yol: string) => Number(/\.(\d+)$/.exec(yol)?.[1] ?? 0);

/** `ceviriler`: .lng anahtarı → Türkçe metin. Verilmeyen satırlar İngilizce ve bayt bayt aynı kalır. */
export function turkceYamaHazirla(
  oyunKlasoru: string,
  ceviriler: Map<string, string>,
  secenekler: HazirlamaSecenekleri = {},
): TurkceYama {
  const d = vfxOku(secenekler.vfx ?? readFileSync(join(oyunKlasoru, "content.vfx")));
  const paketKlasorleri = [...(secenekler.ekPaketKlasorleri ?? []), oyunKlasoru];
  const bul = (yol: string) => {
    const g = girdiBul(d, yol)[0];
    if (!g) throw new Error(`Oyun dosyası bulunamadı: ${yol}`);
    return g;
  };
  const cikar = (yol: string) => dosyaCikar(paketKlasorleri, d, bul(yol));
  const degisenler = new Map<string, Buffer>();

  // 1) Metin tablosu.
  const lngYolu = bul("localization/stable_us.lng").yol;
  const t = metinTablosuOku(cikar(lngYolu));
  const yuvalar = Object.values(TURKCE_YUVALAR) as number[];
  if (yuvalar.some((i) => Object.hasOwn(TURKCE_YUVALAR, t.karakterler[i] ?? ""))) throw new Error(ZATEN_YAMALI);
  if (t.kodlu.some((b) => b.some((x) => yuvalar.includes(x)))) {
    throw new Error("Türkçe harfler için ayrılan karakter yuvaları metinlerde kullanılıyor; yöntem bu sürümde çalışmaz.");
  }
  for (const [harf, sira] of Object.entries(TURKCE_YUVALAR)) t.karakterler[sira] = harf;
  // Tekrarlanan anahtarlar "k#2" biçiminde ayrı ele alınır (bkz. benzersizAnahtarlar).
  const anahtarlar = benzersizAnahtarlar(t);
  const satirlar = new Map(t.satirlar.map((s, i) => [anahtarlar[i]!, s]));
  for (const [anahtar, metin] of ceviriler) {
    const s = satirlar.get(anahtar);
    if (!s) throw new Error(`Metin satırı bulunamadı: ${anahtar}`);
    s.metin = metin;
  }
  degisenler.set(lngYolu, metinTablosuYaz(t));

  // 2) Fontlar.
  const configYolu = bul("content/config.bin").yol;
  const config = Buffer.from(cikar(configYolu));
  const yamalananFontlar: string[] = [];
  const atlananFontlar: { font: string; neden: string }[] = [];
  const islenenDokular = new Map<string, { glifler: Map<number, Glif>; kaynak: string }>();

  for (const f of fontlariOku(config, "us")) {
    if (f.glifler.length !== t.karakterler.length) continue; // ızgara/simge fontları
    const taban = `content/textures/${f.dokuAdi.replaceAll("\\", "/")}`.toLowerCase();
    const parcalar = d.dosyalar
      .filter((g) => /\.(512|1024|2048|4096)$/.test(g.yol) && g.yol.toLowerCase().startsWith(taban + "."))
      .sort((a, b) => boyutu(b.yol) - boyutu(a.yol)); // büyükten küçüğe
    if (parcalar.length === 0) {
      atlananFontlar.push({ font: `${f.rol} (${f.dokuAdi})`, neden: "doku dosyası yok" });
      continue;
    }
    const onceki = islenenDokular.get(taban);
    let yeniGlifler: Map<number, Glif>;
    if (onceki) {
      // Aynı dokuyu paylaşan ikinci font (ör. map + typewriter): ölçüler aynıysa aynı yeni glifler.
      if (onceki.kaynak !== JSON.stringify(f.glifler)) {
        atlananFontlar.push({ font: `${f.rol} (${f.dokuAdi})`, neden: "doku başka bir fontla farklı ölçülerle paylaşılıyor" });
        continue;
      }
      yeniGlifler = onceki.glifler;
    } else {
      const bilgi = dokuBilgisiOku(cikar(`${taban}.bin`));
      const hamlar = parcalar.map((g) => dosyaCikar(paketKlasorleri, d, g));
      const sonuc = turkceHarfEkle(f, bolunmusDokuOku(hamlar, bilgi.gen, bilgi.yuk), t.karakterler);
      bolunmusDokuYaz(sonuc.doku, hamlar).forEach((b, i) => degisenler.set(parcalar[i]!.yol, b));
      yeniGlifler = sonuc.glifler;
      islenenDokular.set(taban, { glifler: yeniGlifler, kaynak: JSON.stringify(f.glifler) });
    }
    for (const [sira, g] of yeniGlifler) glifYaz(config, f, sira, g);
    yamalananFontlar.push(f.dokuAdi);
  }
  degisenler.set(configYolu, config);

  // 3) Yeni paket ve dizin.
  const paket = yamaPaketiOlustur(d, degisenler);
  return {
    degisecek: { "content.vfx": paket.yeniVfx },
    eklenecek: { [paket.paketAdi]: paket.paketIcerik },
    yamalananFontlar,
    atlananFontlar,
  };
}
