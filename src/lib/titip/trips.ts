import type { Dir, TripMode } from "./calc.ts";
import type { TripState } from "./trip-state.ts";
import { computeRevenue, targetProgress, capacity, tripLintas } from "./pricing.ts";

/**
 * Multi-trip helpers (docs/rencana-omzet-trip.md §4, §7 stage 3).
 * Pure + side-effect free so the API route stays thin and the rules are testable.
 */

export type TripSummary = {
  slug: string;
  name: string;
  /** Kaki pertama = asal; dipakai untuk ringkas daftar. */
  dari: string;
  /** Kaki terakhir = tujuan utama. */
  ke: string;
  jumlahKaki: number;
  updatedAt: string;
  version: number;
};

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Slugs are the per-owner readable key; keep them URL- and index-safe. */
export function isSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_RE.test(value);
}

/** Derive a slug from a human name, e.g. "Trip Turki Maret" → "trip-turki-maret". */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length >= 1 && SLUG_RE.test(base) ? base : "trip";
}

/** A slug that is not already taken, appending -2, -3, … when needed. */
export function uniqueSlug(name: string, taken: string[]): string {
  const base = slugify(name);
  if (!taken.includes(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base.slice(0, 40 - String(i).length - 1).replace(/-+$/, "")}-${i}`;
    if (!taken.includes(candidate)) return candidate;
  }
  const suffix = Date.now().toString(36);
  return `${base.slice(0, 39 - suffix.length).replace(/-+$/, "")}-${suffix}`;
}

export type TripRollup = {
  service: number;
  totalKg: number;
  hasPricing: boolean;
  needsRate: boolean;
  target: number;
  currency: string;
  progress: ReturnType<typeof targetProgress>;
  legs: { id: string; destinasi: string; jenis: "utama" | "transit"; remainingKg: number; overKg: number }[];
};

/** Headline numbers for one trip, computed from the same engine the desk uses. */
export function rollup(trip: TripState): TripRollup {
  const currency = trip.kaki[0]?.scenario.hargaCurrency || "IDR";
  let service = 0;
  let totalKg = 0;
  let hasPricing = false;
  let needsRate = false;
  const legs: TripRollup["legs"] = [];
  for (const kaki of trip.kaki) {
    const s = kaki.scenario;
    const rev = computeRevenue(s.goods, s.hargaPerKg, s.hargaCurrency ?? currency);
    const cap = capacity(legCapacity(s), rev.totalKg);
    service += rev.service;
    totalKg += rev.totalKg;
    hasPricing ||= rev.hasPricing;
    needsRate ||= rev.needsRate;
    legs.push({
      id: kaki.id,
      destinasi: kaki.destinasi,
      jenis: kaki.jenis,
      remainingKg: cap.remainingKg,
      overKg: cap.overKg,
    });
  }
  // Target dibaca dari kaki pertama yang memasangnya (indikator progres saja).
  const withTarget = trip.kaki.find((k) => (k.scenario.target ?? 0) > 0);
  const target = withTarget?.scenario.target ?? 0;
  const targetCurrency = withTarget?.scenario.hargaCurrency ?? currency;
  const currencies = tripLintas(trip.kaki).currencies;
  needsRate ||= currencies.some((value) => value !== targetCurrency);
  return {
    service,
    totalKg,
    hasPricing,
    needsRate,
    target,
    currency: withTarget?.scenario.hargaCurrency ?? currency,
    progress: targetProgress(service, needsRate ? 0 : target),
    legs,
  };
}

/** Effective net capacity of one leg, mirroring `compute` (bags*kg + cabin − tare). */
export function legCapacity(s: { bags: number; kgPerBag: number; cabin: number; tare: number }): number {
  const kotor = s.bags * s.kgPerBag + s.cabin;
  return Math.max(0, kotor - s.tare);
}

export type SaveOutcome =
  | { kind: "saved"; version: number }
  | { kind: "created"; version: number }
  | { kind: "conflict"; version: number };

/**
 * Decide what a save should do given the row's current version. `expected` is
 * the version the client last saw; a mismatch is a conflict, not an overwrite —
 * another device changed the trip (docs §6).
 */
export function resolveSave(
  currentVersion: number | null,
  expected: number,
): SaveOutcome {
  if (currentVersion === null) return { kind: "created", version: 1 };
  if (currentVersion !== expected) return { kind: "conflict", version: currentVersion };
  return { kind: "saved", version: currentVersion + 1 };
}
