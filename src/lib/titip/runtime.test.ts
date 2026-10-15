import test from "node:test";
import assert from "node:assert/strict";
import { canClaimAdmin, databaseReady } from "./runtime.ts";

test("accounts are always ready now that auth lives in Convex", () => {
  assert.equal(databaseReady({ VERCEL: "1" }), true);
  assert.equal(databaseReady({ NODE_ENV: "production" }), true);
  assert.equal(databaseReady({ NODE_ENV: "development" }), true);
});

test("admin claim requires the exact operator-designated account id", () => {
  assert.equal(canClaimAdmin("someone", undefined), false);
  assert.equal(canClaimAdmin("someone", ""), false);
  assert.equal(canClaimAdmin("someone", "operator"), false);
  assert.equal(canClaimAdmin("operator", " operator "), true);
});
