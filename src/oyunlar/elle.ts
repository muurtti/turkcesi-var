// Oyun otomatik bulunamazsa kullanıcının seçtiği klasör: hangi desteklenen oyun olduğunu tanır, seçimi hatırlar.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { OYUNLAR, type OyunTanimi } from "./tanim.js";

export interface ElleKlasor {
  kimlik: string;
  klasor: string;
}

const DOSYA = "klasorler.json";

function buOyunMu(t: OyunTanimi, klasor: string): boolean {
  if (!t.tanimaDosyalari.every((d) => existsSync(join(klasor, d)))) return false;
  // Aynı motoru kullanan kardeş oyunlar aynı dosya adlarına sahip olabilir: Steam kimliği varsa o karar verir.
  const kimlikDosyasi = join(klasor, "steam_appid.txt");
  if (existsSync(kimlikDosyasi)) {
    const id = Number(readFileSync(kimlikDosyasi, "utf8").trim());
    if (Number.isFinite(id) && id > 0 && id !== t.steamAppId) return false;
  }
  return true;
}

function altKlasorler(k: string): string[] {
  try {
    return readdirSync(k)
      .map((a) => join(k, a))
      .filter((y) => {
        try {
          return statSync(y).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/** Seçilen klasörü ya da içindeki (en çok 3 kat aşağı) klasörleri desteklenen oyunlarla eşleştirir. */
export function klasorTani(secilen: string): { tanim: OyunTanimi; klasor: string } | undefined {
  let katman = [secilen];
  for (let derinlik = 0; derinlik <= 3 && katman.length > 0; derinlik++) {
    for (const k of katman) {
      for (const t of OYUNLAR) if (buOyunMu(t, k)) return { tanim: t, klasor: k };
    }
    katman = katman.flatMap(altKlasorler).slice(0, 2000);
  }
  return undefined;
}

/**
 * Seçilen klasör kabul edilmediğinde kullanıcıya gösterilecek açıklama.
 * `aranan`: belirli bir oyunun kartından seçildiyse o oyun; genel "Klasör seç" düğmesinde undefined.
 */
export function secimHatasi(secilen: string, aranan?: OyunTanimi): string {
  const ad = basename(secilen) || secilen;
  if (aranan) {
    return (
      `"${ad}" klasörü ${aranan.ad} klasörü değil. İçinde ${aranan.tanimaDosyalari.join(", ")} olan klasörü seç ` +
      `(Steam'de genellikle …\\steamapps\\common\\${aranan.klasorAdi}; Steam dışından kurduysan oyunu kurduğun klasör).`
    );
  }
  return (
    `"${ad}" klasöründe Türkçesi hazır bir oyun bulunamadı. Şu an Türkçesi hazır oyunlar: ${OYUNLAR.map((t) => t.ad).join(", ")}. ` +
    "Yeni oyunlar uygulama güncellendikçe eklenecek."
  );
}

export function elleKlasorleriOku(uygulamaKlasoru: string): ElleKlasor[] {
  try {
    const x = JSON.parse(readFileSync(join(uygulamaKlasoru, DOSYA), "utf8")) as ElleKlasor[];
    return Array.isArray(x) ? x.filter((e) => typeof e.kimlik === "string" && typeof e.klasor === "string") : [];
  } catch {
    return [];
  }
}

export function elleKlasorEkle(uygulamaKlasoru: string, e: ElleKlasor): void {
  const liste = elleKlasorleriOku(uygulamaKlasoru);
  if (liste.some((x) => x.kimlik === e.kimlik && x.klasor.toLowerCase() === e.klasor.toLowerCase())) return;
  mkdirSync(uygulamaKlasoru, { recursive: true });
  writeFileSync(join(uygulamaKlasoru, DOSYA), JSON.stringify([...liste, e], null, 1), "utf8");
}
