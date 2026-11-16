// Türkçe karakterlerle ilgili motor bağımsız yardımcılar.

export const TURKCE_HARFLER = "ğĞşŞıİçÇöÖüÜ";

/**
 * Metinlerde geçip karakter tablosunda bulunmayan karakterleri kod sırasıyla, tekrarsız döndürür.
 * Tablonun 0. sırası satır sonu olarak kullanıldığı için sayılmaz.
 */
export function eksikKarakterler(metinler: string[], karakterler: string[]): string[] {
  const var_ = new Set(karakterler.slice(1));
  const eksik = new Set<string>();
  for (const m of metinler) for (const c of m) if (!var_.has(c)) eksik.add(c);
  return [...eksik].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
}
