// LZ4 blok biçimi (çerçevesiz). 4A Engine hem VFS parçalarında hem Exodus dokularında kullanır.

/**
 * Tek bir LZ4 bloğunu `cikti` tamponunun `konum` noktasından itibaren açar.
 * Önceki çıktı sözlük olarak kullanılabilir (bağlı bloklar). Yeni konumu döndürür.
 */
export function lz4BlokAcYerinde(kaynak: Buffer, cikti: Buffer, konum: number): number {
  let i = 0;
  let o = konum;
  while (i < kaynak.length) {
    const jeton = kaynak[i++]!;
    let literal = jeton >> 4;
    if (literal === 15) {
      let b: number;
      do {
        if (i >= kaynak.length) throw new Error("LZ4: veri yarım");
        b = kaynak[i++]!;
        literal += b;
      } while (b === 255);
    }
    if (i + literal > kaynak.length) throw new Error("LZ4: veri yarım");
    if (o + literal > cikti.length) throw new Error("LZ4: çıktı boyutu aşıldı");
    kaynak.copy(cikti, o, i, i + literal);
    i += literal;
    o += literal;
    if (i >= kaynak.length) break;

    if (i + 2 > kaynak.length) throw new Error("LZ4: veri yarım");
    const geri = kaynak[i]! | (kaynak[i + 1]! << 8);
    i += 2;
    let esles = jeton & 15;
    if (esles === 15) {
      let b: number;
      do {
        if (i >= kaynak.length) throw new Error("LZ4: veri yarım");
        b = kaynak[i++]!;
        esles += b;
      } while (b === 255);
    }
    esles += 4;
    const bas = o - geri;
    if (geri === 0 || bas < 0) throw new Error("LZ4: geçersiz geri başvuru");
    if (o + esles > cikti.length) throw new Error("LZ4: çıktı boyutu aşıldı");
    // Çakışabilen kopya; bayt bayt.
    for (let k = 0; k < esles; k++) cikti[o + k] = cikti[bas + k]!;
    o += esles;
  }
  return o;
}

/** Tek bir LZ4 bloğunu açar; açık boyut tam tutmazsa hata verir. */
export function lz4BlokAc(kaynak: Buffer, acikBoyut: number): Buffer {
  const cikti = Buffer.alloc(acikBoyut);
  const son = lz4BlokAcYerinde(kaynak, cikti, 0);
  if (son !== acikBoyut) throw new Error(`LZ4: açık boyut tutmuyor (${son} ≠ ${acikBoyut})`);
  return cikti;
}

const MIN_ESLES = 4;
const SON_LITERAL = 5; // LZ4 kuralı: son 5 bayt literal olmalı
const ESLES_SINIRI = 12; // son eşleşme, bloğun sonundan en az 12 bayt önce başlamalı
const KOSUL_BITI = 16;
const EN_UZAK = 65535;

function uzunlukYaz(cikti: number[], n: number): void {
  while (n >= 255) {
    cikti.push(255);
    n -= 255;
  }
  cikti.push(n);
}

/** Basit (açgözlü, tek karma tablolu) LZ4 blok sıkıştırıcı. Çıktısı standart LZ4 açıcılarla açılır. */
export function lz4BlokSikistir(veri: Buffer): Buffer {
  const n = veri.length;
  const cikti: number[] = [];
  const tablo = new Int32Array(1 << KOSUL_BITI).fill(-1);
  const karma = (p: number) => (Math.imul(veri.readUInt32LE(p), 2654435761) >>> (32 - KOSUL_BITI));
  let literalBas = 0;
  let p = 0;
  const sonEsles = n - ESLES_SINIRI;

  const sira = (litSon: number, geri: number, eslesUz: number) => {
    const lit = litSon - literalBas;
    const jetonKonum = cikti.length;
    cikti.push(0);
    let jeton = (Math.min(lit, 15) << 4);
    if (lit >= 15) uzunlukYaz(cikti, lit - 15);
    for (let k = literalBas; k < litSon; k++) cikti.push(veri[k]!);
    if (eslesUz > 0) {
      cikti.push(geri & 255, geri >> 8);
      const e = eslesUz - MIN_ESLES;
      jeton |= Math.min(e, 15);
      if (e >= 15) uzunlukYaz(cikti, e - 15);
    }
    cikti[jetonKonum] = jeton;
  };

  while (p < sonEsles) {
    const h = karma(p);
    const aday = tablo[h]!;
    tablo[h] = p;
    if (aday >= 0 && p - aday <= EN_UZAK && veri.readUInt32LE(aday) === veri.readUInt32LE(p)) {
      let uz = MIN_ESLES;
      const ust = n - SON_LITERAL;
      while (p + uz < ust && veri[aday + uz] === veri[p + uz]) uz++;
      sira(p, p - aday, uz);
      p += uz;
      literalBas = p;
      continue;
    }
    p++;
  }
  // Kalanlar literal.
  sira(n, 0, 0);
  return Buffer.from(cikti);
}
