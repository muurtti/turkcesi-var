# Metro Last Light Redux Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Türkçesi Var, Metro Last Light Redux'u (Steam 287390) tanısın ve Metro 2033 Redux'un çeviri paketiyle Türkçeleştirsin.

**Architecture:** Yeni bir `OyunTanimi` (`METRO_LAST_LIGHT_REDUX`), Metro 2033 Redux tanımının `kaynak`/`yamaHazirla` mantığını aynen kullanır; `paketKimligi: "metro2033redux"` ile aynı paket ve depo paylaşılır, yedek klasörü ayrıdır. `OYUNLAR` listesine eklenince Steam/Epic/elle bulma, servis ve arayüz kendiliğinden kapsar.

**Tech Stack:** TypeScript, Vitest, Electron (değişmiyor).

**Spec:** `docs/superpowers/specs/2026-11-18-metro-last-light-redux-design.md`

## Global Constraints

- kimlik `metrolastlightredux`, ad `Metro Last Light Redux`, steamAppId `287390`, klasorAdi `Metro Last Light Redux`, motor `4a`, surecAdi `metro.exe`.
- tanimaDosyalari `["metro.exe", "content.vfx", "outro_good.ogv"]`.
- temizDizinOzeti `be4bfff4b62d18563ba64693126f623a1479bf6f71ef1415c14b3bb320bf9428` (18 Kasım, Steam, yeni nesil güncelleme sonrası).
- paketKimligi `metro2033redux`; yeni `.tr.json` paketi YOK.
- `OYUNLAR` sırası: Metro 2033 Redux, Metro Last Light Redux, Metro Exodus normal, Metro Exodus EE.
- Commit mesajlarına Claude imza satırı EKLENMEZ (kullanıcı kuralı).

## Review Focus

1. Metro 2033 Redux klasörü Last Light sanılmamalı, tersi de (aynı exe ve dizin adları). → Task 1 elle testi.
2. `steam_appid.txt` 287390 olan ama `outro_good.ogv` içermeyen klasör (eksik kurulum) tanınmamalı; mevcut "Last Light" ret testi geçmeye devam etmeli. → Task 1.
3. Ortak paket Last Light'ın bütün satırlarını kapsamalı; bir satır eksikse İngilizce kalır, kullanıcı fark etmez. → Task 2 gerçek oyun testi (21442/21442).
4. Yama hazırlanırken atlanan font olmamalı (Türkçe harf kutucuk çıkar). → Task 2.
5. Last Light'ın yedeği Metro 2033'ünkünden ayrı klasörde olmalı (birini kaldırmak ötekini bozmasın). → Task 1 tanım testi.

---

### Task 1: Last Light tanımı ve tanıma

**Files:**
- Create: `src/oyunlar/metrolastlightredux.ts`
- Modify: `src/oyunlar/tanim.ts` (import + `OYUNLAR`)
- Modify: `scripts/ortak.ts:13` (`TANIMLAR`'a `metrolastlightredux`)
- Test: `tests/oyunlar/tanim.test.ts`, `tests/oyunlar/elle.test.ts`

**Interfaces:**
- Produces: `export const METRO_LAST_LIGHT_REDUX: OyunTanimi` — `{ ...METRO_2033_REDUX, <Global Constraints alanları> }`.

- [ ] **Step 1: Failing tests**

`tanim.test.ts`, yeni `it("Metro Last Light Redux (287390): ayrı yedek, Metro 2033 ile ortak paket ve depo")`:
```ts
expect(METRO_LAST_LIGHT_REDUX).toMatchObject({ kimlik: "metrolastlightredux", ad: "Metro Last Light Redux", steamAppId: 287390, klasorAdi: "Metro Last Light Redux", motor: "4a", surecAdi: "metro.exe" });
expect(OYUNLAR.indexOf(METRO_LAST_LIGHT_REDUX)).toBe(OYUNLAR.indexOf(METRO_2033_REDUX) + 1);
expect(tanimBul(287390, "x")).toBe(METRO_LAST_LIGHT_REDUX);
expect(tanimBul(undefined, "Metro Last Light Redux")).toBe(METRO_LAST_LIGHT_REDUX);
expect(paketKimligi(METRO_LAST_LIGHT_REDUX)).toBe("metro2033redux");
expect(depoKlasoru(METRO_LAST_LIGHT_REDUX)).toBe(depoKlasoru(METRO_2033_REDUX));
expect(yedekKlasoru(METRO_LAST_LIGHT_REDUX)).not.toBe(yedekKlasoru(METRO_2033_REDUX));
```

`elle.test.ts`, yeni `it("Last Light Redux, outro_good.ogv'den tanınır; Metro 2033 ile karışmaz")`: `metro.exe`, `content.vfx`, `outro_good.ogv` olan klasör → `metrolastlightredux` (appid'siz ve `287390` ile); aynı üst klasördeki `metroYap` klasörü → `metro2033redux`; `steam_appid.txt` `286690` yazılmış Last Light klasörü → `undefined`. Mevcut "başka bir oyunu ... kabul etmez" testi değişmeden geçmeli.

- [ ] **Step 2: Run** `npx vitest run tests/oyunlar` → yeni testler FAIL (import yok).
- [ ] **Step 3: Implement** `metrolastlightredux.ts` + `OYUNLAR` + `scripts/ortak.ts`.
- [ ] **Step 4: Run** `npx vitest run` → hepsi PASS; `npx tsc --noEmit -p .` temiz. `secimHatasi` "Şu an Türkçesi hazır oyunlar" listesi Last Light'ı da içermeli (çıktıyı göz ile kontrol).
- [ ] **Step 5: Commit** `Metro Last Light Redux (Steam 287390) desteği: Metro 2033 Redux paketini paylaşır`

### Task 2: Gerçek oyun doğrulaması (oyuna yazmadan)

**Files:**
- Modify: `tests/yardimci.ts` (`LAST_LIGHT_DIR`, `lastLightYok`; varsayılan `C:/Program Files (x86)/Steam/steamapps/common/Metro Last Light Redux`, ortam değişkeni `LAST_LIGHT_DIR`; orijinal vfx: kuruluysa `yedekler/metrolastlightredux/orijinal/content.vfx`, değilse klasördeki)
- Test: `tests/oyunlar/tanim.test.ts` (`describe.skipIf(lastLightYok)("Last Light tanımı (gerçek oyun)")`)

**Interfaces:**
- Consumes: `METRO_LAST_LIGHT_REDUX` (Task 1), `paketler/metro2033redux.tr.json`, `kaynakOzeti` (`src/ceviri/satirlar.ts`).

- [ ] **Step 1: Tests**
  - `kaynak` → `satirlar.length === 21442`; her satırın anahtarı pakette var ve `paket.satirlar[a].kaynakOzeti === kaynakOzeti(en)` (eşleşmeyen sayısı `0`).
  - `yamaHazirla(LAST_LIGHT_DIR, paketten Map, vfx)` → `atlananFontlar` `[]`, `yamalananFontlar.length >= 5`, `degisecek` anahtarları `["content.vfx"]`, `eklenecek`'te tek `.vfs0`.
- [ ] **Step 2: Run** `npx vitest run tests/oyunlar/tanim.test.ts` → PASS (oyun kuruluyken atlanmamalı: çıktıda "skipped" olmamalı).
- [ ] **Step 3: Commit** `Last Light: gerçek oyunda paket kapsamı ve yama testi`

### Task 3: Oyunda deneme (kod değil, işletim)

- [ ] Uygulamanın servisiyle (Exodus normaldeki `normal-kur.ts` gibi motor deposunda `arastirma/lastlight/kur.ts [kur|kaldir|durum]`) kullanıcının Last Light'ına kur; `durum` "kurulu" ve satır sayısı 21442.
- [ ] Kaldır → `content.vfx` özeti `be4bfff4…9428`'e döner, eklenen `.vfs0` silinir; sonra yeniden kur.
- [ ] Kullanıcı oyunda menü, altyazı, Türkçe harfleri kontrol eder. Yayın (0.6.0) kullanıcı onayına kalır.
