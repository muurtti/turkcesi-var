// BC7 doku çözme/kodlama ve Metro Exodus font dokuları (".512" = LZ4 + BC7 10 mip, ".1024" = LZ4 + BC7 1 mip).
// Biçim: docs/notlar/4a-font.md ("Metro Exodus")
//
// Kodlayıcı yalnızca değişen blokları kodlamak için yazıldı: her blokta birkaç kipi ve bütün bölme desenlerini
// dener, adayı gerçekten çözüp hatasını ölçer, en iyisini seçer. Değişmeyen bloklar orijinal baytlarıyla kalır.

import { AGIRLIK, BOLME_2, BOLME_3, CAPA_2, CAPA_3_IKINCI, CAPA_3_UCUNCU } from "./bc7-tablolar.js";
import type { Doku } from "./font.js";
import { lz4BlokAc, lz4BlokSikistir } from "./lz4.js";

interface Kip {
  altKume: number;
  bolmeBiti: number;
  donusBiti: number;
  secimBiti: number;
  renkBiti: number;
  alfaBiti: number;
  ucPBiti: number;
  ortakPBiti: number;
  indeksBiti: number;
  indeks2Biti: number;
}
const k = (a: number[]): Kip => ({
  altKume: a[0]!, bolmeBiti: a[1]!, donusBiti: a[2]!, secimBiti: a[3]!, renkBiti: a[4]!,
  alfaBiti: a[5]!, ucPBiti: a[6]!, ortakPBiti: a[7]!, indeksBiti: a[8]!, indeks2Biti: a[9]!,
});
const KIPLER: Kip[] = [
  k([3, 4, 0, 0, 4, 0, 1, 0, 3, 0]), k([2, 6, 0, 0, 6, 0, 0, 1, 3, 0]), k([3, 6, 0, 0, 5, 0, 0, 0, 2, 0]), k([2, 6, 0, 0, 7, 0, 1, 0, 2, 0]),
  k([1, 0, 2, 1, 5, 6, 0, 0, 2, 3]), k([1, 0, 2, 0, 7, 8, 0, 0, 2, 2]), k([1, 0, 0, 0, 7, 7, 1, 0, 4, 0]), k([2, 6, 0, 0, 5, 5, 1, 0, 2, 0]),
];

// ---------- bit okuma / yazma ----------

class BitOkuyucu {
  private poz = 0;
  constructor(private readonly b: Uint8Array, private readonly o: number) {}
  oku(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++, this.poz++) v |= ((this.b[this.o + (this.poz >> 3)]! >> (this.poz & 7)) & 1) << i;
    return v;
  }
}

class BitYazici {
  readonly b = Buffer.alloc(16);
  private poz = 0;
  yaz(v: number, n: number): void {
    for (let i = 0; i < n; i++, this.poz++) if ((v >> i) & 1) this.b[this.poz >> 3]! |= 1 << (this.poz & 7);
  }
}

// ---------- çözme ----------

const genislet = (v: number, bit: number) => {
  v <<= 8 - bit;
  return (v | (v >> bit)) & 255;
};
const ara = (e0: number, e1: number, i: number, bit: number) => {
  const w = AGIRLIK[bit]![i]!;
  return (e0 * (64 - w) + e1 * w + 32) >> 6;
};
const altKumesi = (kip: Kip, bolme: number, i: number) =>
  kip.altKume === 1 ? 0 : kip.altKume === 2 ? BOLME_2[bolme * 16 + i]! : BOLME_3[bolme * 16 + i]!;
const capaMi = (kip: Kip, bolme: number, i: number) => {
  if (i === 0) return true;
  if (kip.altKume === 2) return i === CAPA_2[bolme];
  if (kip.altKume === 3) return i === CAPA_3_IKINCI[bolme] || i === CAPA_3_UCUNCU[bolme];
  return false;
};

/** 16 baytlık bir BC7 bloğunu 4×4 RGBA piksele (64 bayt) açar. */
export function bc7BlokCoz(veri: Uint8Array, ofset: number): Uint8Array {
  const piks = new Uint8Array(64);
  const o = new BitOkuyucu(veri, ofset);
  let kipNo = 0;
  while (kipNo < 8 && o.oku(1) === 0) kipNo++;
  if (kipNo === 8) return piks; // geçersiz blok: saydam siyah (belirtime uygun)
  const kip = KIPLER[kipNo]!;
  const bolme = o.oku(kip.bolmeBiti), donus = o.oku(kip.donusBiti), secim = o.oku(kip.secimBiti);
  const uc: number[][][] = [];
  for (let s = 0; s < kip.altKume; s++) uc.push([[0, 0, 0, 255], [0, 0, 0, 255]]);
  for (let ch = 0; ch < 3; ch++) for (let s = 0; s < kip.altKume; s++) for (let e = 0; e < 2; e++) uc[s]![e]![ch] = o.oku(kip.renkBiti);
  if (kip.alfaBiti) for (let s = 0; s < kip.altKume; s++) for (let e = 0; e < 2; e++) uc[s]![e]![3] = o.oku(kip.alfaBiti);
  const pbit: number[][] = [];
  if (kip.ucPBiti) for (let s = 0; s < kip.altKume; s++) pbit.push([o.oku(1), o.oku(1)]);
  if (kip.ortakPBiti) for (let s = 0; s < kip.altKume; s++) { const p = o.oku(1); pbit.push([p, p]); }
  const pVar = kip.ucPBiti || kip.ortakPBiti;
  for (let s = 0; s < kip.altKume; s++) {
    for (let e = 0; e < 2; e++) {
      for (let ch = 0; ch < 4; ch++) {
        if (ch === 3 && !kip.alfaBiti) continue;
        let v = uc[s]![e]![ch]!;
        let bit = ch === 3 ? kip.alfaBiti : kip.renkBiti;
        if (pVar) { v = (v << 1) | pbit[s]![e]!; bit++; }
        uc[s]![e]![ch] = genislet(v, bit);
      }
    }
  }
  const i1: number[] = [], i2: number[] = [];
  for (let i = 0; i < 16; i++) i1.push(o.oku(capaMi(kip, bolme, i) ? kip.indeksBiti - 1 : kip.indeksBiti));
  if (kip.indeks2Biti) for (let i = 0; i < 16; i++) i2.push(o.oku(i === 0 ? kip.indeks2Biti - 1 : kip.indeks2Biti));
  for (let i = 0; i < 16; i++) {
    const [e0, e1] = uc[altKumesi(kip, bolme, i)]! as [number[], number[]];
    let rI = i1[i]!, rB = kip.indeksBiti, aI = i1[i]!, aB = kip.indeksBiti;
    if (kip.indeks2Biti) {
      if (secim) { rI = i2[i]!; rB = kip.indeks2Biti; } else { aI = i2[i]!; aB = kip.indeks2Biti; }
    }
    const px = [ara(e0[0]!, e1[0]!, rI, rB), ara(e0[1]!, e1[1]!, rI, rB), ara(e0[2]!, e1[2]!, rI, rB), ara(e0[3]!, e1[3]!, aI, aB)];
    if (donus) { const t = px[3]!; px[3] = px[donus - 1]!; px[donus - 1] = t; }
    piks.set(px, i * 4);
  }
  return piks;
}

/** Bir mip seviyesini (gen×yuk) RGBA olarak açar. */
export function bc7SeviyeCoz(veri: Uint8Array, ofset: number, gen: number, yuk: number): Buffer {
  const rgba = Buffer.alloc(gen * yuk * 4);
  const bx = Math.ceil(gen / 4), by = Math.ceil(yuk / 4);
  for (let y = 0; y < by; y++) {
    for (let x = 0; x < bx; x++) {
      const p = bc7BlokCoz(veri, ofset + (y * bx + x) * 16);
      for (let i = 0; i < 16; i++) {
        const px = x * 4 + (i & 3), py = y * 4 + (i >> 2);
        if (px < gen && py < yuk) rgba.set(p.subarray(i * 4, i * 4 + 4), (py * gen + px) * 4);
      }
    }
  }
  return rgba;
}

// ---------- kodlama ----------

/** p-bitli uç değeri: v'ye en yakın kodlanabilir değer ve kodu. */
function nicemle(v: number, bit: number, p: number | undefined): { kod: number; deger: number } {
  let enIyi = { kod: 0, deger: 0 }, enAz = Infinity;
  for (let q = 0; q < 1 << bit; q++) {
    const deger = p === undefined ? genislet(q, bit) : genislet((q << 1) | p, bit + 1);
    const f = Math.abs(deger - v);
    if (f < enAz) { enAz = f; enIyi = { kod: q, deger }; }
  }
  return enIyi;
}

interface Aday { blok: Buffer; hata: number }

const hataHesapla = (a: Uint8Array, b: Uint8Array) => {
  let t = 0;
  for (let i = 0; i < 64; i++) { const d = a[i]! - b[i]!; t += d * d; }
  return t;
};

/** Bir alt kümenin uç adayları: kanal sınır kutusu ve birbirine en uzak iki piksel. */
function ucAdaylari(piks: Uint8Array, idx: number[]): [number[], number[]][] {
  const mn = [255, 255, 255, 255], mx = [0, 0, 0, 0];
  for (const i of idx) for (let c = 0; c < 4; c++) { mn[c] = Math.min(mn[c]!, piks[i * 4 + c]!); mx[c] = Math.max(mx[c]!, piks[i * 4 + c]!); }
  let a = idx[0]!, b = idx[0]!, enUzak = -1;
  for (const i of idx) for (const j of idx) {
    let d = 0;
    for (let c = 0; c < 4; c++) { const x = piks[i * 4 + c]! - piks[j * 4 + c]!; d += x * x; }
    if (d > enUzak) { enUzak = d; a = i; b = j; }
  }
  const px = (i: number) => [piks[i * 4]!, piks[i * 4 + 1]!, piks[i * 4 + 2]!, piks[i * 4 + 3]!];
  return [[mn, mx], [px(a), px(b)]];
}

/** Verilen kip ve bölmeyle bir aday blok üretir (döndürme/indeks seçimi kullanılmaz). */
function kipleKodla(kipNo: number, bolme: number, piks: Uint8Array, ucSecimi: number): Buffer {
  const kip = KIPLER[kipNo]!;
  const alfaVar = kip.alfaBiti > 0;
  const kumeler: number[][] = Array.from({ length: kip.altKume }, () => []);
  for (let i = 0; i < 16; i++) kumeler[altKumesi(kip, bolme, i)]!.push(i);

  // Uçları ve p-bitlerini seç.
  const kod: number[][][] = [], deger: number[][][] = [], pb: number[][] = [];
  for (let s = 0; s < kip.altKume; s++) {
    const idx = kumeler[s]!.length ? kumeler[s]! : [0];
    const [e0, e1] = ucAdaylari(piks, idx)[ucSecimi]!;
    const ucKod: number[][] = [], ucDeger: number[][] = [], ucP: number[] = [];
    const pSecenek = kip.ucPBiti || kip.ortakPBiti ? [0, 1] : [undefined];
    const ortakP = (() => {
      if (!kip.ortakPBiti) return undefined;
      let enIyiP = 0, enAz = Infinity;
      for (const p of [0, 1]) {
        let f = 0;
        for (const e of [e0, e1]) for (let c = 0; c < 3; c++) f += Math.abs(nicemle(e[c]!, kip.renkBiti, p).deger - e[c]!);
        if (f < enAz) { enAz = f; enIyiP = p; }
      }
      return enIyiP;
    })();
    for (const e of [e0, e1]) {
      let enIyi: { k: number[]; d: number[]; p: number } | undefined, enAz = Infinity;
      for (const p of ortakP !== undefined ? [ortakP] : pSecenek) {
        const kk: number[] = [], dd: number[] = [];
        let f = 0;
        for (let c = 0; c < 4; c++) {
          if (c === 3 && !alfaVar) { kk.push(0); dd.push(255); continue; }
          const n = nicemle(e[c]!, c === 3 ? kip.alfaBiti : kip.renkBiti, p);
          kk.push(n.kod); dd.push(n.deger); f += Math.abs(n.deger - e[c]!);
        }
        if (f < enAz) { enAz = f; enIyi = { k: kk, d: dd, p: p ?? 0 }; }
      }
      ucKod.push(enIyi!.k); ucDeger.push(enIyi!.d); ucP.push(enIyi!.p);
    }
    kod.push(ucKod); deger.push(ucDeger); pb.push(ucP);
  }

  // İndeksler: her piksel için en yakın ara renk.
  const bit = kip.indeksBiti, enCok = (1 << bit) - 1;
  const indeks = new Array<number>(16).fill(0);
  for (let i = 0; i < 16; i++) {
    const [d0, d1] = deger[altKumesi(kip, bolme, i)]! as [number[], number[]];
    let enAz = Infinity;
    for (let j = 0; j <= enCok; j++) {
      let f = 0;
      for (let c = 0; c < 4; c++) { const x = ara(d0[c]!, d1[c]!, j, bit) - piks[i * 4 + c]!; f += x * x; }
      if (f < enAz) { enAz = f; indeks[i] = j; }
    }
  }
  // Çapa piksellerinin en üst biti 0 olmalı: değilse o alt kümenin uçları yer değiştirir, indeksler ters çevrilir.
  for (let s = 0; s < kip.altKume; s++) {
    const capa = s === 0 ? 0 : kip.altKume === 2 ? CAPA_2[bolme]! : s === 1 ? CAPA_3_IKINCI[bolme]! : CAPA_3_UCUNCU[bolme]!;
    if (indeks[capa]! > enCok >> 1) {
      kod[s]!.reverse(); deger[s]!.reverse(); pb[s]!.reverse();
      for (let i = 0; i < 16; i++) if (altKumesi(kip, bolme, i) === s) indeks[i] = enCok - indeks[i]!;
    }
  }

  const y = new BitYazici();
  y.yaz(1 << kipNo, kipNo + 1);
  y.yaz(bolme, kip.bolmeBiti);
  for (let c = 0; c < 3; c++) for (let s = 0; s < kip.altKume; s++) for (let e = 0; e < 2; e++) y.yaz(kod[s]![e]![c]!, kip.renkBiti);
  if (alfaVar) for (let s = 0; s < kip.altKume; s++) for (let e = 0; e < 2; e++) y.yaz(kod[s]![e]![3]!, kip.alfaBiti);
  if (kip.ucPBiti) for (let s = 0; s < kip.altKume; s++) { y.yaz(pb[s]![0]!, 1); y.yaz(pb[s]![1]!, 1); }
  if (kip.ortakPBiti) for (let s = 0; s < kip.altKume; s++) y.yaz(pb[s]![0]!, 1);
  for (let i = 0; i < 16; i++) y.yaz(indeks[i]!, capaMi(kip, bolme, i) ? bit - 1 : bit);
  return y.b;
}

/** 4×4 RGBA (64 bayt) bloğu BC7'ye kodlar. Kip 6 (tek alt küme), 1 ve 7 (iki alt küme, 64 desen) denenir. */
export function bc7BlokKodla(piks: Uint8Array): Buffer {
  let enIyi: Aday | undefined;
  const dene = (kipNo: number, bolme: number) => {
    for (const ucSecimi of [0, 1]) {
      const blok = kipleKodla(kipNo, bolme, piks, ucSecimi);
      const hata = hataHesapla(bc7BlokCoz(blok, 0), piks);
      if (!enIyi || hata < enIyi.hata) enIyi = { blok, hata };
    }
  };
  dene(6, 0);
  if (enIyi!.hata === 0) return enIyi!.blok;
  let hepsiOpak = true;
  for (let i = 3; i < 64; i += 4) if (piks[i] !== 255) hepsiOpak = false;
  for (let bolme = 0; bolme < 64; bolme++) {
    if (hepsiOpak) dene(1, bolme);
    dene(7, bolme);
  }
  return enIyi!.blok;
}

// ---------- Exodus doku dosyaları ----------

/** BC7 bayt boyutu (gen×gen, verilen sayıda mip). */
export function bc7Boyut(gen: number, mipSayisi: number): number {
  let t = 0;
  for (let i = 0; i < mipSayisi; i++) {
    const b = Math.max(1, Math.ceil(gen / 4));
    t += b * b * 16;
    gen = Math.max(1, gen >> 1);
  }
  return t;
}

/** Dosya uzantısından doku parçasının boyutu ve mip sayısı (MetroEX MetroTexture.cpp ile aynı kural). */
export function exodusParcaBilgisi(yol: string): { boyut: number; mipSayisi: number; acikBoyut: number } {
  const boyut = Number(/\.(\d+)$/.exec(yol)?.[1]);
  if (boyut === 512) return { boyut, mipSayisi: 10, acikBoyut: bc7Boyut(512, 10) };
  if (boyut === 1024 || boyut === 2048) return { boyut, mipSayisi: 1, acikBoyut: bc7Boyut(boyut, 1) };
  throw new Error(`Exodus dokusu: bilinmeyen boyut (${yol})`);
}

export interface ExodusParca {
  yol: string;
  /** Oyundaki hali: LZ4 ile sıkıştırılmış BC7. */
  veri: Buffer;
}

/** Bir dokunun parçalarını (büyükten küçüğe, ör. .1024 sonra .512) okur; en büyük seviyeyi RGBA döndürür. */
export function exodusDokuOku(parcalar: ExodusParca[]): { doku: Doku } {
  const ilk = parcalar[0];
  if (!ilk) throw new Error("Doku dosyası yok");
  const b = exodusParcaBilgisi(ilk.yol);
  const bc7 = lz4BlokAc(ilk.veri, b.acikBoyut);
  return { doku: { gen: b.boyut, yuk: b.boyut, rgba: bc7SeviyeCoz(bc7, 0, b.boyut, b.boyut) } };
}

function yariya(rgba: Buffer, gen: number): Buffer {
  const g2 = Math.max(1, gen >> 1);
  const out = Buffer.alloc(g2 * g2 * 4);
  for (let y = 0; y < g2; y++) {
    for (let x = 0; x < g2; x++) {
      for (let c = 0; c < 4; c++) {
        let t = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
          const sx = Math.min(gen - 1, x * 2 + dx), sy = Math.min(gen - 1, y * 2 + dy);
          t += rgba[(sy * gen + sx) * 4 + c]!;
        }
        out[(y * g2 + x) * 4 + c] = Math.round(t / 4);
      }
    }
  }
  return out;
}

/**
 * Değişmiş dokuyu parçalarına geri yazar. Yalnız değişen bloklar yeniden kodlanır; küçük mip seviyelerinde de
 * yalnız değişen bölgenin altındaki bloklar yeniden üretilir. Diğer bütün bloklar orijinal baytlarıyla kalır.
 */
export function exodusDokuYaz(yeni: Doku, parcalar: ExodusParca[]): Buffer[] {
  // Seviye zinciri: her parçadaki her mip, büyükten küçüğe.
  type Seviye = { parca: number; ofset: number; gen: number };
  const seviyeler: Seviye[] = [];
  const acik = parcalar.map((p, i) => {
    const b = exodusParcaBilgisi(p.yol);
    let gen = b.boyut, ofset = 0;
    for (let m = 0; m < b.mipSayisi; m++) {
      seviyeler.push({ parca: i, ofset, gen });
      ofset += bc7Boyut(gen, 1);
      gen = Math.max(1, gen >> 1);
    }
    return Buffer.from(lz4BlokAc(p.veri, b.acikBoyut));
  });
  if (seviyeler[0]!.gen !== yeni.gen) throw new Error(`Doku boyutu tutmuyor (${yeni.gen} ≠ ${seviyeler[0]!.gen})`);

  let hedef = yeni.rgba; // bu seviyenin olması gereken görüntüsü
  let kirli: Set<number> | undefined; // bir önceki seviyede değişen bloklar
  const degisenParca = new Set<number>();
  for (const [s, sv] of seviyeler.entries()) {
    const bc7 = acik[sv.parca]!;
    const bx = Math.max(1, Math.ceil(sv.gen / 4));
    const eski = bc7SeviyeCoz(bc7, sv.ofset, sv.gen, sv.gen);
    if (s > 0) {
      // Önceki seviyenin değişen bölgesini yarıya indirerek bu seviyenin hedefini kur; diğer yerler eski kalır.
      const ust = yariya(hedef, seviyeler[s - 1]!.gen);
      hedef = Buffer.from(eski);
      const yeniKirli = new Set<number>();
      const onceBx = Math.max(1, Math.ceil(seviyeler[s - 1]!.gen / 4));
      for (const b of kirli!) {
        const ux = (b % onceBx) * 4, uy = Math.floor(b / onceBx) * 4;
        for (let y = Math.floor(uy / 2); y < Math.min(sv.gen, Math.ceil((uy + 4) / 2)); y++) {
          for (let x = Math.floor(ux / 2); x < Math.min(sv.gen, Math.ceil((ux + 4) / 2)); x++) {
            ust.copy(hedef, (y * sv.gen + x) * 4, (y * sv.gen + x) * 4, (y * sv.gen + x) * 4 + 4);
            yeniKirli.add(Math.floor(y / 4) * bx + Math.floor(x / 4));
          }
        }
      }
      kirli = yeniKirli;
    } else {
      kirli = new Set();
    }
    // Bloklar: hedef eskiden farklıysa yeniden kodla.
    for (let by = 0; by < bx; by++) {
      for (let bxx = 0; bxx < bx; bxx++) {
        const piks = new Uint8Array(64);
        let farkli = false;
        for (let i = 0; i < 16; i++) {
          const px = Math.min(sv.gen - 1, bxx * 4 + (i & 3)), py = Math.min(sv.gen - 1, by * 4 + (i >> 2));
          const o = (py * sv.gen + px) * 4;
          for (let c = 0; c < 4; c++) {
            piks[i * 4 + c] = hedef[o + c]!;
            if (hedef[o + c] !== eski[o + c]) farkli = true;
          }
        }
        const no = by * bx + bxx;
        if (!farkli) { kirli.delete(no); continue; }
        kirli.add(no);
        bc7BlokKodla(piks).copy(bc7, sv.ofset + no * 16);
        degisenParca.add(sv.parca);
      }
    }
  }
  return parcalar.map((p, i) => (degisenParca.has(i) ? lz4BlokSikistir(acik[i]!) : p.veri));
}
