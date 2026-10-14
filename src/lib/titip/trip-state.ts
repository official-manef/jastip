import { z } from "zod";
import { scenarioFor, type Dir, type Scenario, type TripMode } from "./calc.ts";

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

const tripSchema = z.object({
  dir: z.enum(["cgk-ist", "ist-cgk"]), mode: z.enum(["one", "pp"]),
  cgkIst: scenarioSchema, istCgk: scenarioSchema,
});

export type TripState = { dir: Dir; mode: TripMode; cgkIst: Scenario; istCgk: Scenario };
export const TRIP_STORAGE_KEY = "titipin-trip-v1";

export function seedTrip(): TripState {
  return { dir: "cgk-ist", mode: "one", cgkIst: scenarioFor("cgk-ist"), istCgk: scenarioFor("ist-cgk") };
}

export function parseTrip(value: unknown): TripState | null {
  const parsed = tripSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
