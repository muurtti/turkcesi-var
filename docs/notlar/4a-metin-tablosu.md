# 4A Engine — .lng metin tablosu (stable_us.lng)

Açılmış dosya, `u32 tür, u32 boyut, veri` biçiminde bölümlerden oluşur:

| Tür | Boyut (us) | İçerik |
|---|---|---|
| 0 | 4 | 4 bayt 0 (anlamı bilinmiyor, aynen korunur) |
| 1 | 422 | **Karakter tablosu**: UTF-16LE, 211 girdi, sıklığa göre sıralı. [0]=U+F8FF, [1]=U+0000, [2]=' ', [3]='e', … |
| 2 | dosyanın kalanı | Satırlar: `anahtar (latin1) 0` + `metin baytları 0`, art arda. |

- Metindeki her bayt karakter tablosunda bir sıradır; 0 satır sonudur. Bayt tek olduğu için tabloda en fazla 256 girdi olabilir.
- 23 947 satır. Anahtar örnekleri: `voices\l00_intro\int_001_khan_intro_1` (altyazı), `$new_game` (menü), `$credits.*`, `rich_presence_*`.
- İngilizce tabloda **ç Ç ö Ö ü Ü var**, **ğ Ğ ş Ş ı İ yok**. Yazıcı eksik karakterleri tablonun sonuna ekler (211 → 217).
- Yazıcı, metni değişmeyen satırların orijinal baytlarını aynen kullanır; böylece değiştirilmemiş dosya bayt bayt aynı yazılır.

## Fizibilite denemesi satırları

| Anahtar | İngilizce | Deneme |
|---|---|---|
| `$new_game` | NEW GAME | YENİ OYUN ğşı |
| `voices\l00_intro\int_001_khan_intro_1` | Artyom! Wake up, Artyom! It's me, Khan! | Ğğ Şş İı Çç Öö Üü — Türkçesi Var denemesi |

Altyazı, yeni oyun başlar başlamaz Khan'ın Artyom'u uyandırdığı ilk sahnede görünür (Seçenekler'de altyazılar açık olmalı).
