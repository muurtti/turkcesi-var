// Komut satırı araçlarının ortak parçaları (deneme.ts, cevir.ts).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { METRO_2033_REDUX } from "../src/oyunlar/metro2033redux.js";
import { METRO_EXODUS } from "../src/oyunlar/metroexodus.js";
import { depoKlasoru, ortakBellekYolu, yedekKlasoru, type OyunTanimi } from "../src/oyunlar/tanim.js";
import { yedekKlasoruSec } from "../src/ortak/yedek.js";

/** Oyun seçimi: OYUN_KIMLIK=metroexodus (varsayılan metro2033redux). Klasör: OYUN_DIR (eski adı METRO_DIR). */
const TANIMLAR: Record<string, OyunTanimi> = { metro2033redux: METRO_2033_REDUX, metroexodus: METRO_EXODUS };
const kimlik = process.env.OYUN_KIMLIK ?? "metro2033redux";
if (!TANIMLAR[kimlik]) throw new Error(`Bilinmeyen OYUN_KIMLIK: ${kimlik} (seçenekler: ${Object.keys(TANIMLAR).join(", ")})`);
export const TANIM = TANIMLAR[kimlik];
export const OYUN = process.env.OYUN_DIR ?? process.env.METRO_DIR ?? `C:/Program Files (x86)/Steam/steamapps/common/${TANIM.klasorAdi}`;
export const YEDEK = yedekKlasoruSec(yedekKlasoru(TANIM), OYUN);
export const DEPO = depoKlasoru(TANIM);
/** Oyunlar arası ortak çeviri belleği (bütün oyunlar paylaşır). */
export const ORTAK_BELLEK = ortakBellekYolu();
export const TEMIZ_VFX = TANIM.temizDizinOzeti; // docs/notlar/metro-temiz-kurulum.md

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export function oyunAcikMi(): boolean {
  try {
    const cikti = execFileSync("tasklist", ["/FI", `IMAGENAME eq ${TANIM.surecAdi}`, "/NH"], { encoding: "utf8" });
    return cikti.toLowerCase().includes(TANIM.surecAdi.toLowerCase());
  } catch {
    return false;
  }
}

export function oyunKapaliOlmali(): void {
  if (oyunAcikMi()) {
    console.error(`${TANIM.ad} şu an açık. Lütfen oyunu kapatıp tekrar deneyin.`);
    process.exit(1);
  }
}

/** Yama kuruluysa yedekteki orijinal dizin, değilse oyundaki dizin. */
export function orijinalVfx(): Buffer {
  const yedekte = join(YEDEK, "orijinal", "content.vfx");
  return readFileSync(existsSync(yedekte) ? yedekte : join(OYUN, "content.vfx"));
}

export function durum(): void {
  if (!existsSync(join(OYUN, "content.vfx"))) {
    console.log(`Oyun bulunamadı: ${OYUN}`);
    return;
  }
  const vfx = sha256(readFileSync(join(OYUN, "content.vfx")));
  console.log(`Oyun klasörü  : ${OYUN}`);
  console.log(`Yedek klasörü : ${YEDEK}`);
  console.log(`Yama kurulu   : ${existsSync(join(YEDEK, "kayit.json")) ? "evet" : "hayır"}`);
  const yedekteki = join(YEDEK, "orijinal", "content.vfx");
  const temiz = TEMIZ_VFX ?? (existsSync(yedekteki) ? sha256(readFileSync(yedekteki)) : undefined);
  console.log(`content.vfx   : ${temiz === undefined ? "(karşılaştırılacak özet yok)" : vfx === temiz ? "temiz (orijinal)" : "orijinalden farklı (yamalı)"}`);
  const ek = TANIM.kimlik === "metroexodus" ? "content_53.vfs0" : "content28.vfs0";
  console.log(`${ek.padEnd(14)}: ${existsSync(join(OYUN, ek)) ? "var" : "yok"}`);
}
