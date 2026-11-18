// Oyun klasörüne güvenli yazma: önce yedek, sonra "hep ya da hiç" uygulama, istenince geri alma.
// Oyun klasörüne yazan TEK yer burasıdır.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export interface YamaKaydi {
  oyun: string;
  tarih: string;
  /** Değiştirilen dosyaların yamadan önceki özetleri (göreli yol → SHA-256). */
  orijinalOzetler: Record<string, string>;
  /** Değiştirilen dosyaların yamalı özetleri. */
  yamaliOzetler: Record<string, string>;
  /** Yamanın eklediği (önceden olmayan) dosyalar. */
  eklenenDosyalar: string[];
  /** true: oyun dosyaları yazılırken kayıt alındı, yazma tamamlandığı doğrulanmadı. */
  bekleyen?: boolean;
}

const GECICI = ".tv-gecici";
const KAYIT = "kayit.json";

const ozet = (b: Buffer) => createHash("sha256").update(b).digest("hex");

function kayitOku(yedekKlasoru: string): YamaKaydi | undefined {
  const y = join(yedekKlasoru, KAYIT);
  if (!existsSync(y)) return undefined;
  try {
    return JSON.parse(readFileSync(y, "utf8")) as YamaKaydi;
  } catch {
    throw new Error(`Yama kayıt dosyası bozuk: ${y}. Hiçbir dosyaya dokunulmadı.`);
  }
}

const ayniKlasor = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

/**
 * Bir oyun kurulumunun yedek klasörü. Aynı oyun birden çok yerde kurulu olabilir (Steam + Epic), bu yüzden
 * yedek oyun klasörüne göre ayrılır: `<kök>@<klasör özeti>`. Eski sürümlerden kalan tek yedek (`<kök>`)
 * kendi kurulumu için kullanılmaya devam eder.
 */
export function yedekKlasoruSec(kok: string, oyunKlasoru: string): string {
  const eski = kayitOku(kok);
  if (eski && ayniKlasor(eski.oyun, oyunKlasoru)) return kok;
  const kod = createHash("sha1").update(resolve(oyunKlasoru).toLowerCase()).digest("hex").slice(0, 10);
  const kendi = `${kok}@${kod}`;
  if (kayitOku(kendi)) return kendi;
  return tasinmisYedek(kok, oyunKlasoru) ?? kendi;
}

/**
 * Oyun klasörü taşındıysa (başka sürücü, Steam "kurulum klasörünü taşı") yedeği eski yolun adıyla kalır.
 * Kaydındaki eski klasör artık yoksa VE kayıttaki yamalı dosyalar bu klasördekilerle birebir aynıysa,
 * o yedek bu kuruluma aittir. Öteki kurulum hâlâ yerindeyse (Steam + Epic) onun yedeği sahiplenilmez.
 */
function tasinmisYedek(kok: string, oyunKlasoru: string): string | undefined {
  const ust = dirname(kok);
  const ad = basename(kok);
  let adaylar: string[];
  try {
    adaylar = readdirSync(ust).filter((a) => (a === ad || a.startsWith(`${ad}@`)) && !a.includes(".eski-"));
  } catch {
    return undefined;
  }
  for (const a of adaylar) {
    const yer = join(ust, a);
    let kayit: YamaKaydi | undefined;
    try {
      kayit = kayitOku(yer);
    } catch {
      continue;
    }
    if (!kayit || ayniKlasor(kayit.oyun, oyunKlasoru) || existsSync(kayit.oyun)) continue;
    const dosyalar = Object.entries(kayit.yamaliOzetler);
    if (dosyalar.length === 0) continue;
    const eslesir = dosyalar.every(([rel, h]) => {
      const p = join(oyunKlasoru, rel);
      return existsSync(p) && ozet(readFileSync(p)) === h;
    });
    if (eslesir) return yer;
  }
  return undefined;
}

/** Kaydı atomik yazar (geçici dosya + yeniden adlandırma). */
function kayitYaz(yedekKlasoru: string, kayit: YamaKaydi): void {
  mkdirSync(yedekKlasoru, { recursive: true });
  const y = join(yedekKlasoru, KAYIT);
  writeFileSync(y + GECICI, JSON.stringify(kayit, null, 2));
  renameSync(y + GECICI, y);
}

/** Oyun dosyaları yamadan sonra başka biçimde değişti (Steam güncellemesi). Hiçbir dosyaya dokunulmadı. */
export class DegismisHatasi extends Error {}

function degismisHatasi(): Error {
  return new DegismisHatasi(
    "Oyun dosyaları yamadan sonra değişmiş (Steam güncellemesi olabilir). " +
      "Güvenlik için hiçbir dosyaya dokunulmadı. Yamanın eklediği dosyaları temizleyip yamayı unutmak için " +
      "'unut' komutunu kullanabilirsiniz; ardından Steam'de 'Oyun dosyalarının bütünlüğünü doğrula' yapın.",
  );
}

/**
 * Dosyaları hep birlikte yerine koyar. Herhangi bir adım başarısız olursa önceki hallerine döndürür.
 * `yeni`: göreli yol → yeni içerik (null = dosyayı sil).
 */
function hepYaDaHic(oyunKlasoru: string, yeni: Map<string, Buffer | null>): void {
  const onceki = new Map<string, Buffer | null>();
  for (const rel of yeni.keys()) {
    const p = join(oyunKlasoru, rel);
    onceki.set(rel, existsSync(p) ? readFileSync(p) : null);
  }
  const yazilanGeciciler: string[] = [];
  const tamamlanan: string[] = [];
  try {
    for (const [rel, icerik] of yeni) {
      if (icerik === null) continue;
      const g = join(oyunKlasoru, rel) + GECICI;
      writeFileSync(g, icerik);
      yazilanGeciciler.push(g);
    }
    for (const [rel, icerik] of yeni) {
      const p = join(oyunKlasoru, rel);
      if (icerik === null) {
        if (existsSync(p)) unlinkSync(p);
      } else {
        renameSync(p + GECICI, p);
      }
      tamamlanan.push(rel);
    }
  } catch (e) {
    for (const g of yazilanGeciciler) rmSync(g, { force: true });
    for (const rel of tamamlanan) {
      const p = join(oyunKlasoru, rel);
      const eski = onceki.get(rel);
      if (eski === null || eski === undefined) rmSync(p, { force: true });
      else writeFileSync(p, eski);
    }
    const neden = e instanceof Error ? e.message : String(e);
    throw new Error(`Dosyalar yazılamadı, hiçbir şey değiştirilmedi. (Oyun açık olabilir ya da dosya kilitli.) Ayrıntı: ${neden}`);
  }
}

export interface UygulaKancalari {
  /** Yalnızca testler için: oyun dosyaları yazıldıktan hemen sonra, kayıt tamamlanmadan çağrılır. */
  oyunYazildi?: () => void;
}

export async function uygula(
  oyunKlasoru: string,
  yedekKlasoru: string,
  degisecek: Record<string, Buffer>,
  eklenecek: Record<string, Buffer>,
  kancalar: UygulaKancalari = {},
): Promise<YamaKaydi> {
  const eski = kayitOku(yedekKlasoru);
  const kayit: YamaKaydi = eski
    ? { ...eski, orijinalOzetler: { ...eski.orijinalOzetler }, yamaliOzetler: { ...eski.yamaliOzetler } }
    : { oyun: oyunKlasoru, tarih: "", orijinalOzetler: {}, yamaliOzetler: {}, eklenenDosyalar: [] };

  // 1) Denetim: hiçbir şey yazmadan önce.
  const yeniYedekler: string[] = [];
  for (const rel of Object.keys(degisecek)) {
    const p = join(oyunKlasoru, rel);
    if (!existsSync(p)) throw new Error(`Oyun dosyası bulunamadı: ${rel}`);
    const h = ozet(readFileSync(p));
    if (rel in kayit.orijinalOzetler) {
      if (h !== kayit.orijinalOzetler[rel] && h !== kayit.yamaliOzetler[rel]) throw degismisHatasi();
      continue;
    }
    const yedekYolu = join(yedekKlasoru, "orijinal", rel);
    if (existsSync(yedekYolu)) {
      // Kayıtsız bir yedek: aynıysa kullan, farklıysa asıl yedeği korumak için dur.
      if (ozet(readFileSync(yedekYolu)) !== h) {
        throw new Error(
          `Yedek klasöründe "${rel}" için kayıtsız ve farklı bir yedek var (${yedekYolu}). ` +
            "Asıl yedeği korumak için durduruldu; hiçbir dosyaya dokunulmadı.",
        );
      }
      kayit.orijinalOzetler[rel] = h;
    } else {
      yeniYedekler.push(rel);
    }
  }
  for (const [rel, b] of Object.entries(eklenecek)) {
    const p = join(oyunKlasoru, rel);
    // Birebir aynı içerik bizim eski yamamızdan kalmıştır (ör. Steam doğrulaması bu dosyayı silmez): engel değil.
    if (existsSync(p) && !kayit.eklenenDosyalar.includes(rel) && !readFileSync(p).equals(b)) {
      throw new Error(`"${rel}" dosyası oyun klasöründe zaten var (başka bir yama olabilir). Üzerine yazılmadı.`);
    }
  }

  // 2) Yedek: ilk kez değişen dosyaların orijinalleri (var olan yedek asla ezilmez).
  for (const rel of yeniYedekler) {
    const icerik = readFileSync(join(oyunKlasoru, rel));
    const hedef = join(yedekKlasoru, "orijinal", rel);
    mkdirSync(dirname(hedef), { recursive: true });
    writeFileSync(hedef + GECICI, icerik);
    renameSync(hedef + GECICI, hedef);
    kayit.orijinalOzetler[rel] = ozet(icerik);
  }

  // 3) Bekleyen kayıt: oyun dosyalarına dokunmadan ÖNCE diske yazılır.
  for (const [rel, b] of Object.entries(degisecek)) kayit.yamaliOzetler[rel] = ozet(b);
  kayit.eklenenDosyalar = [...new Set([...kayit.eklenenDosyalar, ...Object.keys(eklenecek)])];
  kayit.bekleyen = true;
  kayit.tarih = new Date().toISOString();
  kayitYaz(yedekKlasoru, kayit);

  // 4) Hep ya da hiç yazma. Önce eklenen dosyalar, sonra onlara başvuran dizin (ör. content.vfx):
  //    arada kesilirse oyun var olmayan bir pakete başvurmaz.
  const yeni = new Map<string, Buffer | null>();
  for (const [rel, b] of Object.entries(eklenecek)) yeni.set(rel, b);
  for (const [rel, b] of Object.entries(degisecek)) yeni.set(rel, b);
  try {
    hepYaDaHic(oyunKlasoru, yeni);
  } catch (e) {
    if (eski) kayitYaz(yedekKlasoru, eski);
    else {
      rmSync(join(yedekKlasoru, KAYIT), { force: true });
      for (const rel of yeniYedekler) rmSync(join(yedekKlasoru, "orijinal", rel), { force: true });
    }
    throw e;
  }
  kancalar.oyunYazildi?.();

  // 5) Kaydı tamamla.
  kayit.bekleyen = false;
  kayitYaz(yedekKlasoru, kayit);
  return kayit;
}

/**
 * Yamanın durumu: kayıt yoksa "yok"; değiştirilen bütün dosyalar yamalı haldeyse "kurulu";
 * kayıt var ama dosyalar başka biçimde değişmişse (Steam güncellemesi / doğrulaması) "degismis".
 */
export function yamaDurumu(oyunKlasoru: string, yedekKlasoru: string): "yok" | "kurulu" | "degismis" {
  const kayit = kayitOku(yedekKlasoru);
  if (!kayit) return "yok";
  for (const [rel, h] of Object.entries(kayit.yamaliOzetler)) {
    const p = join(oyunKlasoru, rel);
    if (!existsSync(p) || ozet(readFileSync(p)) !== h) return "degismis";
  }
  // Yazma yarıda kesildiyse (ör. uygulama kapatıldı) eklenen dosya eksik kalabilir.
  for (const rel of kayit.eklenenDosyalar) if (!existsSync(join(oyunKlasoru, rel))) return "degismis";
  return "kurulu";
}

/**
 * Yamayı geri alır. Değişen her dosya ya yamalı ya da orijinal halinde olmalıdır
 * (Steam doğrulaması orijinali geri getirmişse yalnızca yamanın artıkları temizlenir).
 */
export async function geriYukle(oyunKlasoru: string, yedekKlasoru: string): Promise<void> {
  const kayit = kayitOku(yedekKlasoru);
  if (!kayit) throw new Error("Bu oyunda Türkçesi Var yaması kurulu değil (yedek kaydı bulunamadı).");

  const yeni = new Map<string, Buffer | null>();
  for (const [rel, orijinalOzet] of Object.entries(kayit.orijinalOzetler)) {
    const p = join(oyunKlasoru, rel);
    const simdiki = existsSync(p) ? ozet(readFileSync(p)) : undefined;
    if (simdiki === orijinalOzet) continue; // zaten orijinal
    if (simdiki !== kayit.yamaliOzetler[rel]) throw degismisHatasi();
    const b = readFileSync(join(yedekKlasoru, "orijinal", rel));
    if (ozet(b) !== orijinalOzet) throw new Error(`Yedek dosyası bozuk: ${rel}. Hiçbir şey değiştirilmedi.`);
    yeni.set(rel, b);
  }
  for (const rel of kayit.eklenenDosyalar) if (existsSync(join(oyunKlasoru, rel))) yeni.set(rel, null);
  hepYaDaHic(oyunKlasoru, yeni);

  rmSync(yedekKlasoru, { recursive: true, force: true });
}

/**
 * Kaydı kaybolmuş (oyun klasörü taşınmış, uygulama klasörü silinmiş) ama adı yalnızca bize ait olan eklenmiş bir
 * dosyayı siler (Unreal oyunlarındaki `..._TurkcesiVar_P.pak`). Kaydı olan yamada kullanılmaz; oyunun kendi
 * dosyalarına dokunmaz.
 */
export function sahipsizEklenmisDosyayiSil(oyunKlasoru: string, yedekKlasoru: string, rel: string): void {
  if (kayitOku(yedekKlasoru)) throw new Error("Yama kaydı var; sahipsiz dosya silme yalnızca kayıt kaybolmuşsa kullanılır.");
  if (existsSync(join(oyunKlasoru, rel))) hepYaDaHic(oyunKlasoru, new Map([[rel, null]]));
}

/**
 * Oyun dosyaları yamadan sonra başka biçimde değiştiyse (ör. Steam güncellemesi) çıkış yolu:
 * değişen dosyalara DOKUNMAZ; yalnızca yamanın eklediği dosyaları siler ve kaydı/yedeği unutur.
 */
export async function yamayiUnut(oyunKlasoru: string, yedekKlasoru: string): Promise<void> {
  const kayit = kayitOku(yedekKlasoru);
  if (!kayit) throw new Error("Bu oyunda Türkçesi Var yaması kurulu değil (yedek kaydı bulunamadı).");
  const yeni = new Map<string, Buffer | null>();
  for (const rel of kayit.eklenenDosyalar) if (existsSync(join(oyunKlasoru, rel))) yeni.set(rel, null);
  hepYaDaHic(oyunKlasoru, yeni);
  // Yedek silinmez: oyun dosyaları Steam güncellemesi dışında bir nedenle değişmişse (başka bir mod, elle
  // seçilmiş mağaza dışı kopya) orijinal yalnızca buradadır. Tarihli arşiv olarak saklanır.
  const damga = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "");
  renameSync(yedekKlasoru, `${yedekKlasoru}.eski-${damga}`);
}
