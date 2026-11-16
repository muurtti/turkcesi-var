// Kurulum dosyasının yanına ZIP kopyası: dist/<sürüm>/TurkcesiVar-Kurulum.zip
// İçinde: kurulum exe'si + OKU-BENI.txt (nasıl kurulur). Forumlarda arşiv indirmeye alışkın kullanıcılar için;
// otomatik güncelleme yine yalnızca exe'yi kullanır.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const surum = JSON.parse(readFileSync("package.json", "utf8")).version;
const klasor = resolve("dist", surum);
const exe = join(klasor, "TurkcesiVar-Kurulum.exe");
const zip = join(klasor, "TurkcesiVar-Kurulum.zip");
if (!existsSync(exe)) throw new Error(`Kurulum dosyası yok: ${exe}`);

// Not Defteri Türkçe karakterleri doğru göstersin: UTF-8 BOM + Windows satır sonları.
const gecici = join(klasor, "zip-icerik");
rmSync(gecici, { recursive: true, force: true });
mkdirSync(gecici);
const okuBeni = join(gecici, "OKU-BENI.txt");
const metin = readFileSync("scripts/oku-beni.txt", "utf8").replace(/\r?\n/g, "\r\n");
writeFileSync(okuBeni, "﻿" + metin, "utf8");

rmSync(zip, { force: true });
execFileSync(
  "powershell",
  ["-NoProfile", "-Command", `Compress-Archive -LiteralPath '${exe}','${okuBeni}' -DestinationPath '${zip}' -CompressionLevel Optimal`],
  { stdio: "inherit" },
);
rmSync(gecici, { recursive: true, force: true });
const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(1);
console.log(`ZIP hazır: ${zip} (${mb(zip)} MB; içinde kurulum + OKU-BENI.txt)`);
