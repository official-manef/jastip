import test from "node:test";
import assert from "node:assert/strict";
import { normalize, kursTanggal } from "./kurs.ts";

/** Contoh respons ringkas provider (rates = unit per 1 IDR). */
const body = {
  result: "success",
  time_last_update_unix: 1792108951,
  rates: { USD: 5.6e-05, JPY: 0.008808, KRW: 0.074792, SGD: 7.1e-05, TRY: 0.002756 },
};

test("normalize membalik rate jadi rupiah per 1 unit + tanggal", () => {
  const snap = normalize(body);
  assert.ok(snap);
  assert.equal(snap!.sumber, "open.er-api.com");
  // 1/5.6e-05 ≈ 17857 → dibulatkan
  assert.ok(snap!.rates.USD && snap!.rates.USD > 17000 && snap!.rates.USD < 18000);
  // JPY ~113.5 → 2 desimal
  assert.ok(snap!.rates.JPY && Math.abs(snap!.rates.JPY - 113.53) < 1);
  assert.ok(snap!.updatedAt.startsWith("2026-10-15") || snap!.updatedAt.startsWith("2026-10-16"));
});

test("normalize menolak respons tanpa result/rates/tanggal", () => {
  assert.equal(normalize(null), null);
  assert.equal(normalize({ result: "error" }), null);
  assert.equal(normalize({ result: "success", rates: {} }), null);
  assert.equal(normalize({ result: "success", rates: { USD: 1e-5 } }), null);
});

test("normalize memakai time_last_update_utc bila unix tak ada", () => {
  const snap = normalize({ result: "success", time_last_update_utc: "Fri, 16 Oct 2026 00:02:31 +0000", rates: { USD: 1e-5 } });
  assert.ok(snap);
  assert.equal(snap!.updatedAt, "2026-10-16T00:02:31.000Z");
});

test("kursTanggal ramah baca, aman untuk nilai kosong", () => {
  assert.equal(kursTanggal(""), "tanggal tidak diketahui");
  assert.equal(kursTanggal("bukan tanggal"), "tanggal tidak diketahui");
  assert.match(kursTanggal("2026-10-16T00:02:31.000Z"), /16/);
});
