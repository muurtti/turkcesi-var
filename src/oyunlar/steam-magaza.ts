// Epic gibi görsel önbelleği olmayan kaynaklardaki oyunlar için: oyunun adını Steam mağazasında arayıp
// aynı oyunun Steam numarasını bulur (görseller Steam'in görsel sunucusundan gelir). İstekte yalnızca
// oyunun adı gider. Sonuçlar %APPDATA%\turkcesi-var\magaza-onbellek.json'da saklanır; aynı ad bir daha sorulmaz.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DOSYA = "magaza-onbellek.json";
const ADRES = "https://store.steampowered.com/api/storesearch/";

/** Karşılaştırma için ad: küçük harf, ™®© yok, noktalama boşluk, tek boşluk. */
export function adNormal(ad: string): string {
  return ad
    .replace(/[™®©]/g, "") // NFKD'den ÖNCE: yoksa ™ "TM" harflerine dönüşür
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // aksan/nokta işaretleri ("İ" → "i̇" → "i") ad bölünmesin
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function onbellekOku(klasor: string): Record<string, number | null> {
  try {
    return JSON.parse(readFileSync(join(klasor, DOSYA), "utf8")) as Record<string, number | null>;
  } catch {
    return {};
  }
}

export async function steamKimligiAra(ad: string, onbellekKlasoru: string, getir: typeof fetch = fetch): Promise<number | undefined> {
  const anahtar = adNormal(ad);
  if (!anahtar) return undefined;
  const onbellek = onbellekOku(onbellekKlasoru);
  if (anahtar in onbellek) return onbellek[anahtar] ?? undefined;
  let bulunan: number | null = null;
  try {
    const y = await getir(`${ADRES}?term=${encodeURIComponent(ad)}&l=english&cc=US`, { signal: AbortSignal.timeout(5000) });
    if (!y.ok) return undefined;
    const j = (await y.json()) as { items?: { type?: string; name?: string; id?: number }[] };
    const e = (j.items ?? []).find((x) => x.type === "app" && typeof x.id === "number" && adNormal(x.name ?? "") === anahtar);
    bulunan = e?.id ?? null;
  } catch {
    return undefined; // internet yok: saklama, bir dahaki açılışta yeniden dene
  }
  try {
    mkdirSync(onbellekKlasoru, { recursive: true });
    // Aynı anda süren aramalar birbirinin sonucunu ezmesin: yazmadan hemen önce güncel hâli yeniden oku.
    writeFileSync(join(onbellekKlasoru, DOSYA), JSON.stringify({ ...onbellekOku(onbellekKlasoru), [anahtar]: bulunan }, null, 1), "utf8");
  } catch {
    /* saklanamadıysa sorun değil */
  }
  return bulunan ?? undefined;
}
