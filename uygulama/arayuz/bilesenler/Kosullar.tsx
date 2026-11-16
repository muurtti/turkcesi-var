// Kullanım koşulları (kurulumda kabul edilir; burada yalnızca okunur). Metin KULLANIM-KOSULLARI.md'den gelir.

import type { ReactNode } from "react";
import kosulMetni from "../../../KULLANIM-KOSULLARI.md?raw";
import { Dugme } from "./temel.js";
import { useYumusakKapat } from "./yumusak.js";

/** Basit Markdown: başlıklar, madde listeleri ve paragraflar (yeterli; dış kütüphane yok). */
export function mdBloklari(md: string): ReactNode[] {
  const bloklar: ReactNode[] = [];
  let liste: string[] = [];
  const listeyiBitir = () => {
    if (liste.length) bloklar.push(<ul key={`l${bloklar.length}`}>{liste.map((m, i) => <li key={i}>{m}</li>)}</ul>);
    liste = [];
  };
  for (const ham of md.split(/\r?\n/)) {
    const s = ham.trim().replace(/\*\*(.+?)\*\*/g, "$1");
    if (s.startsWith("- ")) {
      liste.push(s.slice(2));
      continue;
    }
    listeyiBitir();
    if (!s) continue;
    if (s.startsWith("## ")) bloklar.push(<h3 key={bloklar.length}>{s.slice(3)}</h3>);
    else if (s.startsWith("# ")) bloklar.push(<h2 key={bloklar.length}>{s.slice(2)}</h2>);
    else bloklar.push(<p key={bloklar.length}>{s}</p>);
  }
  listeyiBitir();
  return bloklar;
}

export function Kosullar({ onKapat }: { onKapat: () => void }) {
  const [kapaniyor, kapat] = useYumusakKapat(onKapat);
  return (
    <div className={`perde${kapaniyor ? " kapaniyor" : ""}`} onClick={kapat}>
      <div className="kosullar" role="dialog" aria-modal="true" aria-label="Kullanım koşulları" onClick={(e) => e.stopPropagation()}>
        <div className="kosullar-metin" tabIndex={0}>
          {mdBloklari(kosulMetni)}
        </div>
        <div className="eylemler">
          <Dugme tur="ikincil" onClick={kapat}>
            Kapat
          </Dugme>
        </div>
      </div>
    </div>
  );
}
