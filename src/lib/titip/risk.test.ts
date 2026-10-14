import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultRiskConfig,
  evaluateRisk,
  parseRiskConfig,
  type RiskInput,
  type RiskRule,
} from "./risk.ts";

const input = (over: Partial<RiskInput> = {}): RiskInput => ({
  name: "Batik",
  category: "tekstil",
  qty: 1,
  weightKg: 1,
  value: 100,
  ...over,
});

test("no rules means everything passes", () => {
  const v = evaluateRisk(input(), []);
  assert.equal(v.level, "ok");
  assert.equal(v.blocked, false);
  assert.deepEqual(v.flags, []);
});

test("exceeding qty raises level to review", () => {
  const rule: RiskRule = {
    id: "rokok-qty", route: "cgk-ist", categories: ["rokok"],
    maxQty: 2, requiresDocument: false, note: "Batas jumlah rokok",
  };
  const v = evaluateRisk(input({ category: "rokok", qty: 3 }), [rule]);
  assert.equal(v.level, "review");
  assert.equal(v.blocked, false);
  assert.ok(v.flags.includes("rokok-qty:qty"));
});

test("exceeding value raises level to review", () => {
  const rule: RiskRule = {
    id: "hp-value", route: "cgk-ist", categories: ["elektronik"],
    maxValue: 500, requiresDocument: false, note: "Batas nilai elektronik",
  };
  assert.equal(evaluateRisk(input({ category: "elektronik", value: 600 }), [rule]).level, "review");
  assert.equal(evaluateRisk(input({ category: "elektronik", value: 500 }), [rule]).level, "ok");
});

test("requiresDocument adds the document and a review flag even under limits", () => {
  const rule: RiskRule = {
    id: "obat-doc", route: "cgk-ist", categories: ["obat"],
    requiresDocument: true, note: "Surat keterangan obat",
  };
  const v = evaluateRisk(input({ category: "obat" }), [rule]);
  assert.equal(v.level, "review");
  assert.deepEqual(v.documents, ["Surat keterangan obat"]);
  assert.ok(v.flags.includes("obat-doc:doc"));
});

test("a blocking rule that is exceeded produces blocked", () => {
  const rule: RiskRule = {
    id: "dilarang", route: "cgk-ist", categories: ["satwa"],
    maxQty: 0, blocking: true, requiresDocument: false, note: "Barang dilarang",
  };
  const v = evaluateRisk(input({ category: "satwa", qty: 1 }), [rule]);
  assert.equal(v.level, "blocked");
  assert.equal(v.blocked, true);
});

test("a category-specific rule does not touch another category", () => {
  const rule: RiskRule = {
    id: "rokok-only", route: "cgk-ist", categories: ["rokok"],
    maxQty: 1, blocking: true, requiresDocument: false, note: "Hanya rokok",
  };
  const v = evaluateRisk(input({ category: "tekstil", qty: 99 }), [rule]);
  assert.equal(v.level, "ok");
  assert.equal(v.blocked, false);
});

test("empty categories means the rule applies to every category", () => {
  const rule: RiskRule = {
    id: "all", route: "cgk-ist", categories: [],
    maxWeightKg: 5, requiresDocument: false, note: "Batas berat umum",
  };
  assert.equal(evaluateRisk(input({ category: "apa-saja", weightKg: 10 }), [rule]).level, "review");
});

test("keywords narrow a rule to matching names", () => {
  const rule: RiskRule = {
    id: "parfum", route: "cgk-ist", categories: [],
    keywords: ["parfum"], maxQty: 1, requiresDocument: false, note: "Parfum dibatasi",
  };
  assert.equal(evaluateRisk(input({ name: "Parfum kecil", qty: 4 }), [rule]).level, "review");
  assert.equal(evaluateRisk(input({ name: "Batik", qty: 4 }), [rule]).level, "ok");
});

test("non-finite inputs never yield NaN in reasons", () => {
  const rule: RiskRule = {
    id: "n", route: "cgk-ist", categories: [], maxQty: 1,
    requiresDocument: false, note: "Batas",
  };
  const v = evaluateRisk(input({ qty: Number.NaN, value: Number.POSITIVE_INFINITY, weightKg: Number.NEGATIVE_INFINITY }), [rule]);
  assert.ok(["ok", "review", "blocked"].includes(v.level));
  for (const r of v.reasons) assert.equal(r.includes("NaN"), false);
  assert.equal(Number.isFinite(v.flags.length), true);
});

test("defaultRiskConfig is empty and invents no legal limits", () => {
  assert.deepEqual(defaultRiskConfig(), { rules: [] });
});

test("parseRiskConfig rejects invalid shapes and returns null", () => {
  assert.equal(parseRiskConfig(null), null);
  assert.equal(parseRiskConfig({}), null);
  assert.equal(parseRiskConfig({ rules: [{ id: "x" }] }), null);
  assert.equal(
    parseRiskConfig({ rules: [{ id: "", route: "cgk-ist", categories: [], requiresDocument: false, note: "n" }] }),
    null,
  );
});

test("parseRiskConfig accepts a valid config, source and checkedAt included", () => {
  const cfg = parseRiskConfig({
    rules: [{
      id: "r1", route: "ist-cgk", categories: ["makanan"], requiresDocument: true,
      note: "Ketentuan rute Turki BELUM diperiksa", source: "https://beacukai.go.id/faq-barang-penumpang",
      checkedAt: "2026-10-14",
    }],
  });
  assert.notEqual(cfg, null);
  assert.equal(cfg?.rules[0].id, "r1");
  assert.equal(cfg?.rules[0].route, "ist-cgk");
});
