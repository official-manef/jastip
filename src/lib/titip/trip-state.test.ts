import test from "node:test";
import assert from "node:assert/strict";
import { parseTrip, seedTrip } from "./trip-state.ts";
import { computeTrip } from "./calc.ts";
import { databaseReady, canClaimAdmin } from "./runtime.ts";

test("one-way and PP financial baselines count capex once", () => {
  const trip = seedTrip();
  const legs = { "cgk-ist": trip.cgkIst, "ist-cgk": trip.istCgk };
  const one = computeTrip("one", "cgk-ist", legs);
  assert.equal(one.sisa, 17.7);
  assert.equal(one.laba, -5896750);
  const pp = computeTrip("pp", "cgk-ist", legs);
  assert.equal(pp.tiketTotal, 14000000);
  assert.equal(pp.capexTrip, one.capexTrip);
  assert.equal(pp.laba, -11042750);
});

test("stored state rejects corrupt data and unbounded numeric inputs", () => {
  assert.deepEqual(parseTrip(seedTrip()), seedTrip());
  for (const value of [null, {}, { ...seedTrip(), dir: "tokyo" },
    { ...seedTrip(), cgkIst: { ...seedTrip().cgkIst, bags: Infinity } },
    { ...seedTrip(), cgkIst: { ...seedTrip().cgkIst, goods: [{ id: "x", name: "QA", kg: -1, qty: 1, beli: 0 }] } }]) {
    assert.equal(parseTrip(value), null);
  }
  assert.equal("userId" in parseTrip({ ...seedTrip(), userId: "other-person" })!, false);
});

test("accounts are always ready now that auth lives in Convex", () => {
  assert.equal(databaseReady({ VERCEL: "1" }), true);
  assert.equal(databaseReady({ NODE_ENV: "production" }), true);
  assert.equal(databaseReady({ NODE_ENV: "development" }), true);
});

test("admin claims require the exact operator-designated account ID", () => {
  assert.equal(canClaimAdmin("someone", undefined), false);
  assert.equal(canClaimAdmin("someone", ""), false);
  assert.equal(canClaimAdmin("someone", "operator"), false);
  assert.equal(canClaimAdmin("operator", " operator "), true);
});
