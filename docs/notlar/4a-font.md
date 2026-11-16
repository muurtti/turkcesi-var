# 4A Engine (Metro 2033 Redux) — fontlar

## Nerede?

- **Dokular:** `content/textures/font/<ad>.512` (bazılarında `.1024`). Başlıksız **BC1 (DXT1)**, 512×512, 1×1'e kadar bütün mip seviyeleri (174 776 bayt).
  Yanındaki `<ad>.bin` (44 bayt) doku parametresi: `u32 16, u8 0, u8 1, u32 genişlik, u32 yükseklik, …`.
- **Harf ölçüleri:** `content/config.bin` içinde, her dil için bir "font kütüphanesi". metro.exe'deki adlar:
  `fonts_`, `* font: %s`, `line_height`, `inv_scale`, `xadvance`, `xoffset`, `yoffset`,
  `! Cannot get char info for index = %d, char = %d`.

## config.bin'deki yerleşim

Her dil için: önce font kayıtları, sonra **ad listesi**. Ad listesi şu dizgiyle başlar:
`console\0font\font_console\0<dil>\0main_menu_lcd\0font\font_metro_for_menu_main_strings_<dil>\0main_menu\0…`
(uk 446263, us 906642, ru 998487, it, es, fr, pl, cz, nl, de).
Bir dilin font kayıtları, bir önceki dilin ad listesi ile kendi ad listesi arasındadır.

Ad listesi başlığı: `u32 2, u32 boyut, u32 dizgiSayısı, u8 0`, ardından 0 ile biten dizgiler.

### Font kaydı

```
u32 boyut   u8 4   u32 3
u32 dokuSirasi      ad listesindeki dizginin sırası (ör. menu → 10 = "font\font_metro_for_menu_us")
u32 ikinciSira      (anlamı belirsiz, korunur)
f32 1/dokuGen  f32 1/dokuYuk  f32 satirYuksekligi   (menu: 1/512, 1/512, 56)
u32 0x8f0f9a56      ("chars" alanının özeti)
u32 boyut   u8 4   u32 adet                    (us metin fontlarında 211)
adet × (23 bayt):
    u32 0   u32 15   u8 4
    i16 x  i16 y  u16 gen  u16 yuk  i16 xoffset  i16 yoffset  u16 xadvance
```

- **Glif sırası = `.lng` karakter tablosunun sırası.** Yani `stable_us.lng` tablosundaki i'inci karakter, her metin fontunda i'inci glif kaydını kullanır.
- x/y işaretli: en üst sıradaki harfler -1'den başlayabilir.
- us metin fontları (211 glif): main_menu_lcd, main_menu, map, menu, regular, typewriter(arial). Konsol, nixie, simge fontları 256'lık sabit ızgaradır.

## Türkçe harfler için yöntem

us karakter tablosunun **176–206 sıraları \x01–\x1F kontrol karakterleri**; metinlerde kullanılmıyor ve bütün metin fontlarında glif kayıtları boş (0×0). Türkçe harfler bu sıralara yerleşir:

| Sıra | Eski | Yeni |
|---|---|---|
| 176 | \x01 | ğ |
| 177 | \x02 | Ğ |
| 178 | \x03 | ş |
| 179 | \x04 | Ş |
| 180 | \x05 | ı |
| 181 | \x06 | İ |

Böylece `.lng` ve `config.bin` boyutları değişmez; yalnızca karakter tablosundaki 6 girdi ve her metin fontunda 6 glif kaydı değişir. Yeni glifler dokunun altındaki boş şeride çizilir.

## Bölünmüş dokular (12 Kasım, Plan 2 Task 7)

`font_metro_for_map_us` 1024×1024'tür (`.bin`: 1024). En büyük seviye `.1024` dosyasında (524 288 bayt, yalnızca 0. seviye BC1), 512'den 1×1'e kalan seviyeler `.512` dosyasındadır (`.512`, `.1024`'ün küçültülmüşüyle ortalama 1,7 farkla aynı; ilgisiz dokuyla fark 55). `map` ve `typewriter` fontlarının glif tabloları birebir aynıdır ve 1024 koordinatlıdır. Yazarken: harfler 1024 seviyesine eklenir, `.512` yeni 1024'ün yarısından yeniden üretilir (`bolunmusDokuYaz`).
