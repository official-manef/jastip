import { z } from "zod";
import { scenarioFor, type Dir, type Scenario, type TripMode } from "./calc.ts";
import { dariTripLama, type Kaki } from "./kaki.ts";

const amount = z.number().finite().min(0).max(1_000_000_000_000);
const identity = { id: z.string().min(1).max(80), label: z.string().min(1).max(120) };
const pricingSchema = z.object({
  model: z.enum(["per_kg", "per_item"]),
  rate: amount,
  currency: z.string().min(1).max(12).optional(),
  unit: z.string().min(1).max(24).optional(),
});
const scenarioSchema = z.object({
  bags: z.number().int().min(0).max(3),
  kgPerBag: z.number().finite().min(0).max(100),
  cabin: z.number().finite().min(0).max(30),
  tare: z.number().finite().min(0).max(100),
  overPerKg: amount,
  hargaPerKg: amount,
  target: amount.optional(),
  hargaCurrency: z.string().min(1).max(12).optional(),
  margin: z.number().finite().min(0).max(1000),
  ujiKg: z.number().finite().positive().max(100),
  kursTry: z.number().finite().positive().max(1_000_000),
  goods: z.array(z.object({
    id: identity.id, name: z.string().min(2).max(80),
    kg: z.number().finite().positive().max(100),
    qty: z.number().int().min(0).max(10_000), beli: amount,
    pricing: pricingSchema.optional(),
    beliCurrency: z.string().min(1).max(12).optional(),
  })).max(200),
  opex: z.array(z.object({ ...identity, amount })).max(50),
  capex: z.array(z.object({ ...identity, price: amount, trips: z.number().int().min(1).max(10_000) })).max(50),
});

/* ---------- v1 (satu koridor dua arah) — masih dibaca untuk migrasi ---------- */

const tripV1Schema = z.object({
  dir: z.enum(["cgk-ist", "ist-cgk"]), mode: z.enum(["one", "pp"]),
  cgkIst: scenarioSchema, istCgk: scenarioSchema,
});

/* ---------- v2 (kaki bebas) ---------- */

const kakiSchema = z.object({
  id: z.string().min(1).max(80),
  destinasi: z.string().min(1).max(40),
  jenis: z.enum(["utama", "transit"]),
  lama: z.number().finite().min(0).max(3650),
  scenario: scenarioSchema,
});

const tripV2Schema = z.object({
  v: z.literal(2),
  nama: z.string().min(1).max(80),
  kaki: z.array(kakiSchema).min(1).max(24),
});

export type TripStateV1 = z.infer<typeof tripV1Schema>;
export type TripStateV2 = { v: 2; nama: string; kaki: Kaki[] };
export type TripState = TripStateV2;

export const TRIP_STORAGE_KEY = "titipin-trip-v2";

/** Trip contoh: Jakarta (belanja) → Tokyo (belanja utama). */
export function seedTrip(): TripStateV2 {
  return {
    v: 2,
    nama: "Jakarta → Tokyo",
    kaki: [
      { id: "jakarta", destinasi: "jakarta", jenis: "utama", lama: 3, scenario: scenarioFor("cgk-ist") },
      { id: "jepang", destinasi: "jepang", jenis: "utama", lama: 6, scenario: scenarioKakiJepang() },
    ],
  };
}

function scenarioKakiJepang(): Scenario {
  // Kaki Jepang contoh: kuota koper + beberapa barang khas.
  const base = scenarioFor("ist-cgk");
  return {
    ...base,
    kursTry: 105,
    hargaPerKg: 420000,
    // F06: tarif jasa = rupiah. Mata uang belanja (JPY) hanya untuk harga beli
    // barang, bukan untuk label omzet/laba.
    goods: [
      { id: "skin", name: "Skincare Jepang", kg: 0.25, qty: 6, beli: 1800 },
      { id: "fig", name: "Figure", kg: 0.4, qty: 3, beli: 3200 },
      { id: "kamera", name: "Aksesori kamera", kg: 0.3, qty: 2, beli: 4500 },
    ],
    opex: [
      { id: "tiket", label: "Tiket → Tokyo", amount: 6500000 },
      { id: "transfer", label: "Transfer Narita", amount: 350000 },
      { id: "pack", label: "Packing & lakban", amount: 150000 },
      { id: "makan", label: "Makan & lokal", amount: 900000 },
      { id: "visa", label: "Visa Jepang", amount: 500000 },
    ],
  };
}

/** Trip lama (v1) → kaki bebas. Dipakai saat memuat data perangkat/akun lama. */
export function migrateV1(value: unknown): TripStateV2 | null {
  const parsed = tripV1Schema.safeParse(value);
  if (!parsed.success) return null;
  const { nama, kaki } = dariTripLama(parsed.data);
  return { v: 2, nama, kaki };
}

export function parseTrip(value: unknown): TripStateV2 | null {
  const v2 = tripV2Schema.safeParse(value);
  if (v2.success) return v2.data as TripStateV2;
  return migrateV1(value);
}

export type { Dir, TripMode };
