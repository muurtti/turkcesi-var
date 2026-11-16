// Değişen dosyaları yeni bir VFS paketine koyar ve dizini onlara yönlendirir.
// Orijinal content*.vfs* dosyalarına hiç dokunulmaz. Biçim: docs/notlar/4a-vfx-bicimi.md

import { IkiliYazici } from "../../ortak/ikili.js";
import { vfxYaz, type VfxDizin, type VfxGirdi } from "./vfx.js";

export interface YamaPaketi {
  yeniVfx: Buffer;
  paketAdi: string;
  paketIcerik: Buffer;
}

function sonrakiPaketAdi(d: VfxDizin): string {
  let enBuyuk = -1;
  for (const p of d.paketler) {
    const m = /^content(\d+)\.vfs\d+$/i.exec(p.ad);
    if (m) enBuyuk = Math.max(enBuyuk, Number(m[1]));
  }
  return `content${String(enBuyuk + 1).padStart(2, "0")}.vfs0`;
}

/**
 * Exodus (sürüm 3): paket kaydının son alanı bayt boyutu değil grup numarasıdır (content_03.vfs0/1/2 → 3).
 * Yama paketi yeni bir grup olur: content_<N>.vfs0, grup N, klasörler değişen dosyanın paketininkiyle aynı
 * (ör. "m3\000": temel içerikle birlikte her zaman yüklenir).
 */
function exodusPaketi(d: VfxDizin, ilkDegisen: VfxGirdi): { ad: string; grup: number; klasorler: string[] } {
  const grup = Math.max(...d.paketler.map((p) => p.boyut)) + 1;
  return { ad: `content_${String(grup).padStart(2, "0")}.vfs0`, grup, klasorler: [...(d.paketler[ilkDegisen.paketNo]?.klasorler ?? [])] };
}

/**
 * `degisenler`: dizindeki yol ("content/localization/stable_us.lng") → yeni (açık) içerik.
 * Dosyalar sıkıştırılmadan saklanır (boyut = sıkıştırılmış boyut; oyun küçük dosyaları da böyle okur).
 */
export function yamaPaketiOlustur(d: VfxDizin, degisenler: Map<string, Buffer>): YamaPaketi {
  const yollar = new Map(d.dosyalar.map((g) => [g.yol.toLowerCase(), g]));
  const paketNo = d.paketler.length;
  const ilkYol = degisenler.keys().next().value;
  const ilkDegisen = ilkYol === undefined ? undefined : yollar.get(ilkYol.toLowerCase().replaceAll("\\", "/"));
  const exodus = d.surum[0] >= 3 && ilkDegisen ? exodusPaketi(d, ilkDegisen) : undefined;
  const paketAdi = exodus?.ad ?? sonrakiPaketAdi(d);

  const veri = new IkiliYazici();
  veri.u32(0);
  veri.u32(0); // veri uzunluğu, sonra doldurulur
  const yeniKonum = new Map<number, { ofset: number; boyut: number }>();
  for (const [yol, icerik] of degisenler) {
    const g = yollar.get(yol.toLowerCase().replaceAll("\\", "/"));
    if (!g) throw new Error(`Yama: dizinde bulunamadı: ${yol}`);
    yeniKonum.set(g.sira, { ofset: veri.konum, boyut: icerik.length });
    veri.bayt(icerik);
  }
  const veriSonu = veri.konum;
  veri.u32(3);
  veri.u32(16);
  veri.bayt(d.guid);
  const paketIcerik = veri.sonuc();
  paketIcerik.writeUInt32LE(veriSonu - 8, 4);

  const kayitlar = d.kayitlar.map((k) => {
    const yeni = yeniKonum.get(k.sira);
    if (!yeni || k.tur !== "dosya") return k;
    return { ...k, paketNo, ofset: yeni.ofset, boyut: yeni.boyut, sikistirilmisBoyut: yeni.boyut } satisfies VfxGirdi;
  });
  const kopyalar = d.kopyalar.map((k) => {
    const yeni = yeniKonum.get(k.kayitSirasi);
    return yeni ? { ...k, paketNo, ofset: yeni.ofset, boyut: yeni.boyut, sikistirilmisBoyut: yeni.boyut } : k;
  });
  const yeniPaket = exodus
    ? { ad: paketAdi, klasorler: exodus.klasorler, boyut: exodus.grup }
    : { ad: paketAdi, klasorler: [...(d.paketler[0]?.klasorler ?? [])], boyut: paketIcerik.length };
  const paketler = [...d.paketler, yeniPaket];

  const yeniVfx = vfxYaz({
    ...d,
    paketler,
    kayitlar,
    dosyalar: kayitlar.filter((k): k is VfxGirdi => k.tur === "dosya"),
    kopyalar,
  });
  return { yeniVfx, paketAdi, paketIcerik };
}
