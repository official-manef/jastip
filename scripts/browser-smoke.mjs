#!/usr/bin/env node
/**
 * Browser smoke check: renders a URL at desktop AND mobile, fails on a blank
 * root, horizontal overflow, or any uncaught console/page error. Writes both
 * screenshots next to the given path and a JSON verdict beside them.
 *
 *   node scripts/browser-smoke.mjs <url> <out.png> [--baseline <json>]
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const url = args[0] ?? "http://127.0.0.1:8080/";
const outPng = args[1] ?? "screenshots/smoke.png";
const baselineIdx = args.indexOf("--baseline");
const baselinePath = baselineIdx >= 0 ? args[baselineIdx + 1] : null;

function parseUrl(value) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`bad url: ${value}`);
  return parsed;
}

const target = parseUrl(url);
mkdirSync(dirname(outPng), { recursive: true });
const mobilePng = outPng.replace(/\.png$/, "-mobile.png");
const verdictJson = outPng.replace(/\.png$/, ".json");

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const verdict = { url: target.href, ok: true, issues: [], views: {} };

for (const [name, viewport, path, full] of [
  ["desktop", { width: 1280, height: 900 }, outPng, false],
  ["mobile", { width: 390, height: 844 }, mobilePng, false],
]) {
  const page = await browser.newPage({ viewport, isMobile: name === "mobile", hasTouch: name === "mobile" });
  const errors = [];
  // Report failed resource origin and type, never query strings or URL paths
  // (which may contain sensitive user data). Do not suppress HTTP/console failures.
  page.on("response", (response) => {
    if (response.status() < 400) return;
    try {
      const origin = new URL(response.url()).origin;
      errors.push(`HTTP ${response.status()} from ${origin} (${response.request().resourceType()})`);
    } catch {
      errors.push(`HTTP ${response.status()} from unknown origin`);
    }
  });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(target.href, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  await page.screenshot({ path, fullPage: full });
  verdict.views[name] = { png: path, textLength: text.length, overflow, errors };
  if (text.length < 20) verdict.issues.push(`${name}: blank root (${text.length} chars)`);
  if (overflow) verdict.issues.push(`${name}: horizontal overflow`);
  for (const err of errors) verdict.issues.push(`${name}: console error — ${err}`);
  await page.close();
}
await browser.close();

if (baselinePath && existsSync(baselinePath)) {
  try {
    const base = JSON.parse(readFileSync(baselinePath, "utf8"));
    for (const name of ["desktop", "mobile"]) {
      const a = base.views?.[name]?.textLength ?? 0;
      const b = verdict.views[name]?.textLength ?? 0;
      if (a > 0 && b < a * 0.6) verdict.issues.push(`${name}: content shrank vs baseline (${a} → ${b})`);
    }
  } catch {
    verdict.issues.push("baseline unreadable — skipped comparison");
  }
}

verdict.ok = verdict.issues.length === 0;
writeFileSync(verdictJson, JSON.stringify(verdict, null, 2));
console.log(JSON.stringify({ ok: verdict.ok, issues: verdict.issues, views: Object.keys(verdict.views) }));
process.exit(verdict.ok ? 0 : 1);
