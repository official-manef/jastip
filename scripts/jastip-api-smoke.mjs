import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const origin = "http://localhost:8080";
const server = spawn("npm", ["run", "dev"], { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true });
let logs = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { logs = (logs + chunk).slice(-12000); });

async function request(path, { token, method = "GET", body, foreignOrigin } = {}) {
  const response = await fetch(new URL(path, origin), {
    method, headers: { origin: foreignOrigin ?? origin, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}

async function account(role, suffix) {
  const result = await request("/api/auth/sign-up/email", { method: "POST", body: { email: `qa-${Date.now()}-${suffix}@example.invalid`, name: `QA ${suffix}`, password: "QaTripPassword123!" } });
  assert.equal(result.status, 200);
  const token = result.data.token;
  assert.ok(token);
  const selected = await request("/api/peran", { token, method: "POST", body: { role } });
  assert.equal(selected.status, 200);
  assert.equal(selected.data.role, role);
  return token;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await request("/api/readiness")).data.accountsReady === true; } catch { /* server starts asynchronously */ }
    if (ready) break;
    await pause(500);
  }
  assert.ok(ready, logs);
  const owner = await account("jastiper", "owner");
  const stranger = await account("jastiper", "stranger");
  const client = await account("klien", "client");
  assert.equal((await request("/api/trips")).status, 401);
  assert.equal((await request("/api/trips", { token: client })).status, 403);
  const scenario = { bags: 1, kgPerBag: 23, cabin: 7, tare: 3, overPerKg: 350000, hargaPerKg: 280000, margin: 40, ujiKg: 0.5, kursTry: 470, goods: [], opex: [], capex: [] };
  const book = { version: 1, activeId: "qa", trips: [{ id: "qa", name: "Private trip", date: "2026-10-15", targetOmzet: 1000000, dir: "cgk-ist", mode: "one", byDir: { "cgk-ist": scenario, "ist-cgk": scenario } }] };
  const saved = await request("/api/trips", { token: owner, method: "PUT", body: { book, revision: 0 } });
  assert.equal(saved.status, 200); assert.equal(saved.data.revision, 1);
  const loaded = await request("/api/trips", { token: owner });
  assert.deepEqual(loaded.data.book, book);
  assert.equal((await request("/api/trips?userId=owner", { token: stranger })).data.book, null);
  assert.equal((await request("/api/trips", { token: client, method: "PUT", body: { book, revision: 0 } })).status, 403);
  assert.equal((await request("/api/trips", { token: owner, method: "PUT", body: { book, revision: 0 } })).status, 409);
  assert.equal((await request("/api/trips", { token: owner, method: "PUT", body: { book, revision: 1 } })).data.revision, 2);
  assert.equal((await request("/api/trips", { token: owner, method: "PUT", body: { book, revision: 1 } })).status, 409);
  assert.equal((await request("/api/trips", { token: owner, method: "PUT", body: { book, revision: 2 }, foreignOrigin: "https://untrusted.example" })).status, 403);
  assert.equal((await request("/api/trips", { token: owner, method: "PUT", body: { book: { ...book, trips: [] }, revision: 2 } })).status, 400);
  console.log("PASS: email signup and roles; owner persistence; stranger isolation; client denial; revision conflicts; cross-origin denial; invalid backup denial.");
} catch (error) {
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
}
