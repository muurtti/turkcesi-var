// Windows'ta bir sürecin (ör. "metro.exe") çalışıp çalışmadığı.

import { execFileSync } from "node:child_process";

export function surecAcikMi(surecAdi: string): boolean {
  try {
    const cikti = execFileSync("tasklist", ["/FI", `IMAGENAME eq ${surecAdi}`, "/NH"], { encoding: "utf8", windowsHide: true });
    return cikti.toLowerCase().includes(surecAdi.toLowerCase());
  } catch {
    return false;
  }
}
