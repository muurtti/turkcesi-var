// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArayuzOyunu, DesteklenenOyun } from "../../src/servis/api.js";
import type { OyunDurumu } from "../../src/servis/tipler.js";
import { Uygulama } from "../../uygulama/arayuz/Uygulama.js";
import { Oyunlarim, oyunAnahtari, rozetBul } from "../../uygulama/arayuz/sayfalar/Oyunlarim.js";
import { OyunSayfasi } from "../../uygulama/arayuz/sayfalar/OyunSayfasi.js";

afterEach(cleanup);

const oyun = (ad: string, durum: ArayuzOyunu["durum"], ek: Partial<ArayuzOyunu> = {}): ArayuzOyunu => ({
  ad, klasor: `C:/oyunlar/${ad}`, durum, gorseller: {}, ...ek,
});
const METRO = oyun("Metro 2033 Redux", "destekleniyor", { kimlik: "metro2033redux", appId: 286690 });
const DESTEK: DesteklenenOyun[] = [{ kimlik: "metro2033redux", ad: "Metro 2033 Redux", klasorAdi: "Metro 2033 Redux", tanimaDosyalari: ["metro.exe", "content.vfx", "2033"] }];
const durum = (yama: OyunDurumu["yama"], uygulanabilir = 21442): OyunDurumu => ({
  tanim: { kimlik: "metro2033redux", ad: "Metro 2033 Redux" },
  klasor: "C:/oyunlar/Metro 2033 Redux",
  yama,
  ceviri: { toplam: 21442, cevrili: uygulanabilir, sorunlu: 0, uygulanabilir },
  paket: { tarih: "2026-11-14T00:00:00.000Z", satir: 21442 },
});

describe("rozetler", () => {
  it("durumları doğru adlandırır", () => {
    expect(rozetBul(METRO, durum("kurulu")).metin).toBe("Türkçe kurulu");
    expect(rozetBul(METRO, durum("yok")).metin).toBe("Türkçe hazır");
    expect(rozetBul(METRO, durum("degismis")).metin).toBe("Yeniden kurulmalı");
    expect(rozetBul(oyun("GodOfWar", "desteklenmiyor"), undefined).metin).toBe("Desteklenmiyor");
    expect(rozetBul(oyun("Counter-Strike 2", "hile-korumali"), undefined).metin).toBe("Hile korumalı");
  });
});

describe("Oyunlarım", () => {
  const ortak = { desteklenenler: DESTEK, yukleniyor: false, steamBulundu: true, onSec: vi.fn(), onKlasorSec: vi.fn() };

  it("bulunan oyun 'Türkçesi hazır' bölümünde; tıklayınca seçilir; aramayla süzülür", () => {
    const oyunlar = [METRO, oyun("GodOfWar", "desteklenmiyor"), oyun("Counter-Strike 2", "hile-korumali")];
    render(<Oyunlarim {...ortak} oyunlar={oyunlar} durumlar={{ [oyunAnahtari(METRO)]: durum("kurulu") }} />);
    const hazir = screen.getByRole("region", { name: "Türkçesi hazır" });
    expect(within(hazir).getByText("Türkçe kurulu")).toBeTruthy();
    expect(screen.queryByText("Bilgisayarında bulunamadı")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "god" } });
    expect(screen.queryByText("Counter-Strike 2")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Metro 2033 Redux/ }));
    expect(ortak.onSec).toHaveBeenCalledWith(METRO);
  });

  it("desteklenen oyun bulunamazsa hangi dosyaların aranacağını gösterir ve klasör seçtirir", () => {
    render(<Oyunlarim {...ortak} oyunlar={[]} durumlar={{}} steamBulundu={false} />);
    const kart = screen.getByRole("group", { name: /Metro 2033 Redux — bilgisayarında bulunamadı/ });
    for (const f of ["metro.exe", "content.vfx", "2033"]) expect(within(kart).getByText(f)).toBeTruthy();
    expect(within(kart).getByText(/steamapps\\common\\Metro 2033 Redux/)).toBeTruthy();
    fireEvent.click(within(kart).getByRole("button", { name: /Klasörü seç/ }));
    expect(ortak.onKlasorSec).toHaveBeenCalledWith("metro2033redux");
    expect(screen.getByText(/Steam ya da Epic Games'te kurulu oyun bulunamadı/)).toBeTruthy();
  });
});

describe("Oyun sayfası", () => {
  const islemler = { turkceYap: vi.fn(), kaldir: vi.fn(), klasoruAc: vi.fn(), geri: vi.fn() };

  it("hile korumalı oyunda 'Türkçe yap' yoktur", () => {
    render(<OyunSayfasi oyun={oyun("Counter-Strike 2", "hile-korumali")} durum={undefined} islem={undefined} {...islemler} />);
    expect(screen.queryByRole("button", { name: /Türkçe yap/ })).toBeNull();
    expect(screen.getByText(/hesap yasağı/)).toBeTruthy();
  });

  it("tek tıkla kur, kurulunca tek tıkla kaldır; güncellenmişse yeniden kur", () => {
    const { rerender } = render(<OyunSayfasi oyun={METRO} durum={durum("yok")} islem={undefined} {...islemler} />);
    fireEvent.click(screen.getByRole("button", { name: "Türkçe yap" }));
    expect(islemler.turkceYap).toHaveBeenCalled();
    rerender(<OyunSayfasi oyun={METRO} durum={durum("kurulu")} islem={undefined} {...islemler} />);
    expect(screen.queryByRole("button", { name: "Türkçe yap" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Türkçeyi kaldır/ }));
    expect(islemler.kaldir).toHaveBeenCalled();
    rerender(<OyunSayfasi oyun={METRO} durum={durum("degismis")} islem={undefined} {...islemler} />);
    expect(screen.getByText("Oyun güncellenmiş")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Türkçeyi yeniden kur/ })).toBeTruthy();
  });

  it("işlem sürerken düğme yerine ilerleme görünür", () => {
    render(<OyunSayfasi oyun={METRO} durum={durum("yok")} islem={{ tur: "yuzde", deger: 40, metin: "Oyun dosyaları yazılıyor…" }} {...islemler} />);
    expect(screen.getByText("Oyun dosyaları yazılıyor…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Türkçe yap" })).toBeNull();
  });
});

describe("Uygulama", () => {
  it("açılışta Steam güncellemesi algılanırsa Türkçeyi kendiliğinden yeniden kurar", async () => {
    let yama: OyunDurumu["yama"] = "degismis";
    const turkceYap = vi.fn(async () => {
      yama = "kurulu";
    });
    (window as unknown as { tv: unknown }).tv = {
      oyunlariTara: vi.fn().mockResolvedValue({ oyunlar: [METRO], desteklenenler: DESTEK, steamBulundu: true }),
      oyunDurumu: vi.fn(async () => durum(yama)),
      turkceYap,
      surum: vi.fn().mockResolvedValue("0.1.0"),
      guncellemeDurumu: vi.fn().mockResolvedValue({ durum: "kapali" }),
      guncellemeDinle: vi.fn(() => () => {}),
    };
    render(<Uygulama />);
    await waitFor(() => expect(turkceYap).toHaveBeenCalledWith("metro2033redux", METRO.klasor, expect.any(Function)));
    expect(await screen.findByText(/güncellenmişti; Türkçe kendiliğinden yeniden kuruldu/)).toBeTruthy();
    expect(await screen.findByText("Türkçe kurulu")).toBeTruthy();
  });

  it("klasör seçimi yanlışsa açıklayıcı hata, doğruysa oyun sayfası açılır", async () => {
    const klasorSec = vi
      .fn()
      .mockResolvedValueOnce({ hata: "Bu klasörde Metro 2033 Redux bulunamadı. İçinde metro.exe, content.vfx, 2033 olan klasörü seç." })
      .mockResolvedValueOnce({ oyun: { ...METRO, klasor: "D:/Metro", elle: true } });
    (window as unknown as { tv: unknown }).tv = {
      oyunlariTara: vi.fn().mockResolvedValue({ oyunlar: [], desteklenenler: DESTEK, steamBulundu: false }),
      oyunDurumu: vi.fn(async () => durum("yok")),
      klasorSec,
      surum: vi.fn().mockResolvedValue("0.1.0"),
      guncellemeDurumu: vi.fn().mockResolvedValue({ durum: "kapali" }),
      guncellemeDinle: vi.fn(() => () => {}),
    };
    render(<Uygulama />);
    fireEvent.click(await screen.findByRole("button", { name: "Klasörü seç" }));
    expect(await screen.findByText(/Bu klasörde Metro 2033 Redux bulunamadı/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Klasörü seç" }));
    expect(await screen.findByRole("button", { name: "Türkçe yap" })).toBeTruthy();
    const tv = (window as unknown as { tv: { oyunDurumu: ReturnType<typeof vi.fn> } }).tv;
    expect(tv.oyunDurumu).toHaveBeenCalledWith("metro2033redux", "D:/Metro");
  });

  it("Yenile yeni kurulan oyunu bulur ve bildirir", async () => {
    const oyunlariTara = vi
      .fn()
      .mockResolvedValueOnce({ oyunlar: [], desteklenenler: DESTEK, steamBulundu: true })
      .mockResolvedValueOnce({ oyunlar: [METRO], desteklenenler: DESTEK, steamBulundu: true });
    (window as unknown as { tv: unknown }).tv = {
      oyunlariTara,
      oyunDurumu: vi.fn(async () => durum("yok")),
      surum: vi.fn().mockResolvedValue("0.3.2"),
      guncellemeDurumu: vi.fn().mockResolvedValue({ durum: "guncel" }),
      guncellemeDinle: vi.fn(() => () => {}),
    };
    render(<Uygulama />);
    expect(await screen.findByText("Bilgisayarında bulunamadı")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yenile" }));
    expect(await screen.findByText("1 yeni oyun bulundu: Metro 2033 Redux")).toBeTruthy();
    expect(oyunlariTara).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Bilgisayarında bulunamadı")).toBeNull();
  });

  it("Güncellemeleri denetle: güncelse bildirir, yeni sürüm varsa 'Güncelleme var' penceresi açılır", async () => {
    const guncellemeDenetle = vi
      .fn()
      .mockResolvedValueOnce({ durum: "guncel" })
      .mockResolvedValueOnce({ durum: "indiriliyor", yuzde: 0, surum: "0.4.0" });
    (window as unknown as { tv: unknown }).tv = {
      oyunlariTara: vi.fn().mockResolvedValue({ oyunlar: [], desteklenenler: DESTEK, steamBulundu: true }),
      surum: vi.fn().mockResolvedValue("0.3.2"),
      guncellemeDurumu: vi.fn().mockResolvedValue({ durum: "guncel" }),
      guncellemeDinle: vi.fn(() => () => {}),
      guncellemeDenetle,
    };
    render(<Uygulama />);
    expect(await screen.findByText("Sürüm 0.3.2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Güncellemeleri denetle" }));
    expect(await screen.findByText("En güncel sürümü kullanıyorsun (0.3.2).")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Güncellemeleri denetle" }));
    expect(await screen.findByRole("alertdialog", { name: "Güncelleme var" })).toBeTruthy();
  });
});

describe("çok oyunda kalabalık olmaması", () => {
  const cokOyun: DesteklenenOyun[] = Array.from({ length: 30 }, (_, i) => ({
    kimlik: i === 0 ? "metro2033redux" : `oyun${i}`,
    ad: i === 0 ? "Metro 2033 Redux" : `Oyun ${i}`,
    klasorAdi: `Oyun ${i}`,
    tanimaDosyalari: ["oyun.exe"],
  }));
  const ortak = { yukleniyor: false, steamBulundu: true, onSec: vi.fn(), onKlasorSec: vi.fn() };

  it("kurulu Türkçe oyun büyük kartta; bulunamayan 29 oyun kapalı sade listede", () => {
    const { container } = render(<Oyunlarim {...ortak} oyunlar={[METRO]} desteklenenler={cokOyun} durumlar={{ [oyunAnahtari(METRO)]: durum("yok") }} />);
    expect(container.querySelectorAll(".one-cikan").length).toBe(1);
    const liste = container.querySelector("details.eksik-liste") as HTMLDetailsElement;
    expect(liste.open).toBe(false);
    expect(within(liste).getByText("29")).toBeTruthy();
    expect(container.querySelectorAll(".eksik-satir").length).toBe(29);
  });

  it("arama yapılınca bulunamayanlar listesi açılır", () => {
    const { container } = render(<Oyunlarim {...ortak} oyunlar={[METRO]} desteklenenler={cokOyun} durumlar={{}} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "oyun 7" } });
    expect((container.querySelector("details.eksik-liste") as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText("Oyun 7")).toBeTruthy();
  });

  it("platform filtresi yalnızca iki platform varken çıkar ve süzer", () => {
    const steamOyunu = oyun("Among Us", "desteklenmiyor", { platform: "steam" });
    const epicOyunu = oyun("Cat Quest II", "desteklenmiyor", { platform: "epic" });
    const { rerender } = render(<Oyunlarim {...ortak} oyunlar={[steamOyunu]} desteklenenler={DESTEK} durumlar={{}} />);
    expect(screen.queryByRole("tablist", { name: "Platform" })).toBeNull();
    rerender(<Oyunlarim {...ortak} oyunlar={[steamOyunu, epicOyunu]} desteklenenler={DESTEK} durumlar={{}} />);
    fireEvent.click(within(screen.getByRole("tablist", { name: "Platform" })).getByRole("tab", { name: "Epic Games" }));
    expect(screen.queryByText("Among Us")).toBeNull();
    expect(screen.getByText("Cat Quest II")).toBeTruthy();
  });
});

describe("aynı oyunun iki kurulumu", () => {
  it("Steam ve Epic kartları kendi durumlarını gösterir", () => {
    const steam = oyun("Metro 2033 Redux", "destekleniyor", { kimlik: "metro2033redux", platform: "steam", klasor: "C:/Steam/Metro" });
    const epic = oyun("Metro 2033 Redux", "destekleniyor", { kimlik: "metro2033redux", platform: "epic", klasor: "D:/Epic/Metro" });
    render(
      <Oyunlarim
        oyunlar={[steam, epic]}
        desteklenenler={DESTEK}
        durumlar={{ [oyunAnahtari(steam)]: durum("kurulu"), [oyunAnahtari(epic)]: durum("yok") }}
        yukleniyor={false}
        steamBulundu
        onSec={vi.fn()}
        onKlasorSec={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Metro 2033 Redux — Türkçe kurulu/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Metro 2033 Redux — Türkçe hazır/ })).toBeTruthy();
  });
});
