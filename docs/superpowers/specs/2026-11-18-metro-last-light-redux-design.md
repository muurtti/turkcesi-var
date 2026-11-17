# Metro Last Light Redux desteği — kısa tasarım

Tarih: 18 Kasım 2026 · Durum: kullanıcı ONAYLADI

## Neden

Metro Last Light Redux'un (Steam 287390) resmi Türkçesi yok. Eski topluluk yamasının (OyunÇeviri)
indirme bağlantısı kaldırılmış ve büyük ihtimalle 22 Ekim 2026'daki yeni nesil güncelleme ile uyumsuz.
Metro 2033 Redux ve Metro Exodus'tan sonra seriyi tamamlar; mevcut kitle Metro oyuncuları.

## Bulgular (18 Kasım, kullanıcının kurulu oyununda ölçüldü)

- Klasör düzeni Metro 2033 Redux ile aynı (`content.vfx` + `contentNN.vfsN`, VFX sürüm [1,1]).
- `content/localization/stable_us.lng` 23.947 satır, boş olmayan 21.442; **anahtarların ve İngilizce
  metinlerin tamamı Metro 2033 Redux çeviri deposuyla birebir aynı** (21.442/21.442 kaynak özeti eşleşti).
  İki Redux oyunu ortak bir yerelleştirme tablosu kullanıyor → ek çeviri maliyeti 0 $.
- Mevcut `turkceYamaHazirla` Last Light'ta bellekte sorunsuz çalıştı: değişen `content.vfx`, eklenen
  `content32.vfs0` (~8 MB); 6 metin fontu yamalandı, atlanan yok.
- Ayırt edici dosyalar: Last Light'ta `outro_good.ogv` vb. videolar var, `2033` klasörü yok;
  Metro 2033 Redux'ta tersi.

## Yaklaşımlar

1. **Ortak paket (SEÇİLDİ):** Yeni tanım `metrolastlightredux`, `paketKimligi: "metro2033redux"`.
   Tek çeviri paketi; Metro 2033'te düzeltilen her satır Last Light'a da gelir.
2. Ayrı paket (`metrolastlightredux.tr.json`): aynı dosyanın ikinci kopyası, düzeltmeler iki yerde
   yapılmalı. Elendi.

## Tasarım

- `src/oyunlar/metrolastlightredux.ts`: kimlik `metrolastlightredux`, ad "Metro Last Light Redux",
  steamAppId 287390, klasorAdi "Metro Last Light Redux", motor "4a", surecAdi "metro.exe",
  tanimaDosyalari `["metro.exe", "content.vfx", "outro_good.ogv"]`, temizDizinOzeti (Steam'deki temiz
  content.vfx), paketKimligi "metro2033redux"; `kaynak`/`yamaHazirla` Metro 2033 Redux ile aynı mantık
  (ortak yardımcıya taşınabilir — kurucunun kararı).
- `OYUNLAR` listesine eklenir; scripts/ortak.ts seçimine eklenir.
- Testler: tanıma (Last Light klasörü Metro 2033 olarak tanınmaz, tersi de), paket kimliği,
  Steam/Epic/elle bulma.
- Oyunda deneme: servisle kullanıcının oyununa kurulur (yedekli); kullanıcı menü, altyazı ve Türkçe
  harfleri kontrol eder; kaldırma birebir geri döndürmeli.
- Yayın: kullanıcı onayından sonra 0.6.0 (Last Light + bekleyen Exodus normal sürüm, 852c843/0460608);
  site (veri/oyunlar.json), README, Kreosus, Discord, DH/Technopat duyuruları.

## Kapsam dışı

- Resmin içine gömülü İngilizce yazılar (dokular) — Metro 2033'te de yapılmadı.
- Epic sürümü ayrıca denenmeyecek; tanıma dosyası tutarsa çalışır, tutmazsa oyuna yazmadan durur.
