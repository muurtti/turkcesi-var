// GitHub'da yeni sürüm yayınlanınca Discord #duyurular kanalına Türkçe bir duyuru kartı gönderir.
// Çalıştıran: .github/workflows/discord-duyuru.yml. Gerekenler: DISCORD_WEBHOOK (gizli), DISCORD_ROL_ID (isteğe bağlı).
import { readFileSync } from "node:fs";

const olay = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const surum = olay.release;
const depo = olay.repository.full_name;
if (!surum || surum.draft || surum.prerelease) process.exit(0);

const ROL = process.env.DISCORD_ROL_ID ?? "";
const LOGO = `https://raw.githubusercontent.com/${depo}/main/docs/marka/Uygulama%20simgesi/simge-256.png`;
const numara = surum.tag_name.replace(/^v/, "");

// Sürüm notunun ilk başlığı kartın başlığıyla aynı; kurulum ve güvenlik bölümleri karttaki alanlarda zaten var.
let notlar = (surum.body ?? "")
  .replace(/\r/g, "")
  .replace(/^##[^\n]*\n+/, "")
  .split(/\n### (Nasıl kurulur|Güvenlik)/)[0]
  .trim();
if (notlar.length > 3500) notlar = `${notlar.slice(0, 3500).replace(/\n[^\n]*$/, "")}\n\n…[devamı](${surum.html_url})`;

const govde = {
  username: "Türkçesi Var",
  avatar_url: LOGO,
  ...(ROL ? { content: `<@&${ROL}> yeni sürüm yayında! 🎉` } : {}),
  allowed_mentions: { roles: ROL ? [ROL] : [] },
  embeds: [
    {
      title: `🎉 Türkçesi Var ${numara} yayında!`,
      url: surum.html_url,
      color: 0xf5c518,
      description: notlar,
      thumbnail: { url: LOGO },
      fields: [
        {
          name: "⬇️ İndir",
          value: `[TurkcesiVar-Kurulum.exe](https://github.com/${depo}/releases/latest/download/TurkcesiVar-Kurulum.exe)`,
          inline: true,
        },
        { name: "🔄 Güncelleme", value: "Uygulama kuruluysa kendisi haber verir; **İndir**'e basman yeterli.", inline: true },
        { name: "📝 Sürüm notları", value: `[GitHub'da oku](${surum.html_url})`, inline: true },
      ],
      footer: { text: "Türkçesi Var", icon_url: LOGO },
      timestamp: surum.published_at,
    },
  ],
};

const yanit = await fetch(process.env.DISCORD_WEBHOOK, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(govde),
});
if (!yanit.ok) {
  console.error("Discord yanıtı:", yanit.status, await yanit.text());
  process.exit(1);
}
console.log(`Discord duyurusu gönderildi: ${surum.tag_name}`);
