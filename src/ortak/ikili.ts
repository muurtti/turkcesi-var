// Oyun dosyalarındaki ikili (binary) veriyi okumak ve yazmak için küçük yardımcılar.
// Bütün sayılar little-endian okunur/yazılır.

export class IkiliOkuyucu {
  konum: number;

  constructor(
    private readonly buf: Buffer,
    ofset = 0,
  ) {
    this.konum = ofset;
  }

  get kalan(): number {
    return this.buf.length - this.konum;
  }

  private ayir(n: number): number {
    if (n < 0 || this.konum + n > this.buf.length) {
      throw new RangeError("Dosya beklenenden kısa");
    }
    const k = this.konum;
    this.konum += n;
    return k;
  }

  u8(): number {
    return this.buf.readUInt8(this.ayir(1));
  }
  u16(): number {
    return this.buf.readUInt16LE(this.ayir(2));
  }
  u32(): number {
    return this.buf.readUInt32LE(this.ayir(4));
  }
  u64(): bigint {
    return this.buf.readBigUInt64LE(this.ayir(8));
  }
  /** 0 baytına kadar latin1 metin okur; 0 baytını da tüketir. */
  cstr(): string {
    const son = this.buf.indexOf(0, this.konum);
    if (son < 0) throw new RangeError("Dosya beklenenden kısa");
    const s = this.buf.toString("latin1", this.konum, son);
    this.konum = son + 1;
    return s;
  }
  bayt(n: number): Buffer {
    const k = this.ayir(n);
    return this.buf.subarray(k, k + n);
  }
  atla(n: number): void {
    this.ayir(n);
  }
}

export class IkiliYazici {
  private parcalar: Buffer[] = [];
  private uzunluk = 0;

  private ekle(b: Buffer): void {
    this.parcalar.push(b);
    this.uzunluk += b.length;
  }

  get konum(): number {
    return this.uzunluk;
  }

  u8(v: number): void {
    const b = Buffer.alloc(1);
    b.writeUInt8(v);
    this.ekle(b);
  }
  u16(v: number): void {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v);
    this.ekle(b);
  }
  u32(v: number): void {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v);
    this.ekle(b);
  }
  u64(v: bigint): void {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(v);
    this.ekle(b);
  }
  cstr(s: string): void {
    this.ekle(Buffer.from(s, "latin1"));
    this.u8(0);
  }
  bayt(b: Buffer): void {
    this.ekle(Buffer.from(b));
  }
  sonuc(): Buffer {
    return Buffer.concat(this.parcalar, this.uzunluk);
  }
}
