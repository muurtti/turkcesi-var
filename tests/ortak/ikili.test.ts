import { describe, expect, it } from "vitest";
import { IkiliOkuyucu, IkiliYazici } from "../../src/ortak/ikili.js";

describe("ikili okuma/yazma", () => {
  it("yazılan değerleri aynı sırayla geri okur", () => {
    const y = new IkiliYazici();
    y.u8(1);
    y.u16(0x0203);
    y.u32(0x04050607);
    y.u64(8n);
    y.cstr("ab");
    const o = new IkiliOkuyucu(y.sonuc());
    expect(o.u8()).toBe(1);
    expect(o.u16()).toBe(0x0203);
    expect(o.u32()).toBe(0x04050607);
    expect(o.u64()).toBe(8n);
    expect(o.cstr()).toBe("ab");
    expect(o.konum).toBe(1 + 2 + 4 + 8 + 3);
  });

  it("dosya sonunu aşınca anlaşılır hata verir", () => {
    const o = new IkiliOkuyucu(Buffer.from([1, 2]));
    expect(() => o.u32()).toThrow(new RangeError("Dosya beklenenden kısa"));
  });

  it("verilen ofsetten başlar, bayt ve atla çalışır", () => {
    const o = new IkiliOkuyucu(Buffer.from([9, 9, 1, 2, 3, 4]), 2);
    o.atla(1);
    expect([...o.bayt(2)]).toEqual([2, 3]);
    expect(o.konum).toBe(5);
  });
});
