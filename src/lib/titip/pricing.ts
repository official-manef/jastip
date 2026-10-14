import type { Dir, Good, LinePricing, TripMode } from "./calc.ts";

/**
 * Stage 1 pricing engine (docs/rencana-omzet-trip.md §5).
 * Pure functions only. Keeps the legacy `compute`/`computeTrip` untouched so the
 * Jakarta↔Turki baseline stays byte-identical; mixed pricing lives here.
 */
export type PricingModel = LinePricing["model"];

/** `Good` already carries the optional `pricing`/`beliCurrency` fields. */
export type PricedGood = Good;

export type RevenueRow = {
  id: string;
  name: string;
  model: PricingModel;
  rate: number;
  currency: string;
  unit?: string;
  qty: number;
  weightKg: number;
  service: number;
  beli: number;
  /** Product cost stays separate from service revenue (§4). */
  beliTotal: number;
};

export type Revenue = {
  totalKg: number;
  service: number;
  rows: RevenueRow[];
  /** True when at least one row carries an explicit `pricing` block. */
  hasPricing: boolean;
  /** Currencies seen across priced rows. */
  currencies: string[];
  /** True when rows disagree on currency and no rate was supplied. */
  needsRate: boolean;
};

const GRAM = 1000;
const FALLBACK_CURRENCY = "IDR";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeRate(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export function lineWeightKg(good: Good): number {
  const { qty, kg } = good;
  if (!Number.isFinite(qty) || !Number.isFinite(kg) || qty < 0 || kg < 0) return 0;
  const grams = Math.round(qty * kg * GRAM);
  return grams / GRAM;
}

/**
 * Service fee for one row, using full weight precision in grams.
 * Priced rows round to 2 decimals (minor money unit); unpriced rows fall back
 * to the global per-kg rate with legacy whole-rupiah rounding.
 */
export function lineService(good: Good, fallbackPerKg: number): number {
  const grams = Math.round(lineWeightKg(good) * GRAM);
  const priced = good as PricedGood;
  const p = priced.pricing;
  if (!p) return Math.round((grams / GRAM) * normalizeRate(fallbackPerKg));
  const rate = normalizeRate(p.rate);
  if (p.model === "per_item") return round2(good.qty * rate);
  return round2((grams / GRAM) * rate);
}

export function computeRevenue(
  goods: Good[],
  fallbackPerKg: number,
  fallbackCurrency = FALLBACK_CURRENCY,
): Revenue {
  const rows: RevenueRow[] = [];
  let totalGrams = 0;
  let service = 0;
  let hasPricing = false;
  const currencies = new Set<string>();

  for (const good of goods) {
    const priced = good as PricedGood;
    const p = priced.pricing;
    if (p) hasPricing = true;
    const currency = p?.currency?.trim() || fallbackCurrency;
    currencies.add(currency);
    const grams = Math.round(good.qty * good.kg * GRAM);
    totalGrams += grams;
    const rowService = lineService(good, fallbackPerKg);
    service += rowService;
    rows.push({
      id: good.id,
      name: good.name,
      model: p?.model ?? "per_kg",
      rate: p ? normalizeRate(p.rate) : normalizeRate(fallbackPerKg),
      currency,
      unit: p?.unit,
      qty: good.qty,
      weightKg: grams / GRAM,
      service: rowService,
      beli: good.beli,
      beliTotal: round2(good.qty * good.beli),
    });
  }

  return {
    totalKg: round2(totalGrams / GRAM),
    service: round2(service),
    rows,
    hasPricing,
    currencies: [...currencies],
    needsRate: currencies.size > 1,
  };
}

export type TargetProgress = {
  /** False when no usable target is set. */
  set: boolean;
  selisih: number;
  butuh: number;
  lebih: number;
  /** May exceed 100; callers bound the bar visually. */
  persen: number;
  achieved: boolean;
};

/** Target math that never returns NaN/Infinity for an empty or zero target. */
export function targetProgress(service: number, target: number): TargetProgress {
  const svc = Number.isFinite(service) ? service : 0;
  if (!Number.isFinite(target) || target <= 0) {
    return { set: false, selisih: 0, butuh: 0, lebih: 0, persen: 0, achieved: false };
  }
  const selisih = round2(target - svc);
  const achieved = svc >= target;
  return {
    set: true,
    selisih,
    butuh: achieved ? 0 : selisih,
    lebih: achieved ? round2(svc - target) : 0,
    persen: round2((svc / target) * 100),
    achieved,
  };
}

export type Capacity = {
  capacityKg: number;
  usedKg: number;
  remainingKg: number;
  overKg: number;
};

export function capacity(capacityKg: number, usedKg: number): Capacity {
  const cap = Number.isFinite(capacityKg) && capacityKg > 0 ? capacityKg : 0;
  const used = Number.isFinite(usedKg) ? usedKg : 0;
  const remaining = round2(cap - used);
  return {
    capacityKg: round2(cap),
    usedKg: round2(used),
    remainingKg: Math.max(0, remaining),
    overKg: Math.max(0, round2(-remaining)),
  };
}

export type TripRevenue = {
  mode: TripMode;
  /** One entry per counted leg; PP has two, each with its own capacity. */
  legs: { dir: Dir; revenue: Revenue }[];
  service: number;
  totalKg: number;
  hasPricing: boolean;
  needsRate: boolean;
};

/**
 * PP sums service across both legs (capacity stays per leg, §5); capex stays in
 * `computeTrip` and is counted once there.
 */
export function tripRevenue(
  mode: TripMode,
  dir: Dir,
  byDir: Record<Dir, { goods: Good[]; hargaPerKg: number }>,
): TripRevenue {
  const other: Dir = dir === "cgk-ist" ? "ist-cgk" : "cgk-ist";
  const dirs: Dir[] = mode === "one" ? [dir] : [dir, other];
  const legs = dirs.map((d) => ({
    dir: d,
    revenue: computeRevenue(byDir[d].goods, byDir[d].hargaPerKg),
  }));
  return {
    mode,
    legs,
    service: round2(legs.reduce((sum, l) => sum + l.revenue.service, 0)),
    totalKg: round2(legs.reduce((sum, l) => sum + l.revenue.totalKg, 0)),
    hasPricing: legs.some((l) => l.revenue.hasPricing),
    needsRate: legs.some((l) => l.revenue.needsRate),
  };
}
