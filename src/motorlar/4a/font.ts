// 4A Engine (Metro Redux) fontları: config.bin içindeki glif ölçüleri ve BC1 dokular.
// Biçim: docs/notlar/4a-font.md

export interface Glif {
  x: number;
  y: number;
  gen: number;
  yuk: number;
  xOfset: number;
  yOfset: number;
  ilerleme: number;
}

export interface FontKaydi {
  /** Rol adı: "menu", "regular", "main_menu" ... */
  rol: string;
  /** Doku adı: "font\\font_metro_for_menu_us" (content/textures/ altında, uzantısız) */
  dokuAdi: string;
  satirYuksekligi: number;
  /** Sırası .lng karakter tablosunun sırasıdır. */
  glifler: Glif[];
  /** config.bin içinde ilk glif kaydının (u32 0) ofseti. */
  ofset: number;
}

export interface Doku {
  gen: number;
  yuk: number;
  rgba: Buffer;
}

const CHARS_OZETI = Buffer.from([0x56, 0x9a, 0x0f, 0x8f]);
const KAYIT_BOYU = 23;

function adListesiBul(config: Buffer, dil: string): { bas: number; dizgiler: string[] } {
  const igne = Buffer.from(`console\0font\\font_console\0${dil}\0`, "latin1");
  const p = config.indexOf(igne);
  if (p < 0) throw new Error(`config.bin: "${dil}" dili için font kütüphanesi bulunamadı`);
  // Başlık: u32 2, u32 boyut, u32 dizgiSayısı, ardından dizgiler (ilki boş).
  const bas = p - 13;
  const sayi = config.readUInt32LE(bas + 8);
  const dizgiler: string[] = [];
  let q = bas + 12;
  for (let i = 0; i < sayi; i++) {
    const son = config.indexOf(0, q);
    dizgiler.push(config.toString("latin1", q, son));
    q = son + 1;
  }
  return { bas, dizgiler };
}

/** Bir dilin bütün font kayıtlarını okur (o dilin ad listesinden önceki bölgeden). */
export function fontlariOku(config: Buffer, dil: string): FontKaydi[] {
  const { bas, dizgiler } = adListesiBul(config, dil);
  // Bölgenin başı: bir önceki dilin ad listesi (varsa).
  const onceki = config.lastIndexOf(Buffer.from("console\0font\\font_console\0", "latin1"), bas - 1);
  const alt = onceki < 0 ? 0 : onceki;

  const fontlar: FontKaydi[] = [];
  let p = config.indexOf(CHARS_OZETI, alt);
  while (p >= 0 && p < bas) {
    const rolSirasi = config.readUInt32LE(p - 20);
    const dokuSirasi = config.readUInt32LE(p - 16);
    const satirYuksekligi = config.readFloatLE(p - 4);
    const adet = config.readUInt32LE(p + 9);
    const ofset = p + 13;
    const glifler: Glif[] = [];
    for (let i = 0; i < adet; i++) {
      const k = ofset + i * KAYIT_BOYU;
      if (config.readUInt32LE(k + 4) !== 15 || config[k + 8] !== 4) {
        throw new Error(`config.bin: beklenmeyen glif kaydı (${k})`);
      }
      glifler.push({
        x: config.readInt16LE(k + 9),
        y: config.readInt16LE(k + 11),
        gen: config.readUInt16LE(k + 13),
        yuk: config.readUInt16LE(k + 15),
        xOfset: config.readInt16LE(k + 17),
        yOfset: config.readInt16LE(k + 19),
        ilerleme: config.readUInt16LE(k + 21),
      });
    }
    fontlar.push({
      rol: dizgiler[rolSirasi] ?? "",
      dokuAdi: dizgiler[dokuSirasi] ?? "",
      satirYuksekligi,
      glifler,
      ofset,
    });
    p = config.indexOf(CHARS_OZETI, ofset + adet * KAYIT_BOYU);
  }
  return fontlar;
}

/** Bir glif kaydını config.bin içinde yerinde değiştirir (boyut değişmez). */
export function glifYaz(config: Buffer, f: FontKaydi, sira: number, g: Glif): void {
  if (sira < 0 || sira >= f.glifler.length) throw new Error(`Geçersiz glif sırası: ${sira}`);
  const k = f.ofset + sira * KAYIT_BOYU;
  config.writeInt16LE(g.x, k + 9);
  config.writeInt16LE(g.y, k + 11);
  config.writeUInt16LE(g.gen, k + 13);
  config.writeUInt16LE(g.yuk, k + 15);
  config.writeInt16LE(g.xOfset, k + 17);
  config.writeInt16LE(g.yOfset, k + 19);
  config.writeUInt16LE(g.ilerleme, k + 21);
  f.glifler[sira] = { ...g };
}

/** <doku>.bin (44 bayt) içinden boyutları okur. */
export function dokuBilgisiOku(bin: Buffer): { gen: number; yuk: number } {
  return { gen: bin.readUInt32LE(6), yuk: bin.readUInt32LE(10) };
}

// ---------- BC1 ----------

function renk565(c: number): [number, number, number] {
  const r = (c >> 11) & 31;
  const g = (c >> 5) & 63;
  const b = c & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function paletKur(c0: number, c1: number): number[][] {
  const a = renk565(c0);
  const b = renk565(c1);
  if (c0 > c1) {
    return [
      [...a, 255],
      [...b, 255],
      a.map((v, i) => Math.floor((2 * v + b[i]!) / 3)).concat(255),
      a.map((v, i) => Math.floor((v + 2 * b[i]!) / 3)).concat(255),
    ];
  }
  return [[...a, 255], [...b, 255], a.map((v, i) => Math.floor((v + b[i]!) / 2)).concat(255), [0, 0, 0, 0]];
}

function bc1Ac(veri: Buffer, ofset: number, gen: number, yuk: number): Buffer {
  const out = Buffer.alloc(gen * yuk * 4);
  const bg = Math.max(1, gen / 4);
  const by = Math.max(1, yuk / 4);
  let p = ofset;
  for (let yb = 0; yb < by; yb++) {
    for (let xb = 0; xb < bg; xb++) {
      const pal = paletKur(veri.readUInt16LE(p), veri.readUInt16LE(p + 2));
      const idx = veri.readUInt32LE(p + 4);
      p += 8;
      for (let i = 0; i < 16; i++) {
        const x = xb * 4 + (i % 4);
        const y = yb * 4 + Math.floor(i / 4);
        if (x >= gen || y >= yuk) continue;
        const c = pal[(idx >>> (2 * i)) & 3]!;
        out.set(c, (y * gen + x) * 4);
      }
    }
  }
  return out;
}

function to565(r: number, g: number, b: number): number {
  return ((Math.round((r * 31) / 255) & 31) << 11) | ((Math.round((g * 63) / 255) & 63) << 5) | (Math.round((b * 31) / 255) & 31);
}

/** Basit BC1 kodlayıcı: renk kutusunun köşegeni boyunca uç renkler, 4 renk modu. */
function bc1Kodla(rgba: Buffer, gen: number, yuk: number): Buffer {
  const bg = Math.max(1, gen / 4);
  const by = Math.max(1, yuk / 4);
  const out = Buffer.alloc(bg * by * 8);
  let o = 0;
  const px: number[][] = [];
  for (let yb = 0; yb < by; yb++) {
    for (let xb = 0; xb < bg; xb++) {
      px.length = 0;
      for (let i = 0; i < 16; i++) {
        const x = Math.min(gen - 1, xb * 4 + (i % 4));
        const y = Math.min(yuk - 1, yb * 4 + Math.floor(i / 4));
        const k = (y * gen + x) * 4;
        px.push([rgba[k]!, rgba[k + 1]!, rgba[k + 2]!]);
      }
      // En uzak iki pikseli uç renk seç (parlaklık ekseninde).
      let enAz = 0;
      let enCok = 0;
      const parlak = px.map((c) => c[0]! * 2 + c[1]! * 4 + c[2]!);
      parlak.forEach((v, i) => {
        if (v < parlak[enAz]!) enAz = i;
        if (v > parlak[enCok]!) enCok = i;
      });
      let c0 = to565(px[enCok]![0]!, px[enCok]![1]!, px[enCok]![2]!);
      let c1 = to565(px[enAz]![0]!, px[enAz]![1]!, px[enAz]![2]!);
      if (c0 < c1) [c0, c1] = [c1, c0];
      let indeks = 0;
      if (c0 !== c1) {
        const pal = paletKur(c0, c1);
        for (let i = 0; i < 16; i++) {
          let enIyi = 0;
          let enIyiFark = Infinity;
          for (let j = 0; j < 4; j++) {
            const f =
              (px[i]![0]! - pal[j]![0]!) ** 2 + (px[i]![1]! - pal[j]![1]!) ** 2 + (px[i]![2]! - pal[j]![2]!) ** 2;
            if (f < enIyiFark) {
              enIyiFark = f;
              enIyi = j;
            }
          }
          indeks |= enIyi << (2 * i);
        }
      }
      out.writeUInt16LE(c0, o);
      out.writeUInt16LE(c1, o + 2);
      out.writeUInt32LE(indeks >>> 0, o + 4);
      o += 8;
    }
  }
  return out;
}

function mipBoyutu(gen: number, yuk: number): number {
  return Math.max(1, gen / 4) * Math.max(1, yuk / 4) * 8;
}

/** Başlıksız BC1 dokunun en büyük (0.) seviyesini RGBA olarak açar. */
export function dokuOku(veri: Buffer, gen: number, yuk: number): Doku {
  if (veri.length < mipBoyutu(gen, yuk)) throw new Error("Doku dosyası beklenenden kısa");
  return { gen, yuk, rgba: bc1Ac(veri, 0, gen, yuk) };
}

function yariya(rgba: Buffer, gen: number, yuk: number): Buffer {
  const g2 = Math.max(1, gen >> 1);
  const y2 = Math.max(1, yuk >> 1);
  const out = Buffer.alloc(g2 * y2 * 4);
  for (let y = 0; y < y2; y++) {
    for (let x = 0; x < g2; x++) {
      for (let c = 0; c < 4; c++) {
        let t = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
          const sx = Math.min(gen - 1, x * 2 + dx);
          const sy = Math.min(yuk - 1, y * 2 + dy);
          t += rgba[(sy * gen + sx) * 4 + c]!;
        }
        out[(y * g2 + x) * 4 + c] = Math.round(t / 4);
      }
    }
  }
  return out;
}

/** Dokuyu 2×2 ortalamayla yarı boyuta indirir. */
export function dokuYariya(d: Doku): Doku {
  return { gen: Math.max(1, d.gen >> 1), yuk: Math.max(1, d.yuk >> 1), rgba: yariya(d.rgba, d.gen, d.yuk) };
}

/**
 * Bölünmüş doku: büyük dokularda en büyük seviye ayrı dosyadadır (ör. ".1024" = 1024×1024'ün yalnızca
 * 0. seviyesi), kalan seviyeler bir sonraki dosyadadır (".512" = 512'den 1×1'e). `parcalar` büyükten küçüğe.
 */
export function bolunmusDokuOku(parcalar: Buffer[], gen: number, yuk: number): Doku {
  const ilk = parcalar[0];
  if (!ilk) throw new Error("Doku dosyası yok");
  return dokuOku(ilk, gen, yuk);
}

/** Bölünmüş dokuyu yazar: her parça bir öncekinin yarı boyutundan başlar; boyutlar şablonlarla aynı kalır. */
export function bolunmusDokuYaz(d: Doku, sablonlar: Buffer[]): Buffer[] {
  const sonuc: Buffer[] = [];
  let mevcut = d;
  for (const sablon of sablonlar) {
    sonuc.push(dokuYaz(mevcut, sablon));
    mevcut = dokuYariya(mevcut);
  }
  return sonuc;
}

/**
 * RGBA dokuyu şablonla aynı biçimde (BC1, şablondaki kadar mip seviyesiyle) yazar.
 * Mip seviyeleri yeni 0. seviyeden yeniden üretilir.
 */
export function dokuYaz(d: Doku, sablon: Buffer): Buffer {
  const parcalar: Buffer[] = [];
  let toplam = 0;
  let rgba = d.rgba;
  let gen = d.gen;
  let yuk = d.yuk;
  while (toplam < sablon.length) {
    const p = bc1Kodla(rgba, gen, yuk);
    parcalar.push(p);
    toplam += p.length;
    if (gen === 1 && yuk === 1) break;
    rgba = yariya(rgba, gen, yuk);
    gen = Math.max(1, gen >> 1);
    yuk = Math.max(1, yuk >> 1);
  }
  const sonuc = Buffer.concat(parcalar);
  if (sonuc.length !== sablon.length) {
    throw new Error(`Doku boyutu şablonla uyuşmuyor (${sonuc.length} ≠ ${sablon.length})`);
  }
  return sonuc;
}
