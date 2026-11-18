// Metro Last Light Redux (4A Engine) tanımı.
// İki Redux oyunu aynı yerelleştirme tablosunu kullanır (stable_us.lng'nin anahtarları ve İngilizcesi birebir
// aynı), bu yüzden okuma/yamalama Metro 2033 Redux'unkiyle aynıdır ve çeviri paketi ortaktır. Yedek ayrıdır.

import { METRO_2033_REDUX } from "./metro2033redux.js";
import type { Tanim4A } from "./tanim.js";

export const METRO_LAST_LIGHT_REDUX: Tanim4A = {
  ...METRO_2033_REDUX,
  kimlik: "metrolastlightredux",
  ad: "Metro Last Light Redux",
  steamAppId: 287390,
  klasorAdi: "Metro Last Light Redux",
  // Videolar (outro_good.ogv) yalnız Last Light'ta, "2033" klasörü yalnız Metro 2033 Redux'ta bulunur.
  tanimaDosyalari: ["metro.exe", "content.vfx", "outro_good.ogv"],
  temizDizinOzeti: "be4bfff4b62d18563ba64693126f623a1479bf6f71ef1415c14b3bb320bf9428",
  paketKimligi: "metro2033redux",
};
