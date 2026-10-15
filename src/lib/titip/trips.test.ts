import test from "node:test";
import assert from "node:assert/strict";
import { isSlug, legCapacity, resolveSave, rollup, slugify, uniqueSlug } from "./trips.ts";
import { seedTrip } from "./trip-state.ts";
import { newKaki } from "./kaki.ts";
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
  const jakarta = seedTrip().kaki.find((k) => k.destinasi === "jakarta")!.scenario;
  assert.equal(legCapacity(jakarta), 26.8);
  assert.equal(legCapacity({ bags: 0, kgPerBag: 0, cabin: 3, tare: 5 }), 0);
});

test("rollup sums service over every leg of a fresh multi-leg trip", () => {
  const trip = seedTrip();
  const r = rollup(trip);
  assert.equal(r.legs.length, trip.kaki.length);
  assert.equal(r.legs[0].destinasi, "jakarta");
  assert.ok(r.service > 0);
  assert.equal(r.progress.set, false);
  assert.equal(r.currency, "IDR");
});

test("rollup keeps capacity per leg", () => {
  const trip = seedTrip();
  const r = rollup(trip);
  assert.equal(r.legs.length, 2);
  for (const leg of r.legs) {
    assert.ok(leg.remainingKg >= 0 || leg.overKg > 0);
  }
});

test("rollup surfaces target progress and mixed-currency flags", () => {
  // Target dihitung terhadap total jasa trip, jadi pakai satu kaki agar angkanya pasti.
  const trip = seedTrip();
  trip.kaki = [trip.kaki[0]];
  const leg = trip.kaki[0];
  leg.scenario.target = 1200;
  leg.scenario.hargaCurrency = "USD";
  leg.scenario.goods = [
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

test("transit legs start with a small quota and service tariff stays in IDR", () => {
  const transit = newKaki("singapura", "transit");
  assert.equal(transit.jenis, "transit");
  assert.equal(transit.scenario.bags, 0);
  assert.ok(legCapacity(transit.scenario) < 10);

  // F06: tarif jasa = rupiah (diturunkan dari kurs), jadi tidak mewarisi mata
  // uang belanja destinasi. Default IDR supaya label tidak salah ratusan kali.
  const jepang = newKaki("jepang", "utama");
  assert.equal(jepang.scenario.hargaCurrency, undefined);
  assert.equal(jepang.scenario.kursTry, 470);
});
