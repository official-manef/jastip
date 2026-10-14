import test from "node:test";
import assert from "node:assert/strict";
import { isSlug, legCapacity, resolveSave, rollup, slugify, uniqueSlug } from "./trips.ts";
import { seedTrip } from "./trip-state.ts";
import type { PricedGood } from "./pricing.ts";

test("slugs are derived from names and stay index-safe", () => {
  assert.equal(slugify("Trip Turki Maret"), "trip-turki-maret");
  assert.equal(slugify("  Bandara!!! "), "bandara");
  assert.equal(slugify(""), "trip");
  assert.equal(slugify("Ürgüp Balon"), "urgup-balon");
  assert.equal(isSlug("trip-2"), true);
  assert.equal(isSlug("Trip"), false);
  assert.equal(isSlug("-bad-"), false);
  assert.equal(isSlug("a".repeat(41)), false);
});

test("colliding slugs get a numeric suffix", () => {
  assert.equal(uniqueSlug("Trip Turki", []), "trip-turki");
  assert.equal(uniqueSlug("Trip Turki", ["trip-turki"]), "trip-turki-2");
  assert.equal(uniqueSlug("Trip Turki", ["trip-turki", "trip-turki-2"]), "trip-turki-3");
});

test("version mismatch is a conflict, never a silent overwrite", () => {
  assert.deepEqual(resolveSave(null, 0), { kind: "created", version: 1 });
  assert.deepEqual(resolveSave(1, 1), { kind: "saved", version: 2 });
  assert.deepEqual(resolveSave(5, 2), { kind: "conflict", version: 5 });
  assert.deepEqual(resolveSave(5, 5), { kind: "saved", version: 6 });
});

test("leg capacity mirrors compute's net quota", () => {
  const s = seedTrip().cgkIst;
  assert.equal(legCapacity(s), 26.8);
  assert.equal(legCapacity({ bags: 0, kgPerBag: 0, cabin: 3, tare: 5 }), 0);
});

test("rollup agrees with the single-leg baseline on a fresh trip", () => {
  const r = rollup(seedTrip());
  assert.equal(r.mode, "one");
  assert.equal(r.legs.length, 1);
  // Legacy seed revenue is totalKg*rate rounded; rollup uses precise line weights.
  assert.equal(r.service, 2548000);
  assert.equal(r.progress.set, false);
  assert.equal(r.currency, "IDR");
});

test("rollup counts PP service across both legs and keeps capacity per leg", () => {
  const trip = seedTrip();
  trip.mode = "pp";
  const r = rollup(trip);
  assert.equal(r.legs.length, 2);
  assert.equal(r.legs[0].dir, "cgk-ist");
  assert.equal(r.legs[1].dir, "ist-cgk");
  assert.ok(r.service > 0);
});

test("rollup surfaces target progress and mixed-currency flags", () => {
  const trip = seedTrip();
  trip.cgkIst.target = 1200;
  trip.cgkIst.hargaCurrency = "USD";
  trip.cgkIst.goods = [
    { id: "baju", name: "Baju", kg: 0.5, qty: 4, beli: 0, pricing: { model: "per_kg", rate: 20, currency: "USD" } },
    { id: "hp", name: "HP", kg: 0.25, qty: 2, beli: 0, pricing: { model: "per_item", rate: 30, currency: "IDR", unit: "unit" } },
  ] as PricedGood[];
  const r = rollup(trip);
  assert.equal(r.service, 100);
  assert.equal(r.target, 1200);
  assert.equal(r.progress.persen, 8.33);
  assert.equal(r.progress.butuh, 1100);
  assert.equal(r.hasPricing, true);
  assert.equal(r.needsRate, true);
});
