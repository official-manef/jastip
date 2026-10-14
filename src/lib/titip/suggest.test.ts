import test from "node:test";
import assert from "node:assert/strict";
import { suggestToTarget, type SuggestCandidate } from "./suggest.ts";

const cand = (over: Partial<SuggestCandidate> & { id: string }): SuggestCandidate => ({
  name: over.id,
  unitWeightKg: 1,
  feeModel: "per_kg",
  feeRate: 10,
  maxQty: 100,
  ...over,
});

test("one candidate closes the target", () => {
  const plan = suggestToTarget({
    candidates: [cand({ id: "baju", unitWeightKg: 0.5, feeRate: 20 })],
    remainingKg: 65,
    shortfall: 40,
    currency: "USD",
  });
  // 4 units x 0.5 kg = 2 kg, USD 20/kg = USD 40 -> exactly covers shortfall.
  assert.equal(plan.lines[0].qty, 4);
  assert.equal(plan.totalService, 40);
  assert.equal(plan.achievable, true);
  assert.equal(plan.kind, "proyeksi");
});

test("capacity limits the picked quantity", () => {
  const plan = suggestToTarget({
    candidates: [cand({ id: "berat", unitWeightKg: 10, feeRate: 100, maxQty: 100 })],
    remainingKg: 25,
    shortfall: 10000,
    currency: "USD",
  });
  // need = ceil(10000/(100×10)) = 10, but capacity allows floor(25/10)=2.
  assert.equal(plan.lines[0].qty, 2);
  assert.equal(plan.totalKg, 20);
  assert.ok(plan.totalKg <= 25);
  assert.equal(plan.achievable, false);
});

test("maxQty limits the picked quantity", () => {
  const plan = suggestToTarget({
    candidates: [cand({ id: "langka", unitWeightKg: 0.1, feeRate: 10, maxQty: 3 })],
    remainingKg: 65,
    shortfall: 1000,
    currency: "USD",
  });
  assert.equal(plan.lines[0].qty, 3);
  assert.equal(plan.achievable, false);
});

test("combines several candidates, most efficient first", () => {
  const plan = suggestToTarget({
    candidates: [
      cand({ id: "murah", unitWeightKg: 1, feeRate: 5, maxQty: 2 }),
      cand({ id: "mahal", unitWeightKg: 1, feeRate: 30, maxQty: 2 }),
    ],
    remainingKg: 65,
    shortfall: 25,
    currency: "USD",
  });
  assert.equal(plan.lines[0].candidateId, "mahal");
  assert.equal(plan.achievable, true);
});

test("target beyond every candidate is achievable:false with an explanation", () => {
  const plan = suggestToTarget({
    candidates: [cand({ id: "kecil", unitWeightKg: 1, feeRate: 1, maxQty: 1 })],
    remainingKg: 65,
    shortfall: 1000,
    currency: "USD",
  });
  assert.equal(plan.achievable, false);
  assert.ok(plan.notes.some((n) => n.includes("belum menutup")));
  assert.ok(plan.notes.some((n) => n.includes("PROYEKSI")));
});

test("no candidates yields an empty plan, not a crash", () => {
  const plan = suggestToTarget({ candidates: [], remainingKg: 65, shortfall: 100, currency: "USD" });
  assert.deepEqual(plan.lines, []);
  assert.equal(plan.totalService, 0);
  assert.equal(plan.achievable, false);
});

test("zero rate is a deliberate zero and cannot cover a shortfall", () => {
  const plan = suggestToTarget({
    candidates: [cand({ id: "gratis", unitWeightKg: 1, feeRate: 0, maxQty: 10 })],
    remainingKg: 65,
    shortfall: 100,
    currency: "USD",
  });
  assert.equal(plan.totalService, 0);
  assert.equal(plan.achievable, false);
});

test("per_item fees use unit count and per-unit weight for capacity", () => {
  const plan = suggestToTarget({
    candidates: [cand({ id: "hp", feeModel: "per_item", feeRate: 30, unitWeightKg: 0.25, maxQty: 10 })],
    remainingKg: 2,
    shortfall: 200,
    currency: "USD",
  });
  // need = ceil(200/30) = 7 units; capacity allows floor(2/0.25) = 8.
  assert.equal(plan.lines[0].qty, 7);
  assert.equal(plan.totalService, 210);
  assert.equal(plan.totalKg, 1.75);
  assert.equal(plan.achievable, true);
});

test("shortfall 0 is trivially achievable", () => {
  const plan = suggestToTarget({ candidates: [], remainingKg: 0, shortfall: 0, currency: "USD" });
  assert.equal(plan.achievable, true);
  assert.equal(plan.totalService, 0);
});

test("extreme and invalid inputs never produce NaN or Infinity", () => {
  const plan = suggestToTarget({
    candidates: [
      cand({ id: "nan", unitWeightKg: Number.NaN, feeRate: Number.NaN, maxQty: Number.POSITIVE_INFINITY }),
      cand({ id: "inf", unitWeightKg: 0, feeRate: Number.POSITIVE_INFINITY, maxQty: 5 }),
      cand({ id: "neg", unitWeightKg: -1, feeRate: -5, maxQty: -3 }),
    ],
    remainingKg: Number.NaN,
    shortfall: Number.POSITIVE_INFINITY,
    currency: "",
  });
  assert.equal(Number.isFinite(plan.totalService), true);
  assert.equal(Number.isFinite(plan.totalKg), true);
  for (const l of plan.lines) {
    assert.equal(Number.isFinite(l.service), true);
    assert.equal(Number.isFinite(l.weightKg), true);
    assert.equal(Number.isFinite(l.qty), true);
  }
});

test("plan never exceeds the remaining capacity", () => {
  const plan = suggestToTarget({
    candidates: [
      cand({ id: "a", unitWeightKg: 7, feeRate: 50, maxQty: 100 }),
      cand({ id: "b", unitWeightKg: 3, feeRate: 10, maxQty: 100 }),
    ],
    remainingKg: 20,
    shortfall: 100000,
    currency: "USD",
  });
  assert.ok(plan.totalKg <= 20, `totalKg ${plan.totalKg} must fit 20`);
});
