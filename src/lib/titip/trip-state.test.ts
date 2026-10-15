import test from "node:test";
import assert from "node:assert/strict";
import { migrateV1, parseTrip, seedTrip } from "./trip-state.ts";
import { compute } from "./calc.ts";
import { tripLintas } from "./pricing.ts";
import { databaseReady, canClaimAdmin } from "./runtime.ts";

test("trip baru punya minimal satu kaki dan terbaca ulang tanpa berubah", () => {
  const trip = seedTrip();
  assert.equal(trip.v, 2);
  assert.ok(trip.kaki.length >= 1);
  assert.deepEqual(parseTrip(trip), trip);
});

test("trip lama (v1) dimigrasi jadi daftar kaki", () => {
  const v1 = {
    dir: "cgk-ist" as const,
    mode: "one" as const,
    cgkIst: { ...seedTripKaki("jakarta") },
    istCgk: { ...seedTripKaki("turki") },
  };
  const migrated = migrateV1(v1);
  assert.ok(migrated);
  assert.equal(migrated!.v, 2);
  assert.equal(migrated!.kaki.length, 1);
  assert.equal(migrated!.kaki[0].destinasi, "jakarta");

  const pp = migrateV1({ ...v1, mode: "pp" as const });
  assert.equal(pp!.kaki.length, 2);
  assert.equal(pp!.kaki[1].destinasi, "turki");
  assert.equal(parseTrip(v1)!.v, 2);
});

test("stored state menolak data rusak dan angka tak terbatas", () => {
  const trip = seedTrip();
  for (const value of [null, {}, { ...trip, v: 3 },
    { ...trip, kaki: [] },
    { ...trip, kaki: [{ ...trip.kaki[0], scenario: { ...trip.kaki[0].scenario, bags: Infinity } }] },
    { ...trip, kaki: [{ ...trip.kaki[0], scenario: { ...trip.kaki[0].scenario, goods: [{ id: "x", name: "QA", kg: -1, qty: 1, beli: 0 }] } }] }]) {
    assert.equal(parseTrip(value), null);
  }
});

test("baseline hitung satu kaki tetap sama dengan mesin lama", () => {
  const legs = { "cgk-ist": seedTripKaki("jakarta"), "ist-cgk": seedTripKaki("turki") };
  const one = compute("cgk-ist", legs["cgk-ist"]);
  assert.equal(one.sisa, 17.7);
  assert.equal(one.laba, -5896750);
});

test("total lintas kaki menjumlahkan jasa dan kapasitas seluruh kaki", () => {
  const trip = seedTrip();
  const total = tripLintas(trip.kaki.map((k) => ({ id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario })));
  assert.equal(total.perKaki.length, trip.kaki.length);
  assert.ok(total.capacityKg > 0);
  assert.equal(total.overKg, Math.max(0, -total.sisaKg));
});

test("akun selalu siap karena auth hidup di Convex", () => {
  assert.equal(databaseReady({ VERCEL: "1" }), true);
  assert.equal(databaseReady({ NODE_ENV: "production" }), true);
  assert.equal(databaseReady({ NODE_ENV: "development" }), true);
});

test("klaim admin butuh ID akun operator yang persis", () => {
  assert.equal(canClaimAdmin("someone", undefined), false);
  assert.equal(canClaimAdmin("someone", ""), false);
  assert.equal(canClaimAdmin("someone", "operator"), false);
  assert.equal(canClaimAdmin("operator", " operator "), true);
});

/** Skenario contoh untuk test (mesin lama). */
function seedTripKaki(which: "jakarta" | "turki") {
  if (which === "jakarta") {
    return {
      bags: 1, kgPerBag: 23, cabin: 7, tare: 3.2, overPerKg: 350000, hargaPerKg: 280000,
      margin: 40, ujiKg: 0.5, kursTry: 470,
      goods: [
        { id: "kopi", name: "Kopi biji", kg: 1, qty: 4, beli: 180000 },
        { id: "teh", name: "Teh kemasan", kg: 0.4, qty: 3, beli: 45000 },
        { id: "skin", name: "Skincare", kg: 0.25, qty: 6, beli: 85000 },
        { id: "snack", name: "Snack", kg: 0.35, qty: 4, beli: 40000 },
        { id: "batik", name: "Batik", kg: 0.5, qty: 2, beli: 250000 },
      ],
      opex: [
        { id: "tiket", label: "Tiket CGK–IST", amount: 6800000 },
        { id: "transfer", label: "Transfer bandara", amount: 250000 },
        { id: "pack", label: "Packing & lakban", amount: 150000 },
        { id: "visa", label: "E-visa Turki", amount: 750000 },
        { id: "makan", label: "Makan & lokal", amount: 400000 },
      ],
      capex: [
        { id: "koper", label: "Koper", price: 1800000, trips: 24 },
        { id: "scale", label: "Timbangan", price: 350000, trips: 40 },
        { id: "cube", label: "Packing cube", price: 220000, trips: 20 },
      ],
    };
  }
  return {
    bags: 1, kgPerBag: 30, cabin: 8, tare: 3.5, overPerKg: 380000, hargaPerKg: 420000,
    margin: 45, ujiKg: 0.4, kursTry: 470,
    goods: [
      { id: "delight", name: "Turkish delight", kg: 0.8, qty: 3, beli: 450 },
      { id: "tekstil", name: "Tekstil & scarf", kg: 0.45, qty: 4, beli: 600 },
      { id: "parfum", name: "Parfum kecil", kg: 0.15, qty: 4, beli: 900 },
      { id: "sepatu", name: "Sepatu", kg: 0.9, qty: 1, beli: 2500 },
      { id: "kurma", name: "Kurma", kg: 1, qty: 2, beli: 350 },
    ],
    opex: [
      { id: "tiket", label: "Tiket IST–CGK", amount: 7200000 },
      { id: "transfer", label: "Transfer Istanbul", amount: 300000 },
      { id: "pack", label: "Packing", amount: 180000 },
      { id: "makan", label: "Makan & lokal", amount: 500000 },
      { id: "last", label: "Antar Jakarta", amount: 200000 },
    ],
    capex: [
      { id: "koper", label: "Koper", price: 1800000, trips: 24 },
      { id: "scale", label: "Timbangan", price: 350000, trips: 40 },
      { id: "cube", label: "Packing cube", price: 220000, trips: 20 },
    ],
  };
}
