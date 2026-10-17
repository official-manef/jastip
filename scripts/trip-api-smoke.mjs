import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { seedTrip } from "../src/lib/titip/trip-state.ts";

const base = new URL(process.argv[2] || "http://localhost:8080");
if (base.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(base.hostname)) {
  throw new Error("This creates synthetic accounts only in a local test server.");
}
const request = (path, cookie, method = "GET", body, extra = {}) => fetch(new URL(path, base), {
  method, headers: { origin: base.origin, "content-type": "application/json", ...(cookie ? { cookie } : {}), ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

async function account() {
  const response = await request("/api/auth/sign-up/email", "", "POST", {
    name: "Local QA", email: `${randomUUID()}@example.com`, password: randomUUID(),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie().map((s) => s.split(";", 1)[0]).join("; ");
  assert.ok(cookie);
  return cookie;
}

const a = await account();
const b = await account();
assert.equal((await request("/api/trip", "")).status, 401);
assert.equal((await request("/api/peran", a, "POST", { role: "admin" })).status, 403);
assert.equal((await request("/api/peran", a, "POST", { role: "klien" })).status, 200);
assert.equal((await request("/api/admin", a)).status, 403);
assert.equal((await request("/api/trip", a, "PUT", {})).status, 400);
assert.equal((await request("/api/trip", a, "PUT", seedTrip(), { "sec-fetch-site": "cross-site" })).status, 403);
const meB = await (await request("/api/saya", b)).json();
const trip = seedTrip();
trip.kaki[0].scenario.hargaPerKg = 333000;
assert.equal((await request("/api/trip", a, "PUT", { ...trip, userId: meB.user.id })).status, 200);
assert.deepEqual((await (await request("/api/trip", a)).json()).trip, trip);
assert.equal((await (await request("/api/trip", b)).json()).trip, null);
const created = await request("/api/titipan", a, "POST", { arah: "cgk-ist", nama: "QA titipan", kg: 1 });
assert.equal(created.status, 201);
const { id: titipanId } = await created.json();
assert.equal((await request("/api/peran", b, "POST", { role: "jastiper" })).status, 200);
assert.equal((await (await request("/api/titipan", b)).json()).rows.length, 0);
assert.equal((await request("/api/titipan", b, "PATCH", { id: titipanId, status: "selesai" })).status, 404);

assert.equal((await request("/api/titipan", b, "PATCH", { id: titipanId, jastiperId: meB.user.id })).status, 403);

console.log("PASS: local auth, admin restriction, session-owned trip storage, validation, CSRF, and unassigned jastiper isolation.");
