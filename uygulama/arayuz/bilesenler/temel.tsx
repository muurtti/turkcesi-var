// Ortak küçük bileşenler: düğme, rozet, oyun kapağı, ilerleme.

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Ilerleme as IlerlemeT } from "../../../src/servis/tipler.js";
import { Simge, type SimgeAdi } from "./Simge.js";

export function Dugme(p: {
  children: ReactNode;
  onClick?: () => void;
  tur?: "ana" | "ikincil" | "tehlike" | "sade";
  simge?: SimgeAdi;
  pasif?: boolean;
  buyuk?: boolean;
  title?: string;
  /** Simge dönsün (yenileniyor / denetleniyor). */
  donen?: boolean;
}) {
  return (
    <button
      type="button"
      className={`dugme dugme-${p.tur ?? "ikincil"}${p.buyuk ? " dugme-buyuk" : ""}${p.donen ? " dugme-donen" : ""}`}
      onClick={p.onClick}
      disabled={p.pasif}
      title={p.title}
    >
      {p.simge && <Simge ad={p.simge} boyut={p.buyuk ? 20 : 16} />}
      <span>{p.children}</span>
    </button>
  );
}

export type RozetTuru = "basari" | "vurgu" | "bilgi" | "notr" | "tehlike" | "uyari";

export function Rozet({ tur, children, simge }: { tur: RozetTuru; children: ReactNode; simge?: SimgeAdi }) {
  return (
    <span className={`rozet rozet-${tur}`}>
      {simge && <Simge ad={simge} boyut={13} />}
      {children}
    </span>
  );
}

/** İsimden kararlı bir renk tonu (görseli olmayan oyunlar için yer tutucu). */
function ton(ad: string): number {
  let h = 0;
  for (const c of ad) h = (h * 31 + c.codePointAt(0)!) % 360;
  return h;
}

export function Kapak({ ad, src, oran = "dikey" }: { ad: string; src?: string; oran?: "dikey" | "yatay" }) {
  // Resim yüklenince yumuşakça belirir; yüklenemezse renkli yer tutucuya düşer.
  const [durum, setDurum] = useState<"yukleniyor" | "hazir" | "hata">("yukleniyor");
  if (src && durum !== "hata") {
    return (
      <img
        className={`kapak kapak-${oran} kapak-resim${durum === "hazir" ? " yuklendi" : ""}`}
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setDurum("hazir")}
        onError={() => setDurum("hata")}
      />
    );
  }
  const h = ton(ad);
  const bas = ad
    .split(/[\s_:-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]!.toLocaleUpperCase("tr"))
    .join("");
  return (
    <div className={`kapak kapak-${oran} kapak-yer`} style={{ background: `linear-gradient(160deg, hsl(${h} 35% 24%), hsl(${(h + 40) % 360} 30% 11%))` }}>
      <span>{bas}</span>
    </div>
  );
}

export function IlerlemeCubugu({ i }: { i?: IlerlemeT }) {
  const yuzde = i?.tur === "yuzde" ? i.deger : undefined;
  return (
    <div className="ilerleme" role="progressbar" aria-valuenow={yuzde}>
      <div className="ilerleme-iz">
        <div className={`ilerleme-dolgu${yuzde === undefined ? " belirsiz" : ""}`} style={yuzde === undefined ? undefined : { width: `${yuzde}%` }} />
      </div>
      {i && <p className="ilerleme-metin">{i.metin}</p>}
    </div>
  );
}

export function Bildirim({ tur, children }: { tur: "bilgi" | "uyari" | "tehlike" | "basari"; children: ReactNode }) {
  const simge: Record<typeof tur, SimgeAdi> = { bilgi: "bilgi", uyari: "uyari", tehlike: "kalkan", basari: "tamam" };
  return (
    <div className={`bildirim bildirim-${tur}`} role={tur === "tehlike" || tur === "uyari" ? "alert" : "status"}>
      <Simge ad={simge[tur]} />
      <div>{children}</div>
    </div>
  );
}

export const sayi = (n: number) => n.toLocaleString("tr-TR");

/** Listelerde sırayla belirme: n. öğe biraz gecikmeyle gelir (ilk 12'den sonrası beklemez). */
export const sirayla = (n: number): CSSProperties => ({ "--sira": Math.min(n, 12) }) as CSSProperties;

/** Steam taranırken kartların yerinde parıldayan iskeletler. */
export function Iskelet({ tur, adet }: { tur: "genis" | "dikey"; adet: number }) {
  return (
    <>
      {Array.from({ length: adet }, (_, i) => (
        <div key={i} className={`iskelet iskelet-${tur}`} style={sirayla(i)} aria-hidden="true" />
      ))}
    </>
  );
}
