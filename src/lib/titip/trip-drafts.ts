import { z } from "zod";
import { scenarioFor, type Dir, type Scenario, type TripMode } from "./calc.ts";

const amount = z.number().finite().min(0).max(1_000_000_000_000);
const weight = z.number().finite().min(0).max(10000);
const identifier = z.string().min(1).max(80);
const label = z.string().min(1).max(120);
const scenarioSchema = z.object({
  bags: z.number().int().min(0).max(100), kgPerBag: weight, cabin: weight, tare: weight,
  overPerKg: amount, hargaPerKg: amount, margin: z.number().min(0).max(1000),
  ujiKg: weight, kursTry: z.number().min(0.01).max(1000000),
  goods: z.array(z.object({
    id: identifier, name: label, kg: weight, qty: z.number().int().min(0).max(100000), beli: amount,
    feeMode: z.enum(["kg", "item"]).optional(), feeRate: amount.optional(),
  }).refine((good) => good.feeMode !== "item" || good.feeRate !== undefined, "Tarif per item wajib diisi")).max(200),
  opex: z.array(z.object({ id: identifier, label, amount })).max(100),
  capex: z.array(z.object({ id: identifier, label, price: amount, trips: z.number().int().min(1).max(100000) })).max(100),
}).superRefine((s, ctx) => {
  for (const field of ["goods", "opex", "capex"] as const) {
    const ids = s[field].map((row) => row.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: [field], message: "ID ganda" });
  }
});

export const tripDraftSchema = z.object({
  id: identifier, name: label,
  date: z.string().refine((value) => {
    if (value === "") return true;
    const date = new Date(`${value}T00:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid"),
  targetOmzet: amount,
  dir: z.enum(["cgk-ist", "ist-cgk"]), mode: z.enum(["one", "pp"]),
  byDir: z.object({ "cgk-ist": scenarioSchema, "ist-cgk": scenarioSchema }),
});

export type TripDraft = {
  id: string; name: string; date: string; targetOmzet: number; dir: Dir; mode: TripMode;
  byDir: Record<Dir, Scenario>;
};

export const DRAFTS_KEY = "titipin-trip-drafts-v1";
export const tripBookSchema = z.object({ version: z.literal(1), activeId: identifier, trips: z.array(tripDraftSchema).min(1).max(50) })
  .superRefine((book, ctx) => {
    if (new Set(book.trips.map((trip) => trip.id)).size !== book.trips.length || !book.trips.some((trip) => trip.id === book.activeId)) {
      ctx.addIssue({ code: "custom", message: "Daftar trip tidak valid" });
    }
  });

export type TripBook = z.infer<typeof tripBookSchema>;

export function newTrip(id: string, name = "Trip baru"): TripDraft {
  return { id, name, date: "", targetOmzet: 0, dir: "cgk-ist", mode: "one",
    byDir: { "cgk-ist": scenarioFor("cgk-ist"), "ist-cgk": scenarioFor("ist-cgk") } };
}

export function parseTripBook(text: string): TripBook {
  if (text.length > 2_000_000) throw new Error("Cadangan terlalu besar");
  return tripBookSchema.parse(JSON.parse(text));
}

export function targetProgress(target: number, revenue: number) {
  return { remaining: Math.max(0, target - revenue), percent: target > 0 ? Math.min(100, Math.round(revenue / target * 100)) : 0 };
}
