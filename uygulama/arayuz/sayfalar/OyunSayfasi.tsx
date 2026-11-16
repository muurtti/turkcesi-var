// Oyun sayfası: afiş, Türkçe durumu ve tek tıkla Türkçe yap / kaldır.

import { useState, type ReactNode } from "react";
import type { ArayuzOyunu } from "../../../src/servis/api.js";
import type { Ilerleme, OyunDurumu } from "../../../src/servis/tipler.js";
import { Simge } from "../bilesenler/Simge.js";
import { Bildirim, Dugme, IlerlemeCubugu, Kapak, Rozet, sayi } from "../bilesenler/temel.js";
import { platformAdi, rozetBul } from "./Oyunlarim.js";

export interface OyunIslemleri {
  turkceYap: () => void;
  kaldir: () => void;
  klasoruAc: () => void;
  geri: () => void;
}

export function OyunAfisi({ oyun, onGeri, children }: { oyun: ArayuzOyunu; onGeri: () => void; children?: ReactNode }) {
  // Afiş yüklenemezse sırayla başlık görseline, o da yoksa renkli yer tutucuya; logo yoksa oyunun adı yazılır.
  const adaylar = [oyun.gorseller.afis, oyun.gorseller.baslik].filter((x): x is string => Boolean(x));
  const [sira, setSira] = useState(0);
  const [logoYok, setLogoYok] = useState(false);
  const afis = adaylar[sira];
  return (
    <div className="afis">
      {afis ? <img key={afis} className="afis-resim" src={afis} alt="" onError={() => setSira((s) => s + 1)} /> : <Kapak ad={oyun.ad} oran="yatay" />}
      <div className="afis-karartma" />
      <button type="button" className="afis-geri" onClick={onGeri} aria-label="Oyunlarıma dön">
        <Simge ad="geri" /> Oyunlarım
      </button>
      <div className="afis-icerik">
        {oyun.gorseller.logo && !logoYok ? (
          <img className="afis-logo" src={oyun.gorseller.logo} alt={oyun.ad} onError={() => setLogoYok(true)} />
        ) : (
          <h1 className="afis-ad">{oyun.ad}</h1>
        )}
        {children}
      </div>
    </div>
  );
}

const tarih = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export function OyunSayfasi(p: { oyun: ArayuzOyunu; durum: OyunDurumu | undefined; islem: Ilerleme | undefined } & OyunIslemleri) {
  const { oyun, durum: d } = p;
  const r = rozetBul(oyun, d);
  const mesgul = p.islem !== undefined;

  let govde: ReactNode;
  if (oyun.durum === "hile-korumali") {
    govde = (
      <Bildirim tur="tehlike">
        <strong>Bu oyuna dokunulmaz.</strong> Hile koruması olan çevrimiçi oyunlarda oyun dosyalarını değiştirmek hesap yasağına yol açabilir. Türkçesi Var bu
        oyunları güvenliğin için hiçbir zaman değiştirmez.
      </Bildirim>
    );
  } else if (oyun.durum === "desteklenmiyor") {
    govde = (
      <Bildirim tur="bilgi">
        Bu oyunun Türkçesi henüz yok. Yeni oyunlar eklendikçe uygulama kendini güncelleyecek; o zaman bu oyun &quot;Türkçesi hazır&quot; listesine geçer.
      </Bildirim>
    );
  } else if (!d) {
    govde = <IlerlemeCubugu i={{ tur: "mesaj", metin: "Oyun dosyaları okunuyor…" }} />;
  } else if (d.ceviri.uygulanabilir === 0 && d.yama === "yok") {
    govde = <Bildirim tur="bilgi">Bu oyunun Türkçe paketi bu sürümde yok. Uygulama güncellenince gelecek.</Bildirim>;
  } else {
    const kurulu = d.yama === "kurulu";
    const bozuk = d.yama === "degismis";
    govde = (
      <>
        <div className={`durum-paneli${kurulu ? " kurulu" : ""}`}>
          <div className="durum-metni">
            {kurulu ? (
              <>
                <h2>
                  <Simge ad="tamam" boyut={22} /> Türkçe kurulu
                </h2>
                <p className="soluk">Oyunu Steam&apos;den her zamanki gibi açabilirsin. Oyunun dil ayarını English bırak; Türkçe metin İngilizcenin yerine geçer.</p>
              </>
            ) : bozuk ? (
              <>
                <h2>
                  <Simge ad="uyari" boyut={22} /> Oyun güncellenmiş
                </h2>
                <p className="soluk">
                  Steam oyunu güncelleyince Türkçe yama devre dışı kalır. Tek tıkla yeniden kurabilirsin; uygulama eski yamayı kendisi temizler.
                </p>
              </>
            ) : (
              <>
                <h2>Türkçe yapmaya hazır</h2>
                <p className="soluk">
                  Menüler, altyazılar ve notlar Türkçe olur. Önce oyunun orijinal dosyalarının yedeği alınır; istediğin zaman tek tıkla eski hâline dönersin.
                </p>
              </>
            )}
          </div>
          {mesgul ? (
            <IlerlemeCubugu i={p.islem} />
          ) : (
            <div className="eylemler">
              {kurulu ? (
                <Dugme tur="ikincil" buyuk simge="geriAl" onClick={p.kaldir} title="Oyunu orijinal hâline döndür">
                  Türkçeyi kaldır
                </Dugme>
              ) : (
                <>
                  <Dugme tur="ana" buyuk simge="dil" onClick={p.turkceYap}>
                    {bozuk ? "Türkçeyi yeniden kur" : "Türkçe yap"}
                  </Dugme>
                  {bozuk && (
                    <Dugme tur="ikincil" buyuk simge="geriAl" onClick={p.kaldir}>
                      Kaldır
                    </Dugme>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <dl className="bilgi-listesi">
          {d.paket && (
            <>
              <dt>Türkçe paket</dt>
              <dd>
                {sayi(d.ceviri.uygulanabilir)} / {sayi(d.ceviri.toplam)} satır · {tarih(d.paket.tarih)}
              </dd>
            </>
          )}
          <dt>Platform</dt>
          <dd>{platformAdi(oyun)}</dd>
          <dt>Oyun klasörü</dt>
          <dd className="klasor-satiri">
            <code>{d.klasor}</code>
            <Dugme tur="sade" onClick={p.klasoruAc}>
              Klasörü aç
            </Dugme>
          </dd>
          <dt>Altyazılar</dt>
          <dd>Oyunda Seçenekler → Altyazılar açık olmalı.</dd>
        </dl>
      </>
    );
  }

  return (
    <div className="oyun-sayfasi">
      <OyunAfisi oyun={oyun} onGeri={p.geri}>
        <Rozet tur={r.tur} simge={r.simge}>
          {r.metin}
        </Rozet>
      </OyunAfisi>
      <div className="oyun-govde">{govde}</div>
    </div>
  );
}
