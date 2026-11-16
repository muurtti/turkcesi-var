// Teknik hata mesajlarını kullanıcının anlayacağı Türkçeye çevirir.

export function turkceHata(e: unknown): string {
  let m = e instanceof Error ? e.message : String(e);
  // Electron IPC öneki: "Error invoking remote method 'tv:cagir': Error: …"
  m = m.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, "");
  if (/ENOSPC/i.test(m)) return "Diskte yer kalmamış. Biraz yer açıp tekrar deneyin.";
  if (/EBUSY|EPERM|EACCES|resource busy/i.test(m)) return "Dosya kullanımda; oyun açık olabilir. Oyunu kapatıp tekrar deneyin.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|Connection error/i.test(m)) return "İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.";
  return m.split("\n")[0]!;
}
