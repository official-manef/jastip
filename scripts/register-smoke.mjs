/**
 * Register flow: /masuk -> pick role -> sign-up -> /masuk/selesai -> home.
 * Prints each step's URL and the visible heading.
 */
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const email = `uji${Date.now().toString(36)}@example.invalid`;

const snap = async (label) => {
  const h = await page.locator("h1").first().innerText().catch(() => "(no h1)");
  console.log(`${label}: ${new URL(page.url()).pathname} | h1="${h.replace(/\s+/g, " ").slice(0, 60)}"`);
};

await page.goto("http://127.0.0.1:8080/masuk", { waitUntil: "networkidle" });
await snap("masuk");

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));

// 1. switch to register mode
await page.getByRole("button", { name: /Belum punya akun/i }).click();
await snap("register-mode");

// 2. fill identity + password first; the role picker only appears once
//    password and confirmation match (owner request).
await page.getByLabel("Nama").fill("Uji Pendaftar");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password", { exact: true }).fill("rahasia-rahasia-12");
await page.getByLabel("Konfirmasi password").fill("rahasia-rahasia-12");

// 3. pick the client role, then submit
await page.getByRole("button", { name: /^Klien/ }).click();
await page.getByRole("button", { name: /^Buat akun$/ }).click();
await page.waitForURL(/\/titip|\/meja|\/admin/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
await snap("after-signup");

// 4. check /api/saya from the browser session
const me = await page.evaluate(() => fetch("/api/saya", { credentials: "same-origin" }).then((r) => r.json()));
console.log("api/saya:", JSON.stringify(me));

console.log("pageerrors:", errors.length ? errors.slice(0, 4) : "none");
await browser.close();
