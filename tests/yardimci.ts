import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STEAM_VARSAYILAN = "C:/Program Files (x86)/Steam/steamapps/common/Metro 2033 Redux";

/**
 * Gerçek oyun dosyası isteyen testler bu klasörü kullanır; yoksa atlanır. Testler buraya ASLA yazmaz.
 * METRO_DIR verilmezse standart Steam konumu denenir.
 */
export const METRO_DIR = process.env.METRO_DIR ?? (existsSync(STEAM_VARSAYILAN) ? STEAM_VARSAYILAN : "");
export const metroYok = !METRO_DIR || !existsSync(METRO_DIR);

/**
 * Oyunun ORİJİNAL dizini: Türkçe yama kuruluysa yedekteki content.vfx, değilse oyundaki.
 * Büyük .vfs paketleri yama tarafından hiç değiştirilmediği için testler oyunun o anki durumundan bağımsızdır.
 */
function orijinalVfx(): Buffer {
  if (metroYok) return Buffer.alloc(0);
  const appdata = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  const yedek = join(appdata, "turkcesi-var", "yedekler", "metro2033redux", "orijinal", "content.vfx");
  return readFileSync(existsSync(yedek) ? yedek : join(METRO_DIR, "content.vfx"));
}
export const METRO_VFX = orijinalVfx();

const EXODUS_VARSAYILAN = "C:/Program Files (x86)/Steam/steamapps/common/Metro Exodus Enhanced Edition";
/** Metro Exodus (Enhanced Edition) klasörü; yoksa bu testler atlanır. Testler buraya ASLA yazmaz. */
export const EXODUS_DIR = process.env.EXODUS_DIR ?? (existsSync(EXODUS_VARSAYILAN) ? EXODUS_VARSAYILAN : "");
export const exodusYok = !EXODUS_DIR || !existsSync(join(EXODUS_DIR, "content.vfx"));
/** Exodus'un ORİJİNAL dizini: Türkçe yama kuruluysa yedekteki content.vfx, değilse oyundaki. */
export function exodusVfx(): Buffer {
  if (exodusYok) return Buffer.alloc(0);
  const appdata = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  const yedek = join(appdata, "turkcesi-var", "yedekler", "metroexodus", "orijinal", "content.vfx");
  return readFileSync(existsSync(yedek) ? yedek : join(EXODUS_DIR, "content.vfx"));
}
