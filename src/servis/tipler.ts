// Ana süreç ↔ arayüz arasında taşınan düz veri tipleri (fonksiyon içermez).

export interface OyunDurumu {
  tanim: { kimlik: string; ad: string };
  klasor: string;
  yama: "yok" | "kurulu" | "degismis";
  ceviri: {
    toplam: number;
    /** Kaynak metni güncel ve boş olmayan çeviri sayısı. */
    cevrili: number;
    /** Uyarılı (sorunlu ya da emin olunmayan) satır sayısı. */
    sorunlu: number;
    /** Oyuna konabilecek satır sayısı. */
    uygulanabilir: number;
  };
  /** Uygulamayla gelen hazır çeviri paketi. */
  paket?: { tarih: string; satir: number };
  /** Türkçe kurulu ama uygulamayla daha yeni bir çeviri paketi geldi (yeniden kurulmalı). */
  ceviriEski?: boolean;
}

export type Ilerleme = { tur: "mesaj"; metin: string } | { tur: "yuzde"; deger: number; metin: string };
