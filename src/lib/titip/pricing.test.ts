import test from "node:test";
import { seedTrip } from "./trip-state.ts";
import assert from "node:assert/strict";
import {
  capacity,
  computeRevenue,
  lineService,
  targetProgress,
  tripRevenue,
  tripFinances,
  tripLintas,
  revenueTargetProgress,
  type PricedGood,
} from "./pricing.ts";

// Fixture from docs/rencana-omzet-trip.md §8: all rates USD, capacity 65 kg,
// target USD 1200, every row counted. Weight is qty * kg/unit (kg carries the
// per-unit weight, same meaning as the legacy `Good.kg`).
const fixture: PricedGood[] = [
  { id: "baju", name: "Baju", kg: 0.5, qty: 4, beli: 0, pricing: { model: "per_kg", rate: 20, currency: "USD" } },
  { id: "rokok", name: "Rokok", kg: 0.2, qty: 5, beli: 0, pricing: { model: "per_item", rate: 10, currency: "USD", unit: "slop" } },
  { id: "hp", name: "HP", kg: 0.25, qty: 2, beli: 0, pricing: { model: "per_item", rate: 30, currency: "USD", unit: "unit" } },
];

test("mixed fixture: weight, per-row service, and total service", () => {
  const r = computeRevenue(fixture, 0);
  assert.equal(r.totalKg, 3.5);
  assert.deepEqual(r.rows.map((row) => row.service), [40, 50, 60]);
  assert.equal(r.service, 150);
  assert.equal(r.hasPricing, true);
  assert.deepEqual(r.currencies, ["USD"]);
  assert.equal(r.needsRate, false);
});

test("fixture target: remaining service and 12.5% achievement", () => {
  const r = computeRevenue(fixture, 0);
  const t = targetProgress(r.service, 1200);
  assert.equal(t.set, true);
  assert.equal(t.butuh, 1050);
  assert.equal(t.lebih, 0);
  assert.equal(t.persen, 12.5);
  assert.equal(t.achieved, false);
  assert.deepEqual(capacity(65, r.totalKg), {
    capacityKg: 65, usedKg: 3.5, remainingKg: 61.5, overKg: 0,
  });
});

test("changing per-unit weight moves the trip weight but not revenue", () => {
  const heavier = fixture.map((g) => (g.id === "hp" ? { ...g, kg: 0.3 } : g));
  const r = computeRevenue(heavier, 0);
  assert.equal(r.totalKg, 3.6);
  assert.equal(r.service, 150);
});

test("removing rokok drops weight and revenue", () => {
  const without = fixture.filter((g) => g.id !== "rokok");
  const r = computeRevenue(without, 0);
  assert.equal(r.totalKg, 2.5);
  assert.equal(r.service, 100);
});

test("product purchase value is separate from service revenue", () => {
  const withBeli = fixture.map((g) => (g.id === "baju" ? { ...g, beli: 10 } : g));
  const base = computeRevenue(fixture, 0);
  const r = computeRevenue(withBeli, 0);
  assert.equal(r.service, base.service);
  assert.equal(r.rows[0].beliTotal, 40);
  assert.equal(base.rows[0].beliTotal, 0);
});

test("small per-kg rows keep sub-gram precision instead of a 0.1 kg round", () => {
  // 3 x 0.25 kg at USD 10/kg = USD 7.50; the legacy round1(total) path lost this.
  const grams: PricedGood[] = [
    { id: "x", name: "Barang gram", kg: 0.25, qty: 3, beli: 0, pricing: { model: "per_kg", rate: 10, currency: "USD" } },
  ];
  assert.equal(computeRevenue(grams, 0).service, 7.5);
});

test("empty and zero targets never yield NaN/Infinity", () => {
  for (const target of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const t = targetProgress(150, target);
    assert.equal(t.set, false);
    assert.equal(t.persen, 0);
    assert.equal(Number.isFinite(t.persen), true);
  }
});

test("over-target reports the excess instead of a negative need", () => {
  const t = targetProgress(1500, 1200);
  assert.equal(t.achieved, true);
  assert.equal(t.butuh, 0);
  assert.equal(t.lebih, 300);
  assert.equal(t.persen, 125);
});

test("unpriced rows fall back to the global per-kg rate", () => {
  const legacy = [{ id: "kopi", name: "Kopi", kg: 1, qty: 4, beli: 180000 }];
  const r = computeRevenue(legacy, 280000);
  assert.equal(r.hasPricing, false);
  assert.equal(r.service, 1120000);
});

test("disagreeing currencies flag the need for an explicit rate", () => {
  const mixed: PricedGood[] = [
    { id: "a", name: "A", kg: 1, qty: 1, beli: 0, pricing: { model: "per_kg", rate: 20, currency: "USD" } },
    { id: "b", name: "B", kg: 1, qty: 1, beli: 0, pricing: { model: "per_kg", rate: 400000, currency: "IDR" } },
  ];
  const r = computeRevenue(mixed, 0);
  assert.equal(r.needsRate, true);
  assert.deepEqual(r.currencies, ["USD", "IDR"]);
});

test("zero rate stays a deliberate zero, not a NaN", () => {
  const zero: PricedGood[] = [
    { id: "gift", name: "Bonus", kg: 1, qty: 1, beli: 0, pricing: { model: "per_kg", rate: 0, currency: "USD" } },
  ];
  assert.equal(computeRevenue(zero, 0).service, 0);
});

test("invalid weights and rates are rejected, never silently NaN", () => {
  assert.equal(lineService({ id: "x", name: "X", kg: Number.NaN, qty: 1, beli: 0 }, 100), 0);
  assert.equal(lineService({ id: "x", name: "X", kg: -1, qty: 1, beli: 0 }, 100), 0);
  assert.equal(
    lineService({ id: "x", name: "X", kg: 1, qty: 1, beli: 0, pricing: { model: "per_kg", rate: Number.NaN } } as PricedGood, 100),
    0,
  );
});

test("PP sums service across both legs and keeps capacity per leg", () => {
  const byDir = {
    "cgk-ist": { goods: [{ id: "a", name: "A", kg: 1, qty: 1, beli: 0, pricing: { model: "per_kg", rate: 20, currency: "USD" } }] as PricedGood[], hargaPerKg: 0 },
    "ist-cgk": { goods: [{ id: "b", name: "B", kg: 1, qty: 1, beli: 0, pricing: { model: "per_item", rate: 30, currency: "USD", unit: "unit" } }] as PricedGood[], hargaPerKg: 0 },
  };
  const one = tripRevenue("one", "cgk-ist", byDir);
  assert.equal(one.legs.length, 1);
  assert.equal(one.service, 20);
  const pp = tripRevenue("pp", "cgk-ist", byDir);
  assert.equal(pp.legs.length, 2);
  assert.equal(pp.service, 50);
  // capacity is computed per leg, not summed here
  assert.deepEqual(pp.legs.map((l) => capacity(65, l.revenue.totalKg).remainingKg), [64, 64]);
});

test("switching the active leg tab does not change the PP total", () => {
  const byDir = {
    "cgk-ist": { goods: [{ id: "a", name: "A", kg: 1, qty: 1, beli: 0, pricing: { model: "per_kg", rate: 20, currency: "USD" } }] as PricedGood[], hargaPerKg: 0 },
    "ist-cgk": { goods: [{ id: "b", name: "B", kg: 1, qty: 1, beli: 0, pricing: { model: "per_kg", rate: 5, currency: "USD" } }] as PricedGood[], hargaPerKg: 0 },
  };
  assert.equal(tripRevenue("pp", "cgk-ist", byDir).service, tripRevenue("pp", "ist-cgk", byDir).service);
});


test("shared equipment is charged once and each overweight leg incurs its own fine", () => {
  const trip = seedTrip();
  for (const k of trip.kaki) {
    k.scenario.bags = 0; k.scenario.cabin = 1; k.scenario.tare = 0;
    k.scenario.opex = [{ id: "fare", label: "Fare", amount: 100 }];
    k.scenario.capex = [{ id: "case", label: "Case", price: 1000, trips: 10 }];
    k.scenario.hargaPerKg = 200; k.scenario.overPerKg = 50;
    k.scenario.goods = [{ id: "a", name: "A", qty: 1, kg: 2, beli: 0 }];
  }
  const f = tripFinances(trip.kaki);
  assert.equal(f.capexTrip, 100);
  assert.equal(f.beban, 400);
  assert.equal(f.laba, 400);
  trip.kaki[1].scenario.cabin = 10;
  assert.equal(tripLintas(trip.kaki).overKg, 1, "spare room on another flight cannot offset excess");
});

test("foreign revenue never becomes an IDR profit and mixed legs require a rate", () => {
  const trip = seedTrip();
  trip.kaki[0].scenario.hargaCurrency = "USD";
  assert.equal(tripLintas(trip.kaki).needsRate, true);
  assert.equal(tripFinances(trip.kaki).laba, null);
  const rev = computeRevenue(fixture, 0);
  assert.equal(revenueTargetProgress(rev, 1200, "IDR"), null);
  assert.equal(revenueTargetProgress(rev, 1200, "USD")?.persen, 12.5);
});


test("equipment on a later legacy stage is retained when the first stage is empty", () => {
  const trip = seedTrip();
  const expected = tripFinances(trip.kaki).capexTrip;
  trip.kaki[0].scenario.capex = [];
  assert.equal(tripFinances(trip.kaki).capexTrip, expected);
});
