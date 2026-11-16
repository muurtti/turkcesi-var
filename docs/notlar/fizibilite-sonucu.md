# Fizibilite sonucu — Metro 2033 Redux (12 Kasım 2026)

**Sonuç: BAŞARILI.** Metro 2033 Redux'a Türkçe metin ve Türkçe harfler (ğ Ğ ş Ş ı İ) güvenli şekilde eklenebiliyor ve tek komutla geri alınabiliyor.

## Oyunda doğrulanan

| Kontrol | Sonuç |
|---|---|
| Oyun yamalı haliyle açılıyor | ✅ |
| Ana menüde `$new_game` → "YENİ OYUN ğşı" doğru harflerle görünüyor | ✅ (kullanıcı teyidi) |
| İlk Khan altyazısı (`int_001_khan_intro_1`) | ❓ Görülmedi. Olası neden: altyazılar kapalı (OPTIONS → SUBTITLES) ya da sahneye gelinmedi. Tam çeviride yeniden bakılacak. |
| `npm run deneme -- geri-al` | ✅ content.vfx SHA-256 Steam'deki temiz sürümle aynı, content28.vfs0 silindi |

## Öğrenilenler (Plan 2 için)

- Biçimler: `4a-vfx-bicimi.md`, `4a-metin-tablosu.md`, `4a-font.md`.
- Yeni paket sıkıştırmasız dosyalarla çalışıyor; content00.vfs0'ın klasör listesi yeterli.
- Türkçe harfler, us karakter tablosunun kullanılmayan \x01–\x06 yuvalarına (176–181) yerleşiyor; dosya boyutları değişmiyor.
- Glifler oyunun kendi harflerinden türetiliyor; menüde stil uyumu kullanıcı tarafından sorun olarak görülmedi.
- Eksik kalan: `map` ve `typewriter` fontları (font_metro_for_map_us .512 + .1024) — her iki doku boyutuna ve iki glif dizisine (512 ve 1024 koordinatlı) ekleme gerekiyor.
- Metin: 23 947 satır, 936 094 karakter; 10 995 `voices\…` (altyazı), 6 449 `$…` (arayüz/menü), 3 572 `2033…`, başarımlar (`ACH`), DLC, ipuçları. 2 505 satır boş.
- Kullanıcı isteği (12 Kasım): **oyunun tamamı Türkçe olsun, ayarlar ve menüler dahil.**
