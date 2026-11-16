# Türkçesi Var — oyuncu uygulaması

Oyuncunun gördüğü uygulamada çeviri yoktur: hazır Türkçe paketler uygulamanın içinde gelir.
Oyuncu uygulamayı açar, oyununu seçer, **Türkçe yap**'a basar. Çeviriler bu depoda yapılmaz;
yalnızca bitmiş paketler (`paketler/`) burada yayımlanır.

## Oyuncu için

1. `TurkcesiVar-Kurulum.exe`'yi çalıştır (yönetici izni istemez; masaüstüne kısayol koyar).
   İmzasız olduğu için Windows "Bilgisayarınız korundu" diyebilir → *Ek bilgi* → *Yine de çalıştır*.
2. **Oyunlarım**: Steam kütüphanesi kendiliğinden taranır. Türkçesi hazır oyunlar en üstte.
   - Oyun bulunamazsa kartında **Klasörü seç** çıkar ve hangi dosyaların olduğu klasörün seçileceği yazar
     (Metro 2033 Redux: `metro.exe`, `content.vfx`, `2033`; genellikle `…\steamapps\common\Metro 2033 Redux`).
     Üst klasör (ör. `SteamLibrary`) seçilirse uygulama 3 kat aşağıya kadar kendisi arar. Seçim hatırlanır.
   - Aynı dosya adlarını kullanan kardeş oyunlar (Last Light Redux) `steam_appid.txt` ve `2033` klasörüyle ayırt edilir.
3. Oyun sayfasında tek düğme: **Türkçe yap** → kurulu olunca **Türkçeyi kaldır** (orijinal dosyalar yedekten birebir döner).
4. Oyunda dil English kalır; altyazılar açık olmalı.

## Güncellemeler

- **Oyun güncellenince (Steam):** yama devre dışı kalır, oyun İngilizce açılır. Uygulama açıldığında bunu görür ve
  Türkçeyi **kendiliğinden yeniden kurar** (oyun kapalıysa). Önce eski yama temizlenir (Steam'in yeni dosyalarına dokunulmaz),
  yeni sürümün orijinali yedeklenir, yama yeni sürümden hazırlanır. İngilizcesi değişen satırlar İngilizce kalır.
  Oyun sayfasında da **Türkçeyi yeniden kur** düğmesi vardır.
- **Uygulama güncellenince:** yeni sürüm açılışta ve açıkken 3 saatte bir denetlenir. Bulununca ortada **"Güncelleme var —
  güncellemen gerekiyor"** penceresi çıkar (sürüm numarası, indirme ilerlemesi), inince *Yeniden başlat ve güncelle*.
  *Sonra* denirse üstte şerit kalır; uygulama kapanınca da kendiliğinden kurulur. Kullanım engellenmez (internetsiz de çalışır).
  14 Kasım'da yerel sunucuyla uçtan uca denendi (0.1.0 → sahte 0.1.1 bulundu, indirildi, pencere çıktı; kurulmadı).
  Elle deneme: `TV_GUNCELLEME_ADRESI=http://127.0.0.1:8765` ile paketli exe'yi aç (latest.yml + kurulum dosyasını sunan klasör).
  Yayın adresi: `https://github.com/turkcesivar/turkcesi-var/releases/latest/download` (`uygulama/ana/guncelleme.ts`).
  Yeni sürüm = `package.json` sürümünü artır → `npm run exe` → `dist\<sürüm>\latest.yml` + `TurkcesiVar-Kurulum.exe` + `TurkcesiVar-Kurulum.zip`
  + `.blockmap` dosyalarını yeni bir GitHub Release'e yükle.

## Geliştirici için

```
npm run uygulama        # geliştirme kipi
npm run exe             # dist\<sürüm>\TurkcesiVar-Kurulum.exe ve .zip (önce electron-vite build)
```

Simgeler `build\simge.ico` / `build\simge.png` (marka paketi: `docs\marka`). Yeni çeviri paketi `paketler\`'e konur →
`package.json` sürümünü artır → `npm run exe`.

Kurulumda paketler `resources\paketler\`'dedir. Bu bilgisayarda bir çeviri deposu varsa (`%APPDATA%\turkcesi-var\ceviriler`)
oradaki satırlar paketin önüne geçer (geliştiricinin elle düzeltmeleri); oyuncuda depo yoktur, yalnızca paket kullanılır.

## Güvenlik

- Arayüz Node'a erişemez (contextIsolation + sandbox); ana sürece yalnızca `oyunDurumu`, `turkceYap`, `kaldir` gider ve
  yalnızca taranmış ya da elle seçilip tanınmış desteklenen oyun klasörleri kabul edilir.
- Oyun klasörüne yalnızca yedek modülü yazar; yedekler `%APPDATA%\turkcesi-var\yedekler`. Uygulamayı kaldırmak oyunu
  değiştirmez: önce uygulamada *Türkçeyi kaldır*.
- Hile korumalı oyunlara dokunulmaz. Görseller yalnızca Steam'in `appcache\librarycache` klasöründen sunulur.

## Geliştirici kısayolları (yalnızca geliştirme kipinde)

| Ortam değişkeni | Etkisi |
|---|---|
| `TV_ACILIS=oyun=metro2033redux` / `hakkinda` | Doğrudan o sayfada açılır |
| `TV_EKRAN_GORUNTUSU=C:\yol\ekran.png` | Sayfa yüklenince pencere görüntüsünü kaydedip kapanır |
| `TV_BEKLE=6000` | Ekran görüntüsünden önce bekleme (ms) |
