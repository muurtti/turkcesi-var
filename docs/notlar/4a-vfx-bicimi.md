# 4A Engine (Metro 2033 Redux) — VFX dizini ve VFS paketleri

12 Kasım 2026'da kullanıcının Steam kurulumu üzerinde, yalnızca okuyarak çözüldü.
Bütün sayılar little-endian.

## content.vfx

```
u32 surum1            = 1
u32 surum2            = 1
u8[16] guid
u32 paketSayisi       = 30
u32 kayitSayisi       = 83326   (klasör + dosya)
u32 kopyaSayisi       = 25959
paket × paketSayisi:
    cstr ad            "content00.vfs0", "content00.vfs1", ...
    u32 klasorSayisi
    cstr × klasorSayisi  "2033\000", "2033\l00_intro", ...  (bu paket hangi seviyelerde yüklenir)
    u32 boyut          .vfs dosyasının bayt boyutu (birebir eşleşiyor)
kayit × kayitSayisi:   (ilk 2 bayt 'bayrak'; bayrak & 8 → klasör)
    KLASÖR (10 + adUzunlugu bayt):
        u16 bayrak (8)  u16 cocukSayisi  u32 ilkCocukSirasi
        u8 adUzunlugu (sondaki 0 dahil)  u8 xorAnahtari
        u8[adUzunlugu-1] ad ^ xorAnahtari   u8 0
    DOSYA (18 + adUzunlugu bayt):
        u16 bayrak (0)  u16 paketNo  u32 ofset  u32 boyut  u32 sikistirilmisBoyut
        u8 adUzunlugu  u8 xorAnahtari  u8[adUzunlugu-1] ad ^ xorAnahtari  u8 0
kopya × kopyaSayisi:   (20 bayt) aynı dosyanın başka paketteki kopyası
    u16 bayrak  u16 paketNo  u32 ofset  u32 boyut  u32 sikistirilmisBoyut  u32 kayitSirasi
u8[8] 0                sonek
```

- Kök kayıt 0 adı boş bir klasör; `content` kayıt 1.
- Klasörün çocukları `ilkCocukSirasi .. ilkCocukSirasi+cocukSayisi-1` aralığındaki kayıtlardır.
- `paketNo` doğrudan paket listesindeki sıradır (0 = content00.vfs0, 1 = content00.vfs1 …).
- Yama yaparken bir dosya yönlendirilirse, **kopya tablosundaki kayıtları da** yönlendirilmeli; yoksa oyun bazı seviyelerde eski kopyayı okuyabilir. stable_*.lng ve fontların kopyası yok.

## Sıkıştırma (VFS içindeki dosya)

`boyut != sikistirilmisBoyut` ise dosya parçalar halinde:

```
parça:
    u32 parcaBoyutu   (bu 8 baytlık başlık dahil)
    u32 acikBoyut     (en fazla 0x30000 = 196608)
    LZ4 blok verisi   (parcaBoyutu - 8 bayt)
```

LZ4 blokları **bağlı**: her parça önceki parçaların açılmış çıktısını sözlük (64 KB pencere) olarak kullanabilir. Çözücü tek bir çıkış tamponuna art arda yazar.
`boyut == sikistirilmisBoyut` ise dosya ham saklanır (ör. 44 baytlık font .bin dosyaları).

## Önemli dosyalar

| Yol | Not |
|---|---|
| content/localization/stable_us.lng | İngilizce metinler (1 713 834 bayt açık). Biçim: `4a-metin-tablosu.md` |
| content/localization/stable_ru.lng | Rusça özgün metin |
| content/textures/font/font_metro_for_menu_us.512 / .bin | menü fontu dokusu / 44 baytlık doku parametresi |
| content/textures/font/font_font_regular_us.512 / .bin | genel (altyazı?) font dokusu |
| content/textures/font/font_metro_for_menu_main_strings_us.512 | ana menü başlık yazıları |

Diller: us, ru, uk, de, es, fr, it, nl, pl, cz. Ses klasörleri `sounds.us` vb.; yüz animasyonu `facefx.us` vb.

## VFS paket dosyası

```
u32 0
u32 veriUzunlugu        (= dosya boyutu - 32)
veri                    dosyalar art arda, hizalama yok (ilk dosya ofset 8)
u32 3   u32 16   u8[16] guid   (content.vfx başlığındaki GUID'in aynısı)
```

Yama, değişen dosyaları sıkıştırmadan yeni bir `contentNN.vfs0` (2033'te `content28.vfs0`) paketine koyar; paket tablosuna `content00.vfs0`'ın klasör listesiyle eklenir; kayıtlar ve kopya tablosundaki ilgili satırlar yeni pakete yönlendirilir.

## Metro Exodus normal sürüm (Steam 412020): güncelleme dizinleri

EE'nin aksine normal sürümde `content.vfx`'in üstüne güncelleme dizinleri yüklenir: `patch_00.vfx`, `patch_01.vfx`,
`patch_01_shared.vfx`, `patch_02.vfx`, `patch_03.vfx`, `patch_04.vfx` (her biri kendi `patch_NN*.vfs*` paketleriyle;
sürüm 3.1, GUID'leri ayrı). Bir dosyanın birden çok kopyası varsa en yeni dizindeki kullanılır.

- `stable_us.lng`, `config.bin` ve font dokularının en yeni kopyaları `patch_04.vfx`'te (17 Kasım 2026 Steam sürümü,
  içerik sürümü 521006). `content.vfx`'teki kopyalar eskidir (karakter tablosu bile farklı sıradadır).
- Güncelleme dizinlerinde klasör adları ters bölü içerebilir: `content\localization/stable_us.lng` (tek klasör kaydı
  `content\localization`). Yol karşılaştırmaları `\` → `/` sadeleştirilerek yapılır (`girdiBul`, `yolAnahtari`).
- Paket kaydının son alanı (grup) güncelleme dizinlerinde dosya adındaki sayı değildir (`patch_04.vfs0` → 2).
  Yama paketi, değişen dosyanın paketiyle aynı grup ve klasörlerle `patch_04_tr.vfs0` adıyla eklenir
  (`content_NN.vfs0` adları temel dizinle çakışırdı).
- Karakter tablosu sırası EE'den farklıdır (203 karakter; `\x01`…`\x07` 114–120'de). Türkçe harf yuvaları bu yüzden
  sabit sayı değil, kontrol karakterlerinin yerinden bulunur (`exodusYuvalari`).
- Satır adlarının ~%95'i EE ile aynı; adı farklı olanların çoğunun İngilizce metni birebir aynıdır. Servis, ortak
  paketi kullanan sürümde bunları metin özetinden eşleştirir: 37.413 satırın 37.368'i Türkçe olur.
