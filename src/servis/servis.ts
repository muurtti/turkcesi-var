// Oyuncu uygulamasının iş mantığı: hazır Türkçe paketle oyunun durumunu söyler, Türkçeyi kurar ve kaldırır.
// Oyun klasörüne yalnızca src/ortak/yedek.ts yazar.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { bosDepo, depoOku, uygulanabilirCeviriler, type CeviriDeposu } from "../ceviri/depo.js";
import { ceviriSorunlari } from "../ceviri/dogrula.js";
import { paketiDepoyaAl, type CeviriPaketi } from "../ceviri/paket.js";
import { kaynakOzeti, type CeviriSatiri } from "../ceviri/satirlar.js";
import { uePaketCevirileri, ueYamaHazirla } from "../motorlar/ue/turkce-yama.js";
import { katmanSirala, paketKimligi, type Katman, type OyunTanimi, type Tanim4A, type TanimUe5 } from "../oyunlar/tanim.js";
import { DegismisHatasi, geriYukle, uygula, yamaDurumu, yamayiUnut, yedekKlasoruSec } from "../ortak/yedek.js";
import type { Ilerleme, OyunDurumu } from "./tipler.js";

export interface ServisSecenekleri {
  uygulamaKlasoru: string;
  /** Oyunun süreç adıyla çalışıp çalışmadığı (Windows'ta tasklist). */
  oyunAcikMi?: (surecAdi: string) => boolean;
  /** Uygulamayla gelen hazır çeviri paketlerinin klasörü (`<kimlik>.tr.json`). */
  paketKlasoru?: string;
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const OYUN_ACIK = "Oyun şu an açık. Lütfen önce oyunu kapatın, sonra tekrar deneyin.";
const CEVIRI_YOK = "Bu oyun için Türkçe çeviri bulunamadı. Uygulamayı güncelleyip tekrar deneyin.";
/** Yedek klasöründe, oyuna en son hangi hazır paketin kurulduğunu tutan not. */
const KURULU_PAKET = "kurulu-paket.json";

interface Kaynak {
  satirlar: CeviriSatiri[];
  kullanilabilir: Set<string>;
  vfx: Buffer;
  /** Güncelleme dizinlerinin orijinalleri (yalnızca tanımda `katmanlar` varsa). */
  katmanlar: Katman[];
}

/**
 * Aynı paketi paylaşan sürüm (ör. Metro Exodus normal ↔ EE): adı paketteki adla tutmayan satır, İngilizce metni
 * birebir aynı bir satırın çevirisini alır. Paketin kendi oyununda değişiklik yapılmaz.
 */
function ozetleEsle(d: CeviriDeposu, satirlar: CeviriSatiri[]): CeviriDeposu {
  const ozettenSatir = new Map<string, CeviriDeposu["satirlar"][string]>();
  for (const x of Object.values(d.satirlar)) if (x.tr.trim() !== "" && !ozettenSatir.has(x.kaynakOzeti)) ozettenSatir.set(x.kaynakOzeti, x);
  const yeni: CeviriDeposu = { ...d, satirlar: { ...d.satirlar } };
  for (const s of satirlar) {
    const oz = kaynakOzeti(s.en);
    const mevcut = yeni.satirlar[s.anahtar];
    if (mevcut && mevcut.kaynakOzeti === oz && mevcut.tr.trim() !== "") continue;
    const es = ozettenSatir.get(oz);
    if (es) yeni.satirlar[s.anahtar] = es;
  }
  return yeni;
}

export class Servis {
  private kaynakOnbellegi = new Map<string, Kaynak>();
  private paketOnbellegi = new Map<string, CeviriPaketi | null>();

  constructor(private readonly s: ServisSecenekleri) {}

  /** Bu kurulumun yedek klasörü (aynı oyunun Steam ve Epic kurulumları ayrı yedeklenir). */
  private yedek(t: OyunTanimi, klasor: string) {
    return yedekKlasoruSec(join(this.s.uygulamaKlasoru, "yedekler", t.kimlik), klasor);
  }

  /** Uygulamayla gelen hazır paket (yoksa undefined). */
  private hazirPaket(t: OyunTanimi): CeviriPaketi | undefined {
    if (!this.s.paketKlasoru) return undefined;
    const kimlik = paketKimligi(t);
    if (!this.paketOnbellegi.has(kimlik)) {
      const y = join(this.s.paketKlasoru, `${kimlik}.tr.json`);
      let p: CeviriPaketi | null = null;
      if (existsSync(y)) {
        p = JSON.parse(readFileSync(y, "utf8")) as CeviriPaketi;
        if (p.oyun !== kimlik) p = null;
      }
      this.paketOnbellegi.set(kimlik, p);
    }
    return this.paketOnbellegi.get(kimlik) ?? undefined;
  }

  /**
   * Oyuna konacak çeviriler: hazır paket; bu bilgisayarda geliştiricinin çeviri deposu varsa
   * (`%APPDATA%\turkcesi-var\ceviriler`) oradaki satırlar paketin önüne geçer. Oyuncuda depo yoktur.
   */
  private kurulacakDepo(t: Tanim4A, satirlar: CeviriSatiri[]): CeviriDeposu {
    const kimlik = paketKimligi(t);
    const yerel = depoOku(join(this.s.uygulamaKlasoru, "ceviriler", kimlik)) ?? bosDepo(kimlik, "");
    const p = this.hazirPaket(t);
    let d = yerel;
    if (p) {
      d = paketiDepoyaAl(p);
      for (const [a, x] of Object.entries(yerel.satirlar)) if (x.tr.trim() !== "") d.satirlar[a] = x;
    }
    return t.paketKimligi ? ozetleEsle(d, satirlar) : d;
  }

  private oyunKapaliOlmali(t: OyunTanimi) {
    if (this.s.oyunAcikMi?.(t.surecAdi)) throw new Error(OYUN_ACIK);
  }

  /** Kaynak metin her zaman ORİJİNAL dizinden (yama kuruluysa yedekten) okunur; özetle önbelleğe alınır. */
  private kaynak(t: Tanim4A, klasor: string): Kaynak {
    const orijinal = (ad: string) => {
      const yedekte = join(this.yedek(t, klasor), "orijinal", ad);
      return existsSync(yedekte) ? yedekte : join(klasor, ad);
    };
    const vfx = readFileSync(orijinal("content.vfx"));
    const desen = t.katmanDeseni;
    const katmanlar: Katman[] = desen
      ? katmanSirala(readdirSync(klasor).filter((ad) => desen.test(ad))).map((ad) => ({ ad, vfx: readFileSync(orijinal(ad)) }))
      : [];
    const anahtar = [t.kimlik, klasor, sha256(vfx), ...katmanlar.map((k) => sha256(k.vfx))].join("|");
    let k = this.kaynakOnbellegi.get(anahtar);
    if (!k) {
      k = { ...t.kaynak(klasor, vfx, katmanlar), vfx, katmanlar };
      this.kaynakOnbellegi.set(anahtar, k);
    }
    return k;
  }

  /** Unreal oyunu: kaç satır kurulabilir (oyunun dosyaları okunmaz; satırlar hazır paketten). */
  private ueCevirileri(t: TanimUe5) {
    const p = this.hazirPaket(t);
    return { p, ceviriler: p ? uePaketCevirileri(p) : new Map() };
  }

  oyunDurumu(t: OyunTanimi, klasor: string): OyunDurumu {
    if (t.motor === "ue5") {
      const { p, ceviriler } = this.ueCevirileri(t);
      const n = ceviriler.size;
      const yama = yamaDurumu(klasor, this.yedek(t, klasor));
      return {
        tanim: { kimlik: t.kimlik, ad: t.ad },
        klasor,
        yama,
        ceviri: { toplam: n, cevrili: n, sorunlu: 0, uygulanabilir: n },
        ...(p ? { paket: { tarih: p.tarih, satir: Object.keys(p.satirlar).length } } : {}),
        ...(p && yama === "kurulu" && this.kuruluPaketTarihi(t, klasor) !== p.tarih ? { ceviriEski: true } : {}),
      };
    }
    const { satirlar, kullanilabilir } = this.kaynak(t, klasor);
    const d = this.kurulacakDepo(t, satirlar);
    const sec = uygulanabilirCeviriler(d, satirlar, kullanilabilir);
    const p = this.hazirPaket(t);
    let cevrili = 0;
    let sorunlu = 0;
    for (const s of satirlar) {
      const x = d.satirlar[s.anahtar];
      if (!x || x.kaynakOzeti !== kaynakOzeti(s.en) || x.tr.trim() === "") continue;
      cevrili++;
      if (x.not || ceviriSorunlari(s, x.tr, kullanilabilir).length > 0) sorunlu++;
    }
    const yama = yamaDurumu(klasor, this.yedek(t, klasor));
    return {
      tanim: { kimlik: t.kimlik, ad: t.ad },
      klasor,
      yama,
      ceviri: { toplam: satirlar.length, cevrili, sorunlu, uygulanabilir: sec.ceviriler.size },
      ...(p ? { paket: { tarih: p.tarih, satir: Object.keys(p.satirlar).length } } : {}),
      ...(p && yama === "kurulu" && this.kuruluPaketTarihi(t, klasor) !== p.tarih ? { ceviriEski: true } : {}),
    };
  }

  /** Oyuna en son kurulan hazır paketin tarihi (not yoksa — ör. 0.4.0 ile kurulmuşsa — undefined). */
  private kuruluPaketTarihi(t: OyunTanimi, klasor: string): string | undefined {
    try {
      return (JSON.parse(readFileSync(join(this.yedek(t, klasor), KURULU_PAKET), "utf8")) as { tarih?: string }).tarih;
    } catch {
      return undefined;
    }
  }

  async turkceYap(t: OyunTanimi, klasor: string, ilerleme: (i: Ilerleme) => void): Promise<void> {
    this.oyunKapaliOlmali(t);
    // Yama bozulduysa (Steam güncellemesi ya da yarım kalan kurulum) önce onar; kaynak metin ondan sonra okunur
    // ki yeni oyun sürümüne eski sürümün dizininden yama yapılmasın.
    if (yamaDurumu(klasor, this.yedek(t, klasor)) === "degismis") {
      ilerleme({ tur: "yuzde", deger: 5, metin: "Oyun güncellenmiş; eski yama temizleniyor…" });
      try {
        await geriYukle(klasor, this.yedek(t, klasor));
      } catch (e) {
        if (!(e instanceof DegismisHatasi)) throw e;
        await yamayiUnut(klasor, this.yedek(t, klasor)); // Steam yeni dosyaları koymuş: yalnızca yamanın artıkları silinir
      }
    }
    let y: { degisecek: Record<string, Buffer>; eklenecek: Record<string, Buffer> };
    if (t.motor === "ue5") {
      const { ceviriler } = this.ueCevirileri(t);
      if (ceviriler.size === 0) throw new Error(CEVIRI_YOK);
      ilerleme({ tur: "yuzde", deger: 10, metin: `${ceviriler.size.toLocaleString("tr")} satır hazırlanıyor…` });
      y = ueYamaHazirla(t, ceviriler);
    } else {
      const { satirlar, kullanilabilir, vfx, katmanlar } = this.kaynak(t, klasor);
      const sec = uygulanabilirCeviriler(this.kurulacakDepo(t, satirlar), satirlar, kullanilabilir);
      if (sec.ceviriler.size === 0) throw new Error(CEVIRI_YOK);
      ilerleme({ tur: "yuzde", deger: 10, metin: `${sec.ceviriler.size.toLocaleString("tr")} satır hazırlanıyor…` });
      y = t.yamaHazirla(klasor, sec.ceviriler, vfx, katmanlar);
    }
    ilerleme({ tur: "yuzde", deger: 80, metin: "Oyun dosyaları yedeklenip yazılıyor…" });
    this.oyunKapaliOlmali(t); // hazırlık birkaç saniye sürdü: oyun bu arada açılmış olabilir
    await uygula(klasor, this.yedek(t, klasor), y.degisecek, y.eklenecek);
    const p = this.hazirPaket(t);
    if (p) writeFileSync(join(this.yedek(t, klasor), KURULU_PAKET), JSON.stringify({ tarih: p.tarih }), "utf8");
    ilerleme({ tur: "yuzde", deger: 100, metin: "Türkçe yama kuruldu." });
  }

  async kaldir(t: OyunTanimi, klasor: string): Promise<void> {
    this.oyunKapaliOlmali(t);
    try {
      await geriYukle(klasor, this.yedek(t, klasor));
    } catch (e) {
      // Steam oyunu güncellemiş: oyun dosyaları zaten Steam'in yeni sürümü; yalnızca yamanın artıkları silinir.
      if (!(e instanceof DegismisHatasi)) throw e;
      await yamayiUnut(klasor, this.yedek(t, klasor));
    }
  }

  async unut(t: OyunTanimi, klasor: string): Promise<void> {
    this.oyunKapaliOlmali(t);
    await yamayiUnut(klasor, this.yedek(t, klasor));
  }
}
