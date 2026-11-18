// Mafia: The Old Country (Unreal Engine 5) tanımı. Türkçe, oyunun İngilizce metin tablosunun yerine geçen
// küçük bir ek pak olarak kurulur; oyunun kendi dosyalarına dokunulmaz.

import type { TanimUe5 } from "./tanim.js";

export const MAFIA_THE_OLD_COUNTRY: TanimUe5 = {
  kimlik: "mafiatheoldcountry",
  ad: "Mafia: The Old Country",
  steamAppId: 1941540,
  klasorAdi: "Mafia The Old Country",
  motor: "ue5",
  tanimaDosyalari: ["MafiaTheOldCountry/Binaries/Win64/MafiaTheOldCountry.exe", "MafiaTheOldCountry/Content/Paks/pakchunk0-Windows.pak"],
  surecAdi: "MafiaTheOldCountry.exe",
  pakYolu: "MafiaTheOldCountry/Content/Paks/pakchunk0-Windows_TurkcesiVar_P.pak",
  mount: "../../../MafiaTheOldCountry/Content/Localization/Game/en/",
};
