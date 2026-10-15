/**
 * Brand assets for the PWA: maskable icons + manifest screenshots.
 * Renders SVG in Chromium and writes the PNGs into public/.
 *
 *   node scripts/brand-assets.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = "#5c6b54";
const INK = "#ffffff";

/** Maskable: the glyph stays inside the centre 80% safe zone. */
const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <g fill="${INK}">
    <rect x="176" y="128" width="160" height="40"/>
    <path d="M236 128h44l-34 256h-44z"/>
  </g>
</svg>`;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });

async function render(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;padding:0}svg{display:block}</style>${svg}`);
  const el = await page.$("svg");
  await el.screenshot({ path: out, omitBackground: true });
  console.log("wrote", out);
}

mkdirSync("public", { recursive: true });
for (const size of [192, 512]) {
  await render(iconSvg(size), size, `public/icon-maskable-${size}.png`);
}

// Manifest screenshots: the real desk, wide and phone.
for (const [url, path, width, height] of [
  ["http://127.0.0.1:8080/meja", "public/shot-meja.png", 1280, 800],
  ["http://127.0.0.1:8080/meja", "public/shot-meja-mobile.png", 390, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path });
  console.log("wrote", path);
}

await browser.close();
