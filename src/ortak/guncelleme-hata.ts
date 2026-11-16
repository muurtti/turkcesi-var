// Güncelleme denetimindeki hatanın nedeni: kullanıcıya doğru mesajı göstermek için.
// "yayin-yok": sunucuda yayımlanmış sürüm yok (ör. GitHub'da henüz Release yok) — internet sorunu DEĞİL.

export type GuncellemeHatasiNedeni = "yayin-yok" | "internet" | "diger";

export function guncellemeHatasiNeden(mesaj: string): GuncellemeHatasiNedeni {
  if (/\b404\b|cannot find .*latest\.yml|no published versions/i.test(mesaj)) return "yayin-yok";
  if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK_CHANGED|ERR_CONNECTION|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up/i.test(mesaj)) {
    return "internet";
  }
  return "diger";
}
