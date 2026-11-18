// Unreal Engine .pak sürüm 3: şifresiz, sıkıştırmasız, tek dosyalık ek paket. Oyunun kendi paketleri yeni sürüm
// ve şifreli olsa da Unreal bu eski, sade biçimi de yükler (Mafia: The Old Country'de oyunda doğrulandı).

import { createHash } from "node:crypto";

const SIHIRLI = 0x5a6f12e1;
const SURUM = 3;
const ALTBILGI = 44;
const KAYIT = 53;

const sha1 = (b: Buffer) => createHash("sha1").update(b).digest();

function dize(s: string): Buffer {
  const b = Buffer.from(s + "\0", "latin1");
  const n = Buffer.alloc(4);
  n.writeInt32LE(b.length);
  return Buffer.concat([n, b]);
}

/** Dosya kaydı: ofset, boyut, açılmış boyut, sıkıştırma (0), SHA-1, şifreli (0), blok boyu (0). */
function kayit(veri: Buffer): Buffer {
  const b = Buffer.alloc(KAYIT);
  b.writeBigUInt64LE(0n, 0);
  b.writeBigUInt64LE(BigInt(veri.length), 8);
  b.writeBigUInt64LE(BigInt(veri.length), 16);
  b.writeUInt32LE(0, 24);
  sha1(veri).copy(b, 28);
  return b;
}

export function pakYaz(mount: string, dosyaAdi: string, veri: Buffer): Buffer {
  const govde = Buffer.concat([kayit(veri), veri]);
  const sayi = Buffer.alloc(4);
  sayi.writeUInt32LE(1);
  const dizin = Buffer.concat([dize(mount), sayi, dize(dosyaAdi), kayit(veri)]);
  const alt = Buffer.alloc(ALTBILGI);
  alt.writeUInt32LE(SIHIRLI, 0);
  alt.writeUInt32LE(SURUM, 4);
  alt.writeBigUInt64LE(BigInt(govde.length), 8);
  alt.writeBigUInt64LE(BigInt(dizin.length), 16);
  sha1(dizin).copy(alt, 24);
  return Buffer.concat([govde, dizin, alt]);
}

/** Yalnızca pakYaz'ın ürettiği biçim (v3, şifresiz, sıkıştırmasız): testler ve tanılama için. */
export function pakOku(veri: Buffer): { mount: string; dosyalar: { ad: string; veri: Buffer }[] } {
  const alt = veri.subarray(veri.length - ALTBILGI);
  if (alt.readUInt32LE(0) !== SIHIRLI || alt.readUInt32LE(4) !== SURUM) throw new Error("Desteklenmeyen pak (yalnızca sürüm 3)");
  let k = Number(alt.readBigUInt64LE(8));
  const okuDize = () => {
    const n = veri.readInt32LE(k);
    const s = veri.toString("latin1", k + 4, k + 4 + n - 1);
    k += 4 + n;
    return s;
  };
  const mount = okuDize();
  const sayi = veri.readUInt32LE(k);
  k += 4;
  const dosyalar: { ad: string; veri: Buffer }[] = [];
  for (let i = 0; i < sayi; i++) {
    const ad = okuDize();
    const ofset = Number(veri.readBigUInt64LE(k));
    const boyut = Number(veri.readBigUInt64LE(k + 8));
    if (veri.readUInt32LE(k + 24) !== 0 || veri[k + 48] !== 0) throw new Error("Sıkıştırılmış ya da şifreli girdi desteklenmiyor");
    k += KAYIT;
    const bas = ofset + KAYIT;
    dosyalar.push({ ad, veri: Buffer.from(veri.subarray(bas, bas + boyut)) });
  }
  return { mount, dosyalar };
}
