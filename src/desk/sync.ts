import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { scenarioFor, type Dir, type Scenario, type TripMode } from "../lib/titip/calc";

export const UJI_KEY = "titipin-uji";

export type Saved = { dir: Dir; mode: TripMode; byDir: Record<Dir, Scenario> };

const getLedger = makeFunctionReference<"query">("ledger:get");
const saveLedger = makeFunctionReference<"mutation">("ledger:save");

export function convexUrl(): string | undefined {
  const url = import.meta.env.VITE_CONVEX_URL;
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://") || !trimmed.endsWith(".convex.cloud")) return undefined;
  return trimmed;
}

function mergeScenario(dir: Dir, raw: Partial<Scenario> | undefined): Scenario {
  const base = scenarioFor(dir);
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    goods: Array.isArray(raw.goods) && raw.goods.length > 0 ? raw.goods : base.goods,
    opex: Array.isArray(raw.opex) && raw.opex.length > 0 ? raw.opex : base.opex,
    capex: Array.isArray(raw.capex) && raw.capex.length > 0 ? raw.capex : base.capex,
  };
}

export function normalize(raw: Partial<Saved> | null | undefined): Saved | null {
  if (!raw?.byDir) return null;
  return {
    dir: raw.dir === "ist-cgk" ? "ist-cgk" : "cgk-ist",
    mode: raw.mode === "pp" ? "pp" : "one",
    byDir: {
      "cgk-ist": mergeScenario("cgk-ist", raw.byDir["cgk-ist"]),
      "ist-cgk": mergeScenario("ist-cgk", raw.byDir["ist-cgk"]),
    },
  };
}

export function loadLocal(): Saved | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(UJI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<Saved> };
    return normalize(parsed.state ?? (parsed as Partial<Saved>));
  } catch {
    return null;
  }
}

export function saveLocal(saved: Saved) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(UJI_KEY, JSON.stringify({ state: saved, version: 1 }));
  } catch {
    // Private mode still keeps the trip in memory.
  }
}

export function startConvex(
  current: () => Saved,
  apply: (saved: Saved) => void,
  onLive: () => void,
): { push: (saved: Saved) => void } {
  const url = convexUrl();
  if (!url || typeof window === "undefined") return { push: () => {} };
  const client = new ConvexClient(url);
  void client
    .query(getLedger, {})
    .then(async (doc) => {
      const saved = normalize(doc as Partial<Saved> | null);
      if (saved) apply(saved);
      else await client.mutation(saveLedger, current());
      onLive();
    })
    .catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    push(saved) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void client.mutation(saveLedger, saved).then(onLive).catch(() => {});
      }, 280);
    },
  };
}
