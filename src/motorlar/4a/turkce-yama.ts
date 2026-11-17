// 4A Engine oyunları (Metro 2033 Redux, Metro Exodus) için Türkçe yamayı bellekte hazırlar
// (oyun klasörüne YAZMAZ; uygulama: src/ortak/yedek.ts).
// Verilen satırlar Türkçeleşir, bütün metin fontlarına ğ Ğ ş Ş ı İ eklenir, değişenler yeni bir pakete konur.
// Oyun, content.vfx sürümünden anlaşılır: 1 = Redux (BC1 dokular), 3 = Exodus (LZ4 + BC7 dokular).
// Exodus'un normal sürümünde content.vfx'in üstüne güncelleme dizinleri (patch_00…patch_04.vfx) yüklenir:
// her dosyanın en yeni kopyası bulunur ve o dizinde yamalanır (bkz. HazirlamaSecenekleri.katmanlar).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exodusDokuOku, exodusDokuYaz } from "./bc7.js";
import { bolunmusDokuOku, bolunmusDokuYaz, dokuBilgisiOku, fontlariOku, glifYaz, type Doku, type Glif } from "./font.js";
import { EXODUS_I_KODU, TURKCE_YUVALAR, exodusYuvalari, turkceHarfEkle, type TurkceYuvalar } from "./font-turkce.js";
import { benzersizAnahtarlar, metinTablosuOku, metinTablosuYaz } from "./metin-tablosu.js";
import { dosyaCikar } from "./vfs.js";
import { girdiBul, vfxOku, type VfxDizin, type VfxGirdi } from "./vfx.js";
import { yamaPaketiOlustur, yolAnahtari } from "./yama-paketi.js";

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
  /**
   * content.vfx'in üstüne yüklenen güncelleme dizinleri, eskiden yeniye (ör. patch_04.vfx en sonda); içerikleri
   * orijinal olmalı. Bir dosyanın en yeni kopyası kullanılır ve değişikliği o dizine yazılır.
   */
  katmanlar?: { ad: string; vfx: Buffer }[];
}

interface Katman {
  ad: string;
  d: VfxDizin;
}

interface Konum {
  katman: Katman;
  g: VfxGirdi;
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
  const temel: Katman = { ad: "content.vfx", d: vfxOku(secenekler.vfx ?? readFileSync(join(oyunKlasoru, "content.vfx"))) };
  const katmanlar: Katman[] = [temel, ...(secenekler.katmanlar ?? []).map((k) => ({ ad: k.ad, d: vfxOku(k.vfx) }))];
  const exodus = temel.d.surum[0] >= 3;
  const paketKlasorleri = [...(secenekler.ekPaketKlasorleri ?? []), oyunKlasoru];
  /** Dosyanın en yeni kopyası (son katmandan geriye doğru). */
  const bul = (yol: string): Konum => {
    for (let i = katmanlar.length - 1; i >= 0; i--) {
      const g = girdiBul(katmanlar[i]!.d, yol)[0];
      if (g) return { katman: katmanlar[i]!, g };
    }
    throw new Error(`Oyun dosyası bulunamadı: ${yol}`);
  };
  const cikar = (k: Konum) => dosyaCikar(paketKlasorleri, k.katman.d, k.g);
  /** Katman adı → (dizindeki yol → yeni içerik). */
  const degisenler = new Map<string, Map<string, Buffer>>();
  const degistir = (k: Konum, b: Buffer) => {
    let m = degisenler.get(k.katman.ad);
    if (!m) degisenler.set(k.katman.ad, (m = new Map()));
    m.set(k.g.yol, b);
  };

  // 1) Metin tablosu.
  const lng = bul("localization/stable_us.lng");
  const t = metinTablosuOku(cikar(lng));
  let yuvaHaritasi: TurkceYuvalar = TURKCE_YUVALAR;
  if (exodus) {
    if (t.karakterler.includes("ğ") || t.karakterler.includes(EXODUS_I_KODU)) throw new Error(ZATEN_YAMALI);
    const y = exodusYuvalari(t.karakterler);
    if (!y) throw new Error("Karakter tablosunda Türkçe harfler için boş yuva bulunamadı; yöntem bu sürümde çalışmaz.");
    yuvaHaritasi = y;
  }
  const yuvalar = Object.values(yuvaHaritasi);
  const yamaliMi = (c: string | undefined) => c !== undefined && (Object.hasOwn(yuvaHaritasi, c) || c === EXODUS_I_KODU);
  if (yuvalar.some((i) => yamaliMi(t.karakterler[i]))) throw new Error(ZATEN_YAMALI);
  if (t.kodlu.some((b) => b.some((x) => yuvalar.includes(x)))) {
    throw new Error("Türkçe harfler için ayrılan karakter yuvaları metinlerde kullanılıyor; yöntem bu sürümde çalışmaz.");
  }
  for (const [harf, sira] of Object.entries(yuvaHaritasi)) t.karakterler[sira] = harf;
  // Exodus: İ, büyük harf dönüşümünden etkilenmeyen özel karakterle temsil edilir (bkz. EXODUS_I_KODU).
  const metniHazirla = exodus ? (m: string) => m.replaceAll("İ", EXODUS_I_KODU) : (m: string) => m;
  if (exodus) t.karakterler[yuvaHaritasi.İ] = EXODUS_I_KODU;
  // Tekrarlanan anahtarlar "k#2" biçiminde ayrı ele alınır (bkz. benzersizAnahtarlar).
  const anahtarlar = benzersizAnahtarlar(t);
  const satirlar = new Map(t.satirlar.map((s, i) => [anahtarlar[i]!, s]));
  for (const [anahtar, metin] of ceviriler) {
    const s = satirlar.get(anahtar);
    if (!s) throw new Error(`Metin satırı bulunamadı: ${anahtar}`);
    s.metin = metniHazirla(metin);
  }
  degistir(lng, metinTablosuYaz(t));

  // 2) Fontlar.
  const configKonumu = bul("content/config.bin");
  const config = Buffer.from(cikar(configKonumu));
  const yamalananFontlar: string[] = [];
  const atlananFontlar: { font: string; neden: string }[] = [];
  const islenenDokular = new Map<string, { glifler: Map<number, Glif>; kaynak: string }>();
  const dokusuzlar: ReturnType<typeof fontlariOku> = [];
  /** Doku parçaları: en yeni kopyası olan katmandan, büyükten küçüğe. */
  const dokuParcalari = (taban: string): Konum[] => {
    for (let i = katmanlar.length - 1; i >= 0; i--) {
      const k = katmanlar[i]!;
      const p = k.d.dosyalar.filter((g) => /\.(512|1024|2048|4096)$/.test(g.yol) && yolAnahtari(g.yol).startsWith(taban + "."));
      if (p.length) return p.sort((a, b) => boyutu(b.yol) - boyutu(a.yol)).map((g) => ({ katman: k, g }));
    }
    return [];
  };

  for (const f of fontlariOku(config, "us")) {
    if (f.glifler.length !== t.karakterler.length) continue; // ızgara/simge fontları
    const taban = `content/textures/${f.dokuAdi.replaceAll("\\", "/")}`.toLowerCase();
    const parcalar = dokuParcalari(taban);
    if (parcalar.length === 0) {
      dokusuzlar.push(f); // sonra: ölçüleri birebir aynı bir fontun yeni glifleri yazılabilir
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
      const hamlar = parcalar.map(cikar);
      let doku: Doku;
      let yaz: (yeni: Doku) => Buffer[];
      if (exodus) {
        const ep = parcalar.map((k, i) => ({ yol: k.g.yol, veri: hamlar[i]! }));
        doku = exodusDokuOku(ep).doku;
        yaz = (yeni) => exodusDokuYaz(yeni, ep);
      } else {
        const bilgi = dokuBilgisiOku(cikar(bul(`${taban}.bin`)));
        doku = bolunmusDokuOku(hamlar, bilgi.gen, bilgi.yuk);
        yaz = (yeni) => bolunmusDokuYaz(yeni, hamlar);
      }
      const sonuc = turkceHarfEkle(f, doku, t.karakterler, yuvaHaritasi);
      yaz(sonuc.doku).forEach((b, i) => {
        if (b !== hamlar[i]) degistir(parcalar[i]!, b); // değişmeyen parça pakete konmaz
      });
      yeniGlifler = sonuc.glifler;
      islenenDokular.set(taban, { glifler: yeniGlifler, kaynak: JSON.stringify(f.glifler) });
    }
    for (const [sira, g] of yeniGlifler) glifYaz(config, f, sira, g);
    yamalananFontlar.push(f.dokuAdi);
  }
  // Dokusu arşivde olmayan font (Exodus'ta main_menu → font_metro_2034_font_2_us): glif ölçüleri başka bir fontla
  // birebir aynıysa oyun o dokuyu kullanıyordur; aynı yeni glifler yazılır.
  for (const f of dokusuzlar) {
    const kaynak = JSON.stringify(f.glifler);
    const es = [...islenenDokular.values()].find((x) => x.kaynak === kaynak);
    if (!es) {
      atlananFontlar.push({ font: `${f.rol} (${f.dokuAdi})`, neden: "doku dosyası yok" });
      continue;
    }
    for (const [sira, g] of es.glifler) glifYaz(config, f, sira, g);
    yamalananFontlar.push(f.dokuAdi);
  }
  degistir(configKonumu, config);

  // 3) Değişen her dizin için yeni paket ve dizin. Temel dizinin paketi content_NN.vfs0 adını alır;
  // güncelleme dizininin paketi "<dizin>_tr.vfs0" (ör. patch_04_tr.vfs0) olur, adlar çakışmaz.
  const degisecek: Record<string, Buffer> = {};
  const eklenecek: Record<string, Buffer> = {};
  for (const k of katmanlar) {
    const m = degisenler.get(k.ad);
    if (!m) continue;
    const ad = k === temel ? undefined : `${k.ad.replace(/\.vfx$/i, "")}_tr.vfs0`;
    const paket = yamaPaketiOlustur(k.d, m, ad ? { ad } : {});
    degisecek[k.ad] = paket.yeniVfx;
    eklenecek[paket.paketAdi] = paket.paketIcerik;
  }
  return { degisecek, eklenecek, yamalananFontlar, atlananFontlar };
}
