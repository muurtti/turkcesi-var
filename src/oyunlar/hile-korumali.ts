// Hile koruması (anti-cheat) olan çevrimiçi oyunlar: dosyalarını değiştirmek hesap yasağına yol açabilir.
// Bu oyunlara asla dokunulmaz (spec §4).

const STEAM_KIMLIKLERI = new Set<number>([
  730, // Counter-Strike 2
  1422450, // Deadlock
  594650, // Hunt: Showdown 1896
  1172470, // Apex Legends
  578080, // PUBG: Battlegrounds
  252490, // Rust
  570, // Dota 2
  359550, // Tom Clancy's Rainbow Six Siege
  1938090, // Call of Duty
  2357570, // Overwatch 2
  1599340, // Lost Ark
  440, // Team Fortress 2
  271590, // GTA V (çevrimiçi)
]);

/** Steam dışından ya da kimliği bilinmeden bulunan klasör adları (küçük harfle, başından eşleşir). */
const KLASOR_ONEKLERI = [
  "escape from tarkov", "fivem", "ea sports fc", "fc 2", "valorant", "fortnite", "counter-strike", "csgo",
  "deadlock", "hunt showdown", "hunt: showdown", "pubg", "playerunknown", "apex legends", "rainbow six",
  "call of duty", "overwatch", "dota 2", "battlefield", "destiny 2", "lost ark", "the finals", "naraka",
  // Epic Games'te sık görülenler
  "rocket league", "rocketleague", "fall guys", "fallguys", "grand theft auto v", "gtav", "dead by daylight",
  "rogue company", "multiversus", "splitgate", "the cycle",
];
/** Başka adların başlangıcı olabilecek kısa adlar: yalnızca tam eşleşme ("Rust" evet, "Rusty Lake" hayır). */
const KLASOR_TAM = new Set(["rust", "warframe", "paladins", "smite"]);

export function hileKorumaliMi(appId: number | undefined, klasorAdi: string): boolean {
  if (appId !== undefined && STEAM_KIMLIKLERI.has(appId)) return true;
  const k = klasorAdi.toLowerCase().trim();
  return KLASOR_TAM.has(k) || KLASOR_ONEKLERI.some((o) => k.startsWith(o));
}
