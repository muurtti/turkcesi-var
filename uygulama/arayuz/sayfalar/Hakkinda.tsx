// Hakkında: sürüm, otomatik güncelleme durumu, nasıl çalıştığı, destek.

import { useState } from "react";
import type { GuncellemeDurumu } from "../../../src/servis/api.js";
import { Kosullar } from "../bilesenler/Kosullar.js";
import { Simge } from "../bilesenler/Simge.js";
import { Dugme } from "../bilesenler/temel.js";
import { DESTEK_ADRESI, PROJE_ADRESI } from "../sabitler.js";

/** Güncelleme denetimi başarısız olduğunda nedene göre doğru, sakin bir açıklama. */
export function guncellemeHatasiMetni(neden: "yayin-yok" | "internet" | "diger"): string {
  if (neden === "yayin-yok") return "Henüz yayımlanmış yeni bir sürüm yok; şu an en güncel sürümü kullanıyorsun.";
  if (neden === "internet") return "İnternete bağlanılamadı. Bağlantını kontrol edip tekrar deneyebilirsin.";
  return "Güncelleme sunucusuna şu an ulaşılamıyor. Biraz sonra tekrar deneyebilirsin.";
}

export function guncellemeMetni(g: GuncellemeDurumu): string {
  switch (g.durum) {
    case "kapali":
      return "Otomatik güncelleme, uygulama internette yayımlandığında açılacak.";
    case "denetleniyor":
      return "Yeni sürüm denetleniyor…";
    case "guncel":
      return "En güncel sürümü kullanıyorsun.";
    case "var":
      return `Yeni sürüm (${g.surum}) çıktı. İndirmek istediğinde "İndir"e bas.`;
    case "indiriliyor":
      return `Yeni sürüm (${g.surum}) indiriliyor… %${g.yuzde}`;
    case "hazir":
      return `Yeni sürüm (${g.surum}) hazır. Yeniden başlatınca kurulur.`;
    case "hata":
      return guncellemeHatasiMetni(g.neden);
  }
}

export function Hakkinda({
  surum,
  guncelleme,
  destekAdresi = DESTEK_ADRESI,
  denetleniyor = false,
  onDenetle,
  onKur = () => void window.tv.guncellemeKur(),
  onIndir = () => void window.tv.guncellemeIndir(),
}: {
  surum: string;
  guncelleme: GuncellemeDurumu;
  destekAdresi?: string;
  denetleniyor?: boolean;
  onDenetle?: () => void;
  onKur?: () => void;
  onIndir?: () => void;
}) {
  const [kosullar, setKosullar] = useState(false);
  return (
    <div className="sayfa ayarlar">
      {kosullar && <Kosullar onKapat={() => setKosullar(false)} />}
      <header className="sayfa-baslik">
        <div>
          <h1>Hakkında</h1>
          <p className="soluk">Oyunlara güvenli, ücretsiz Türkçe.</p>
        </div>
      </header>

      <section className="panel" aria-label="Sürüm">
        <h2 className="panel-baslik">
          <Simge ad="yenile" /> Türkçesi Var {surum && <span className="surum">{surum}</span>}
        </h2>
        <p className="soluk">{guncellemeMetni(guncelleme)}</p>
        {guncelleme.durum === "var" && (
          <div className="eylemler">
            <Dugme tur="ana" simge="yenile" onClick={onIndir}>
              İndir
            </Dugme>
          </div>
        )}
        {guncelleme.durum !== "var" && guncelleme.durum !== "hazir" && guncelleme.durum !== "indiriliyor" && onDenetle && (
          <div className="eylemler">
            <Dugme tur="ikincil" simge="yenile" donen={denetleniyor} pasif={denetleniyor} onClick={onDenetle}>
              {denetleniyor ? "Denetleniyor…" : "Güncellemeleri denetle"}
            </Dugme>
          </div>
        )}
        {guncelleme.durum === "hazir" && (
          <div className="eylemler">
            <Dugme tur="ana" simge="yenile" onClick={onKur}>
              Yeniden başlat ve güncelle
            </Dugme>
          </div>
        )}
        <p className="soluk">
          Yeni sürümler daha iyi çeviriler ve yeni oyunlar getirir; uygulama açıldığında kendisi denetler ve yeni sürüm varsa haber verir; sen &quot;İndir&quot; deyince indirir, yeniden başlatınca ya da kapatınca kurar. Steam bir oyunu
          güncellerse uygulamayı açman yeter: Türkçe kendiliğinden yeniden kurulur.
        </p>
      </section>

      <section className="panel" aria-label="Nasıl çalışır">
        <h2 className="panel-baslik">
          <Simge ad="kalkan" /> Güvenli
        </h2>
        <ul className="madde-listesi">
          <li>Kurmadan önce oyunun değişecek dosyalarının yedeği alınır; &quot;Türkçeyi kaldır&quot; oyunu birebir eski hâline döndürür.</li>
          <li>Hile koruması olan çevrimiçi oyunlara hiçbir zaman dokunulmaz.</li>
          <li>Oyuna program ya da DLL eklenmez; yalnızca oyunun kendi metin ve yazı tipi dosyaları değişir.</li>
          <li>Açık kaynak: ne yaptığını herkes görebilir.</li>
        </ul>
      </section>

      <section className="panel" aria-label="Lisans">
        <h2 className="panel-baslik">
          <Simge ad="bilgi" /> Lisans
        </h2>
        <p className="atif">
          Türkçesi Var — orijinali <strong>turkcesivar</strong>, {PROJE_ADRESI.replace("https://", "")}
        </p>
        <p className="soluk">
          Kaynak kodu GNU GPL v3.0 ve ek şartlarıyla, Türkçe çeviriler CC BY-NC-ND 4.0 ile korunur. &quot;Türkçesi Var&quot; adı ve logosu lisansa dahil değildir.
          Resmi sürümler yalnızca GitHub sayfasından yayımlanır. Oyunlar ve metinleri yapımcılarına aittir.
        </p>
        <div className="eylemler">
          <Dugme tur="ikincil" onClick={() => void window.tv.disBaglanti(PROJE_ADRESI)}>
            GitHub sayfası
          </Dugme>
          <Dugme tur="sade" onClick={() => setKosullar(true)}>
            Kullanım koşulları
          </Dugme>
          <Dugme tur="sade" onClick={() => void window.tv.disBaglanti(`${PROJE_ADRESI}/issues/new?template=ceviri-hatasi.yml`)}>
            Çeviri hatası bildir
          </Dugme>
        </div>
      </section>

      {destekAdresi && (
        <section className="panel hakkinda" aria-label="Destek">
          <div>
            <h2 className="panel-baslik">
              <Simge ad="kalp" /> Projeyi destekle
            </h2>
            <p className="soluk">
              Türkçesi Var bedava ve öyle kalacak. Ama her yeni oyunun çevirisi de testi de emek ve para istiyor. Bir çay parası
              bile sıradaki oyunu öne çeker. 💛
            </p>
          </div>
          <Dugme tur="ana" simge="kalp" onClick={() => void window.tv.disBaglanti(destekAdresi)}>
            Projeyi destekle
          </Dugme>
        </section>
      )}
    </div>
  );
}
