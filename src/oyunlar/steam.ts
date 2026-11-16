// Steam kütüphanelerini, kurulu oyunları ve oyunların yerel önbellekteki görsellerini bulur.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { hileKorumaliMi } from "./hile-korumali.js";
import { tanimBul, type OyunTanimi } from "./tanim.js";

export type VdfDegeri = string | { [anahtar: string]: VdfDegeri };

export interface OyunGorselleri {
  /** Dikey kapak (600×900). */
  kapak?: string;
  /** Geniş afiş (oyun sayfasının üstü). */
  afis?: string;
  /** Saydam logo. */
  logo?: string;
  /** Yatay başlık görseli. */
  baslik?: string;
}

export interface BulunanOyun {
  appId?: number;
  ad: string;
  klasor: string;
  durum: "destekleniyor" | "desteklenmiyor" | "hile-korumali";
  tanim?: OyunTanimi;
  gorseller: OyunGorselleri;
  /** Nereden bulundu: Steam, Epic Games ya da kullanıcının seçtiği klasör. */
  platform?: "steam" | "epic" | "elle";
}

/** Steam'in "anahtar" "değer" / "anahtar" { … } biçimini okur. Bozuk dosyada okuyabildiğini döndürür. */
export function vdfOku(metin: string): { [anahtar: string]: VdfDegeri } {
  const jetonlar: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|([{}])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(metin))) jetonlar.push(m[2] ?? `"${m[1]!.replace(/\\(.)/g, "$1")}`);
  let i = 0;
  const nesne = (): { [anahtar: string]: VdfDegeri } => {
    const o: { [anahtar: string]: VdfDegeri } = {};
    while (i < jetonlar.length) {
      const j = jetonlar[i++]!;
      if (j === "}") return o;
      if (!j.startsWith('"')) continue;
      const anahtar = j.slice(1);
      const sonraki = jetonlar[i++];
      if (sonraki === undefined) return o;
      if (sonraki === "{") o[anahtar] = nesne();
      else if (sonraki.startsWith('"')) o[anahtar] = sonraki.slice(1);
    }
    return o;
  };
  return nesne();
}

const STEAM_VARSAYILAN = "C:/Program Files (x86)/Steam";

export function steamKlasoruBul(): string | undefined {
  try {
    const cikti = execFileSync("reg", ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"], { encoding: "utf8" });
    const m = /SteamPath\s+REG_SZ\s+(.+)/i.exec(cikti);
    if (m && existsSync(m[1]!.trim())) return m[1]!.trim();
  } catch {
    /* kayıt defterinde yok */
  }
  return existsSync(STEAM_VARSAYILAN) ? STEAM_VARSAYILAN : undefined;
}

const ayni = (a: string, b: string) => a.replaceAll("\\", "/").toLowerCase() === b.replaceAll("\\", "/").toLowerCase();

export function kutuphaneleriOku(steamKlasoru: string): string[] {
  const sonuc = [steamKlasoru];
  const y = join(steamKlasoru, "steamapps", "libraryfolders.vdf");
  if (!existsSync(y)) return sonuc;
  const v = vdfOku(readFileSync(y, "utf8"));
  const kf = v.libraryfolders;
  if (typeof kf !== "object") return sonuc;
  for (const giris of Object.values(kf)) {
    if (typeof giris !== "object" || typeof giris.path !== "string") continue;
    if (!sonuc.some((s) => ayni(s, giris.path as string))) sonuc.push(giris.path);
  }
  return sonuc;
}

/** Oyun sayılmayan Steam araçları. */
const ARAC_KIMLIKLERI = new Set([228980, 431960, 1070560, 1391110, 1493710, 1628350]); // 431960: Wallpaper Engine
const ARAC_KLASORLERI = new Set(["steamworks shared", "steam controller configs", "steamvr"]);
const DURUM_SIRASI = { destekleniyor: 0, desteklenmiyor: 1, "hile-korumali": 2 } as const;

function durumBul(appId: number | undefined, klasorAdi: string): Pick<BulunanOyun, "durum" | "tanim"> {
  if (hileKorumaliMi(appId, klasorAdi)) return { durum: "hile-korumali" };
  const tanim = tanimBul(appId, klasorAdi);
  return tanim ? { durum: "destekleniyor", tanim } : { durum: "desteklenmiyor" };
}

function klasorMu(y: string): boolean {
  try {
    return statSync(y).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Klasör gerçek bir oyun kurulumu mu, yoksa kaldırılmış oyunun artığı mı? Gerçek kurulumda (3 kat
 * derinliğe kadar) en az bir .exe ve 30'dan fazla dosya olur. Erken durur; büyük oyunlarda da hızlıdır.
 */
export function gercekKurulumMu(klasor: string): boolean {
  let dosya = 0;
  let exe = false;
  const tara = (k: string, derinlik: number): boolean => {
    let girdiler;
    try {
      girdiler = readdirSync(k, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const g of girdiler) {
      if (g.isFile()) {
        dosya++;
        if (g.name.toLowerCase().endsWith(".exe")) exe = true;
      } else if (g.isDirectory() && derinlik < 3 && tara(join(k, g.name), derinlik + 1)) return true;
      if (exe && dosya > 30) return true;
    }
    return false;
  };
  return tara(klasor, 0);
}

/** Klasördeki steam_appid.txt'den Steam oyun numarası (görseller ve hile koruması denetimi için). */
function steamKimligiOku(klasor: string): number | undefined {
  try {
    const id = Number(readFileSync(join(klasor, "steam_appid.txt"), "utf8").replace(/\0/g, "").trim());
    return Number.isInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

export function oyunlariTara(kutuphaneler: string[], steamKlasoru?: string): BulunanOyun[] {
  const bulunan: BulunanOyun[] = [];
  const gorulen = new Set<string>();
  const ekle = (appId: number | undefined, ad: string, klasor: string, klasorAdi: string) => {
    const k = klasor.toLowerCase();
    if (gorulen.has(k)) return;
    gorulen.add(k);
    const gorseller = steamKlasoru && appId !== undefined ? gorselleriBul(steamKlasoru, appId) : {};
    bulunan.push({ appId, ad, klasor, ...durumBul(appId, klasorAdi), gorseller, platform: "steam" });
  };
  for (const kutuphane of kutuphaneler) {
    const steamapps = join(kutuphane, "steamapps");
    const common = join(steamapps, "common");
    if (!existsSync(common)) continue;
    for (const dosya of readdirSync(steamapps).filter((d) => /^appmanifest_\d+\.acf$/.test(d))) {
      let v: ReturnType<typeof vdfOku>;
      try {
        v = vdfOku(readFileSync(join(steamapps, dosya), "utf8"));
      } catch {
        continue;
      }
      const s = v.AppState;
      if (typeof s !== "object" || typeof s.installdir !== "string") continue;
      const appId = Number(s.appid);
      if (ARAC_KIMLIKLERI.has(appId)) {
        gorulen.add(join(common, s.installdir).toLowerCase());
        continue;
      }
      const klasor = join(common, s.installdir);
      if (!existsSync(klasor)) continue;
      ekle(appId, typeof s.name === "string" ? s.name : s.installdir, klasor, s.installdir);
    }
    // Manifesti olmayan klasörler: çoğu kaldırılmış oyunlardan kalan artıktır (ayar, kayıt, günlük dosyası).
    // Yalnızca gerçekten kurulu görünenler (ya da Türkçesi hazır bir oyunun klasörü) listelenir.
    for (const ad of readdirSync(common)) {
      const klasor = join(common, ad);
      if (gorulen.has(klasor.toLowerCase()) || ARAC_KLASORLERI.has(ad.toLowerCase()) || !klasorMu(klasor)) continue;
      // Adı desteklenen bir oyunla aynı olan artık klasör (kaldırılmış oyun) "Türkçesi hazır" sayılmaz: dosyaları da aranır.
      const t = tanimBul(undefined, ad);
      const tanindi = t !== undefined && t.tanimaDosyalari.every((d) => existsSync(join(klasor, d)));
      if (!tanindi && !gercekKurulumMu(klasor)) continue;
      ekle(steamKimligiOku(klasor), ad, klasor, ad);
    }
  }
  return bulunan.sort((a, b) => DURUM_SIRASI[a.durum] - DURUM_SIRASI[b.durum] || a.ad.localeCompare(b.ad, "tr"));
}

const YENI_ADLAR: Record<string, keyof OyunGorselleri> = {
  "library_capsule.jpg": "kapak",
  "library_600x900.jpg": "kapak",
  "library_hero.jpg": "afis",
  "logo.png": "logo",
  "library_header.jpg": "baslik",
  "header.jpg": "baslik",
};

/** Steam'in kendi yerel önbelleğindeki görseller (appcache/librarycache). Hiçbir şey indirmez. */
export function gorselleriBul(steamKlasoru: string, appId: number): OyunGorselleri {
  const onbellek = join(steamKlasoru, "appcache", "librarycache");
  const g: OyunGorselleri = {};
  const ata = (tur: keyof OyunGorselleri, yol: string) => {
    if (!g[tur]) g[tur] = yol;
  };
  // Yeni düzen: librarycache/<appId>/<özet>/library_capsule.jpg …
  const klasor = join(onbellek, String(appId));
  if (existsSync(klasor)) {
    const tara = (k: string, derinlik: number) => {
      for (const ad of readdirSync(k)) {
        const y = join(k, ad);
        if (klasorMu(y)) {
          if (derinlik < 2) tara(y, derinlik + 1);
        } else if (YENI_ADLAR[ad]) ata(YENI_ADLAR[ad]!, y);
      }
    };
    tara(klasor, 0);
  }
  // Eski düzen: librarycache/<appId>_library_600x900.jpg …
  const eski: [string, keyof OyunGorselleri][] = [
    [`${appId}_library_600x900.jpg`, "kapak"],
    [`${appId}_library_hero.jpg`, "afis"],
    [`${appId}_logo.png`, "logo"],
    [`${appId}_header.jpg`, "baslik"],
  ];
  for (const [ad, tur] of eski) if (existsSync(join(onbellek, ad))) ata(tur, join(onbellek, ad));
  return g;
}

/** Steam'in herkese açık görsel sunucusu (yalnızca arayüzün `<img>` etiketleri kullanır). */
export const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";

/**
 * Yerel önbellekte olmayan görseller için Steam'in görsel sunucusundaki adresler. İstekte yalnızca
 * oyun numarası gider; bazı yeni oyunlarda dosya yoksa arayüz yer tutucuya düşer.
 */
export function steamCdnGorselleri(appId: number): Required<OyunGorselleri> {
  const a = `${STEAM_CDN}/steam/apps/${appId}`;
  return { kapak: `${a}/library_600x900.jpg`, afis: `${a}/library_hero.jpg`, logo: `${a}/logo.png`, baslik: `${a}/header.jpg` };
}
