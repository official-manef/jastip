import { v } from "convex/values";

const good = v.object({
  id: v.string(),
  name: v.string(),
  kg: v.number(),
  qty: v.number(),
  beli: v.number(),
});

const opexLine = v.object({
  id: v.string(),
  label: v.string(),
  amount: v.number(),
});

const capexLine = v.object({
  id: v.string(),
  label: v.string(),
  price: v.number(),
  trips: v.number(),
});

export const scenario = v.object({
  bags: v.number(),
  kgPerBag: v.number(),
  cabin: v.number(),
  tare: v.number(),
  overPerKg: v.number(),
  hargaPerKg: v.number(),
  margin: v.number(),
  ujiKg: v.number(),
  kursTry: v.number(),
  goods: v.array(good),
  opex: v.array(opexLine),
  capex: v.array(capexLine),
});

export const dir = v.union(v.literal("cgk-ist"), v.literal("ist-cgk"));
export const mode = v.union(v.literal("one"), v.literal("pp"));
