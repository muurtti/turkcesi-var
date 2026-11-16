// Sağ altta kısa bildirim: yumuşak girer, metnin uzunluğuna göre ekranda kalır, yumuşak çıkar.
// Fareyle üzerine gelince süre durur; kapatma düğmesi vardır; altta kalan süreyi gösteren ince çizgi akar.

import { useEffect, useState, type CSSProperties } from "react";
import type { Mesaj } from "../islem.js";
import { Simge } from "./Simge.js";
import { Bildirim } from "./temel.js";

export const CIKIS_MS = 260;

/** Okuma süresi: kısa başarı/bilgi ≈2–3 sn, hata daha uzun; en fazla 9 sn. */
export function tostSuresi(m: NonNullable<Mesaj>): number {
  const temel = m.tur === "tehlike" ? 4500 : 2000;
  return Math.min(temel + m.metin.length * 30, 9000);
}

export function Tost({ mesaj, onBitti }: { mesaj: NonNullable<Mesaj>; onBitti: () => void }) {
  const [cikiyor, setCikiyor] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const [kalan, setKalan] = useState(() => tostSuresi(mesaj));

  // Süre dolunca çık; fare üzerindeyken sayma (kalan süre korunur).
  useEffect(() => {
    if (cikiyor || bekliyor) return;
    const bas = Date.now();
    const z = setTimeout(() => setCikiyor(true), kalan);
    return () => {
      clearTimeout(z);
      setKalan((k) => Math.max(400, k - (Date.now() - bas)));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cikiyor, bekliyor]);

  useEffect(() => {
    if (!cikiyor) return;
    const z = setTimeout(onBitti, CIKIS_MS);
    return () => clearTimeout(z);
  }, [cikiyor, onBitti]);

  return (
    <div
      className={`tost${cikiyor ? " cikiyor" : ""}${bekliyor ? " bekliyor" : ""}`}
      style={{ "--tost-sure": `${tostSuresi(mesaj)}ms` } as CSSProperties}
      onMouseEnter={() => setBekliyor(true)}
      onMouseLeave={() => setBekliyor(false)}
    >
      <Bildirim tur={mesaj.tur}>{mesaj.metin}</Bildirim>
      <button type="button" className="tost-kapat" aria-label="Bildirimi kapat" onClick={() => setCikiyor(true)}>
        <Simge ad="kapat" boyut={14} />
      </button>
      <span className="tost-sure" aria-hidden="true" />
    </div>
  );
}
