// Yeni sürüm bulununca: önce ortada belirgin pencere, "Sonra" denirse üstte kalıcı şerit.
// Kendiliğinden hiçbir şey inmez: indirme yalnızca kullanıcı "İndir"e basınca başlar.

import { useCallback, useState } from "react";
import type { GuncellemeDurumu } from "../../../src/servis/api.js";
import { Simge } from "./Simge.js";
import { Dugme } from "./temel.js";
import { useYumusakKapat } from "./yumusak.js";

type Var = Extract<GuncellemeDurumu, { durum: "var" | "indiriliyor" | "hazir" }>;
const guncellemeVar = (g: GuncellemeDurumu): g is Var => g.durum === "var" || g.durum === "indiriliyor" || g.durum === "hazir";

function Ilerleme({ g }: { g: Var }) {
  if (g.durum === "var") return null;
  if (g.durum === "hazir") return <p className="soluk">İndirme bitti. Yeniden başlatınca birkaç saniyede kurulur; oyunlardaki Türkçe yamalar etkilenmez.</p>;
  return (
    <div className="ilerleme" role="progressbar" aria-valuenow={g.yuzde}>
      <div className="ilerleme-iz">
        <div className="ilerleme-dolgu" style={{ width: `${g.yuzde}%` }} />
      </div>
      <p className="ilerleme-metin">Yeni sürüm indiriliyor… %{g.yuzde}</p>
    </div>
  );
}

function SeritMetni({ g }: { g: Var }) {
  if (g.durum === "var") return <>İndirmek istediğinde &quot;İndir&quot;e bas.</>;
  if (g.durum === "hazir") return <>Güncellemen gerekiyor.</>;
  return <>İndiriliyor… %{g.yuzde}</>;
}

export function GuncellemeUyarisi({ g, kur, indir }: { g: GuncellemeDurumu; kur: () => void; indir: () => void }) {
  const [kapatildi, setKapatildi] = useState<string>();
  const surum = guncellemeVar(g) ? g.surum : undefined;
  const [kapaniyor, sonra] = useYumusakKapat(useCallback(() => setKapatildi(surum), [surum]));
  if (!guncellemeVar(g)) return null;

  if (kapatildi === g.surum) {
    return (
      <div className="guncelleme-seridi" role="status">
        <Simge ad="yenile" />
        <span>
          <strong>Güncelleme var ({g.surum}).</strong> <SeritMetni g={g} />
        </span>
        {g.durum === "var" && (
          <Dugme tur="ana" simge="yenile" onClick={indir}>
            İndir
          </Dugme>
        )}
        {g.durum === "hazir" && (
          <Dugme tur="ana" simge="yenile" onClick={kur}>
            Yeniden başlat ve güncelle
          </Dugme>
        )}
      </div>
    );
  }

  return (
    <div className={`perde${kapaniyor ? " kapaniyor" : ""}`}>
      <div className="pencere" role="alertdialog" aria-modal="true" aria-labelledby="guncelleme-baslik">
        <div className="pencere-simge">
          <Simge ad="yenile" boyut={26} />
        </div>
        <h2 id="guncelleme-baslik">Güncelleme var</h2>
        <p>
          Türkçesi Var&apos;ın yeni sürümü çıktı: <strong>{g.surum}</strong>. Güncellemen gerekiyor; yeni sürümler çeviri düzeltmeleri, yeni oyunlar ve hata
          düzeltmeleri getirir.
        </p>
        <Ilerleme g={g} />
        <div className="eylemler">
          {g.durum === "var" ? (
            <Dugme tur="ana" buyuk simge="yenile" onClick={indir}>
              Şimdi indir
            </Dugme>
          ) : (
            <Dugme tur="ana" buyuk simge="yenile" pasif={g.durum !== "hazir"} onClick={kur}>
              Yeniden başlat ve güncelle
            </Dugme>
          )}
          <Dugme tur="ikincil" buyuk onClick={sonra}>
            Sonra
          </Dugme>
        </div>
      </div>
    </div>
  );
}
