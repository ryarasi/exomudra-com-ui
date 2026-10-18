// Builds terms/, privacy/ and health-data/ index.html from the markdown in legal-src/.
// legal-src/*.md are copies of exomudra-desktop-v2/apps/shell/resources/legal/*.md
// (the in-app texts are the source of truth; refresh them with `node scripts/build-legal.mjs --from <that folder>`).
// Output is committed: the site has no build step on Cloudflare Pages.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");

const PAGES = [
  { src: "terms-of-service.md", dir: "terms", title: "Terms of Service" },
  { src: "privacy-policy.md", dir: "privacy", title: "Privacy Policy" },
  { src: "consumer-health-data-notice.md", dir: "health-data", title: "Consumer Health Data Notice" },
];

if (fromIdx >= 0) {
  const from = resolve(args[fromIdx + 1]);
  for (const p of PAGES) copyFileSync(join(from, p.src), join(root, "legal-src", p.src));
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const template = readFileSync(join(root, "scripts", "legal-template.html"), "utf8");

for (const p of PAGES) {
  let md = readFileSync(join(root, "legal-src", p.src), "utf8");
  md = md.replace(/<!--[\s\S]*?-->/g, ""); // notes meant for Ragav
  if (md.includes("{{")) throw new Error(`${p.src}: unfilled placeholder`);
  // Drop the first H1; the template renders its own.
  md = md.replace(/^# .*\n+/, "");
  const body = marked.parse(md, { gfm: true });
  const html = template
    .replaceAll("[[TITLE]]", esc(p.title))
    .replaceAll("[[SLUG]]", p.dir)
    .replace("[[BODY]]", () => body);
  mkdirSync(join(root, p.dir), { recursive: true });
  writeFileSync(join(root, p.dir, "index.html"), html);
  console.log(`wrote ${p.dir}/index.html`);
}
