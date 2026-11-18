// Unreal Engine .locres (sürüm 3) metin tablosu okuma/yazma. Biçim: sihirli GUID + sürüm baytı, dize tablosu
// ofseti, girdi sayısı, ad alanları (hash + ad + anahtarlar: hash + ad + kaynak hash'i + dize no), sonda dize
// tablosu (dize + referans sayısı). Okunan tablo aynen yazılınca bayt bayt aynı dosya çıkar.

const SIHIRLI = Buffer.from("0e147475674a03fc4a15909dc3377f1b", "hex");
const SURUM = 3;

export interface LocresGirdisi {
  adAlani: string;
  adAlaniHash: number;
  anahtar: string;
  anahtarHash: number;
  /** İngilizce kaynak metnin hash'i: oyundaki metinle tutmazsa Unreal çeviriyi kullanmaz. */
  kaynakHash: number;
  metin: string;
  /** Ad alanının boş adı dosyada "uzunluk 1 + sıfır" olarak yazılmışsa (birebir geri yazmak için). */
  adAlaniTekSifir?: true;
}

class Okuyucu {
  konum = 0;
  constructor(private readonly b: Buffer) {}
  u32() {
    const v = this.b.readUInt32LE(this.konum);
    this.konum += 4;
    return v;
  }
  i32() {
    const v = this.b.readInt32LE(this.konum);
    this.konum += 4;
    return v;
  }
  /** FString; ikinci değer "uzunluk 1, yalnızca sıfır" biçiminde yazılmış boş dize mi. */
  dize(): [string, boolean] {
    const n = this.i32();
    if (n === 0) return ["", false];
    let s: string;
    if (n < 0) {
      s = this.b.toString("utf16le", this.konum, this.konum - 2 * n - 2);
      this.konum += -2 * n;
    } else {
      s = this.b.toString("latin1", this.konum, this.konum + n - 1);
      this.konum += n;
    }
    return [s, n === 1];
  }
}

function dizeYaz(s: string, tekSifir = false): Buffer {
  if (tekSifir && s === "") return Buffer.from([1, 0, 0, 0, 0]);
  if (s === "") return Buffer.alloc(4);
  const uzunluk = Buffer.alloc(4);
  if (/^[\x00-\x7f]*$/.test(s)) {
    uzunluk.writeInt32LE(s.length + 1);
    return Buffer.concat([uzunluk, Buffer.from(s, "latin1"), Buffer.alloc(1)]);
  }
  uzunluk.writeInt32LE(-(s.length + 1));
  return Buffer.concat([uzunluk, Buffer.from(s, "utf16le"), Buffer.alloc(2)]);
}

const u32 = (v: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0);
  return b;
};

export function locresOku(veri: Buffer): LocresGirdisi[] {
  if (!veri.subarray(0, 16).equals(SIHIRLI) || veri[16] !== SURUM) throw new Error("Desteklenmeyen locres (yalnızca sürüm 3)");
  const r = new Okuyucu(veri);
  r.konum = 17;
  const tabloOfseti = Number(veri.readBigInt64LE(r.konum));
  r.konum += 8 + 4; // ofset + toplam girdi sayısı
  const govde = r.konum;
  r.konum = tabloOfseti;
  const dizeler: string[] = [];
  for (let i = 0, n = r.u32(); i < n; i++) {
    dizeler.push(r.dize()[0]);
    r.u32(); // referans sayısı
  }
  r.konum = govde;
  const sonuc: LocresGirdisi[] = [];
  for (let i = 0, nsSayisi = r.u32(); i < nsSayisi; i++) {
    const adAlaniHash = r.u32();
    const [adAlani, tekSifir] = r.dize();
    for (let j = 0, kSayisi = r.u32(); j < kSayisi; j++) {
      const anahtarHash = r.u32();
      const [anahtar] = r.dize();
      const kaynakHash = r.u32();
      const metin = dizeler[r.i32()]!;
      sonuc.push({ adAlani, adAlaniHash, anahtar, anahtarHash, kaynakHash, metin, ...(tekSifir ? { adAlaniTekSifir: true as const } : {}) });
    }
  }
  return sonuc;
}

export function locresYaz(girdiler: LocresGirdisi[]): Buffer {
  // Aynı ad alanındaki girdiler, ad alanının ilk görüldüğü sırada tek blokta toplanır.
  const adAlanlari = new Map<string, LocresGirdisi[]>();
  for (const g of girdiler) {
    const liste = adAlanlari.get(g.adAlani);
    if (liste) liste.push(g);
    else adAlanlari.set(g.adAlani, [g]);
  }
  const dizeNo = new Map<string, number>();
  const referans: number[] = [];
  const parcalar: Buffer[] = [u32(adAlanlari.size)];
  for (const [adAlani, liste] of adAlanlari) {
    parcalar.push(u32(liste[0]!.adAlaniHash), dizeYaz(adAlani, liste[0]!.adAlaniTekSifir === true), u32(liste.length));
    for (const g of liste) {
      let no = dizeNo.get(g.metin);
      if (no === undefined) {
        no = referans.length;
        dizeNo.set(g.metin, no);
        referans.push(0);
      }
      referans[no]!++;
      const n = Buffer.alloc(4);
      n.writeInt32LE(no);
      parcalar.push(u32(g.anahtarHash), dizeYaz(g.anahtar), u32(g.kaynakHash), n);
    }
  }
  const govde = Buffer.concat(parcalar);
  const tablo: Buffer[] = [u32(referans.length)];
  for (const [metin, no] of dizeNo) {
    const r = Buffer.alloc(4);
    r.writeInt32LE(referans[no]!);
    tablo.push(dizeYaz(metin), r);
  }
  const bas = Buffer.alloc(17 + 8 + 4);
  SIHIRLI.copy(bas);
  bas[16] = SURUM;
  bas.writeBigInt64LE(BigInt(bas.length + govde.length), 17);
  bas.writeUInt32LE(girdiler.length, 25);
  return Buffer.concat([bas, govde, ...tablo]);
}
