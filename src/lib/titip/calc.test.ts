import assert from "node:assert/strict";
import { test } from "node:test";
import { compute, computeTrip, scenarioFor } from "./calc.ts";
import { newTrip, parseTripBook, targetProgress } from "./trip-drafts.ts";
import { canClaimAdmin, databaseReady } from "./runtime.ts";

test("legacy one-way baseline remains compatible", () => {
  const n = compute("cgk-ist", scenarioFor("cgk-ist"));
  assert.equal(n.sisa, 17.7);
  assert.equal(n.laba, -5896750);
});

test("mixed rates charge kg and item rows once and retain physical weight", () => {
  const s = scenarioFor("cgk-ist");
  s.goods = [
    { id: "kg", name: "Kopi", kg: 0.25, qty: 2, beli: 100, feeMode: "kg", feeRate: 200000 },
    { id: "item", name: "Tas", kg: 1, qty: 3, beli: 500, feeMode: "item", feeRate: 50000 },
    { id: "legacy", name: "Teh", kg: 0.5, qty: 1, beli: 50 },
  ];
  const n = compute("cgk-ist", s);
  assert.equal(n.pendapatan, 390000);
  assert.equal(n.terpakai, 4);
  assert.equal(n.nilaiBeliIdr, 1750);
  s.goods[0].feeRate = 0;
  assert.equal(compute("cgk-ist", s).pendapatan, 290000);
});

test("PP total is stable when switching leg and counts capital once", () => {
  const byDir = { "cgk-ist": scenarioFor("cgk-ist"), "ist-cgk": scenarioFor("ist-cgk") };
  byDir["ist-cgk"].capex = [{ id: "different", label: "Alat", price: 100, trips: 1 }];
  const a = computeTrip("pp", "cgk-ist", byDir);
  const b = computeTrip("pp", "ist-cgk", byDir);
  assert.equal(a.tiketTotal, 14000000);
  assert.equal(a.capexTrip, 94750);
  assert.equal(a.laba, b.laba);
  assert.equal(a.breakEvenKg, b.breakEvenKg);
});

test("zero quota, zero tariff and empty goods do not produce invalid numbers", () => {
  const s = scenarioFor("cgk-ist");
  Object.assign(s, { bags: 0, cabin: 0, hargaPerKg: 0, goods: [] });
  const n = compute("cgk-ist", s);
  assert.equal(n.pendapatan, 0);
  assert.equal(n.pcsUji, 0);
  for (const value of Object.values(n)) if (typeof value === "number") assert.ok(Number.isFinite(value));
});

test("overweight applies its own leg fine, per item pricing leaves weight intact", () => {
  const s = scenarioFor("cgk-ist");
  s.goods = [{ id: "heavy", name: "Barang", kg: 30, qty: 1, beli: 0, feeMode: "item", feeRate: 100000 }];
  const n = compute("cgk-ist", s);
  assert.equal(n.overKg, 3.2);
  assert.equal(n.denda, 1120000);
  assert.equal(n.pendapatan, 100000);
});

test("trip backup validates dates, numbers, unique ids and selected trip", () => {
  const trip = newTrip("a");
  const book = { version: 1, activeId: "a", trips: [trip] };
  assert.equal(parseTripBook(JSON.stringify(book)).trips[0].byDir["cgk-ist"].goods.length, 5);
  assert.throws(() => parseTripBook(JSON.stringify({ ...book, activeId: "missing" })));
  assert.throws(() => parseTripBook(JSON.stringify({ ...book, trips: [trip, trip] })));
  assert.throws(() => parseTripBook(JSON.stringify({ ...book, trips: [{ ...trip, date: "2026-99-45" }] })));
  assert.throws(() => parseTripBook(JSON.stringify({ ...book, trips: [{ ...trip, date: "2026-02-30" }] })));
  assert.throws(() => parseTripBook(JSON.stringify({ ...book, trips: [{ ...trip, targetOmzet: -1 }] })));
  trip.byDir["cgk-ist"].goods.push(trip.byDir["cgk-ist"].goods[0]);
  assert.throws(() => parseTripBook(JSON.stringify(book)));
});

test("fresh trips do not share mutable arrays and target does not alter revenue", () => {
  const a = newTrip("a"); const b = newTrip("b");
  a.byDir["cgk-ist"].goods[0].qty = 99;
  assert.equal(b.byDir["cgk-ist"].goods[0].qty, 4);
  assert.deepEqual(targetProgress(1000000, 250000), { remaining: 750000, percent: 25 });
  assert.deepEqual(targetProgress(100000, 250000), { remaining: 0, percent: 100 });
  assert.deepEqual(targetProgress(0, 250000), { remaining: 0, percent: 0 });
});

test("hosted signup needs a durable DB and admin requires the configured owner", () => {
  assert.equal(databaseReady({ VERCEL: "1" }), false);
  assert.equal(databaseReady({ NODE_ENV: "production", DATABASE_URL: "   " }), false);
  assert.equal(databaseReady({ NODE_ENV: "production", DATABASE_URL: "postgresql://db" }), true);
  assert.equal(databaseReady({ NODE_ENV: "development" }), true);
  assert.equal(canClaimAdmin("stranger", undefined), false);
  assert.equal(canClaimAdmin("owner", "owner"), true);
  assert.equal(canClaimAdmin("stranger", "owner"), false);
});
