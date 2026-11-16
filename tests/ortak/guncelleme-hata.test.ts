import { describe, expect, it } from "vitest";
import { guncellemeHatasiNeden } from "../../src/ortak/guncelleme-hata.js";

describe("güncelleme hatasının nedeni", () => {
  it("sunucuda sürüm yoksa (404, latest.yml yok) internet sorunu sayılmaz", () => {
    expect(guncellemeHatasiNeden("HttpError: 404 \"method: GET url: https://github.com/turkcesivar/turkcesi-var/releases/latest/download/latest.yml\"")).toBe("yayin-yok");
    expect(guncellemeHatasiNeden("Cannot find latest.yml in the latest release artifacts")).toBe("yayin-yok");
  });

  it("bağlantı hataları internet sorunudur", () => {
    for (const m of ["net::ERR_INTERNET_DISCONNECTED", "getaddrinfo ENOTFOUND github.com", "connect ETIMEDOUT 140.82.121.4:443", "net::ERR_NAME_NOT_RESOLVED", "getaddrinfo EAI_AGAIN github.com"]) {
      expect(guncellemeHatasiNeden(m)).toBe("internet");
    }
  });

  it("diğer hatalar", () => {
    expect(guncellemeHatasiNeden("HttpError: 503 Service Unavailable")).toBe("diger");
  });
});
