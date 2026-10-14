import test from "node:test";
import assert from "node:assert/strict";
import { canClaimAdmin, databaseReady } from "./runtime.ts";

test("production with no DATABASE_URL is not account-ready", () => {
  assert.equal(databaseReady({ VERCEL: "1" }), false);
  assert.equal(databaseReady({ NODE_ENV: "production", DATABASE_URL: " " }), false);
  assert.equal(databaseReady({ NODE_ENV: "production", DATABASE_URL: "postgres://configured" }), true);
  assert.equal(databaseReady({ NODE_ENV: "development" }), true);
});

test("admin claim requires the exact operator-designated account id", () => {
  assert.equal(canClaimAdmin("someone", undefined), false);
  assert.equal(canClaimAdmin("someone", ""), false);
  assert.equal(canClaimAdmin("someone", "operator"), false);
  assert.equal(canClaimAdmin("operator", " operator "), true);
});
