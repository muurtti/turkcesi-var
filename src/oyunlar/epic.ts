// Epic Games Launcher'da kurulu oyunlar. Epic her kurulum için
// %ProgramData%\Epic\EpicGamesLauncher\Data\Manifests\*.item (JSON) dosyası tutar. Yalnızca okunur.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { klasorTani } from "./elle.js";
import { hileKorumaliMi } from "./hile-korumali.js";
import type { BulunanOyun } from "./steam.js";

export function epicManifestKlasoru(): string {
  return join(process.env.ProgramData ?? "C:\\ProgramData", "Epic", "EpicGamesLauncher", "Data", "Manifests");
}

interface EpicManifest {
  DisplayName?: string;
  InstallLocation?: string;
  bIsApplication?: boolean;
  bIsIncompleteInstall?: boolean;
  AppCategories?: string[];
}

function klasorMu(y: string): boolean {
  try {
    return statSync(y).isDirectory();
  } catch {
    return false;
  }
}

export function epicOyunlariTara(manifestKlasoru = epicManifestKlasoru()): BulunanOyun[] {
  if (!existsSync(manifestKlasoru)) return [];
  const bulunan: BulunanOyun[] = [];
  const gorulen = new Set<string>();
  let dosyalar: string[];
  try {
    dosyalar = readdirSync(manifestKlasoru).filter((d) => d.toLowerCase().endsWith(".item"));
  } catch {
    return [];
  }
  for (const dosya of dosyalar) {
    // Her kayıt ayrı işlenir: biri bozuksa yalnızca o atlanır (Steam oyunları ve diğer Epic oyunları kaybolmaz).
    try {
      const ham: unknown = JSON.parse(readFileSync(join(manifestKlasoru, dosya), "utf8"));
      if (typeof ham !== "object" || ham === null || Array.isArray(ham)) continue;
      const m = ham as EpicManifest;
      const yer = m.InstallLocation;
      if (typeof yer !== "string" || !yer || m.bIsIncompleteInstall === true) continue;
      const kategoriler = Array.isArray(m.AppCategories) ? m.AppCategories.filter((k): k is string => typeof k === "string").map((k) => k.toLowerCase()) : [];
      // Motorlar (Unreal Engine) ve eklentiler oyun değildir.
      if (kategoriler.some((k) => k.startsWith("engines") || k.startsWith("plugins"))) continue;
      if (m.bIsApplication !== true && !kategoriler.includes("games")) continue;
      if (!klasorMu(yer) || gorulen.has(yer.toLowerCase())) continue;
      gorulen.add(yer.toLowerCase());

      const ad = typeof m.DisplayName === "string" && m.DisplayName.trim() ? m.DisplayName.trim() : basename(yer);
      const tanin = klasorTani(yer);
      const tanim = tanin && tanin.klasor.toLowerCase() === yer.toLowerCase() ? tanin.tanim : undefined;
      const durum = hileKorumaliMi(undefined, ad) || hileKorumaliMi(undefined, basename(yer)) ? "hile-korumali" : tanim ? "destekleniyor" : "desteklenmiyor";
      bulunan.push({ ad, klasor: yer, durum, ...(tanim && durum === "destekleniyor" ? { tanim } : {}), gorseller: {}, platform: "epic" });
    } catch {
      continue;
    }
  }
  return bulunan;
}
