// KULLANIM-KOSULLARI.md → build/kosullar.txt (kurulum sihirbazının "Lisans sözleşmesi" sayfası için).
// Kurulum ekranı düz metin gösterdiği için Markdown işaretleri atılır; Türkçe karakterler için UTF-8 BOM'lu yazılır.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const md = readFileSync("KULLANIM-KOSULLARI.md", "utf8");
const txt = md
  .split(/\r?\n/)
  .map((s) =>
    s
      .replace(/^#+\s*/, "")
      .replace(/^- /, "  • ")
      .replace(/\*\*(.+?)\*\*/g, "$1"),
  )
  .join("\r\n");
mkdirSync("build", { recursive: true });
writeFileSync("build/kosullar.txt", "﻿" + txt, "utf8");
console.log("build/kosullar.txt yazıldı");
