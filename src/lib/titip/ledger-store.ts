import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { scenarioFor, type CapexLine, type Dir, type Good, type Scenario, type TripMode } from "@/lib/titip/calc";

export const UJI_KEY = "titipin-uji";

type Saved = { dir: Dir; mode: TripMode; byDir: Record<Dir, Scenario> };

type State = Saved & {
  hydrated: boolean;
  setDir: (dir: Dir) => void;
  setMode: (mode: TripMode) => void;
  patch: (partial: Partial<Scenario>) => void;
  patchDir: (dir: Dir, partial: Partial<Scenario>) => void;
  setGood: (id: string, partial: Partial<Good>) => void;
  addGood: (good: Good) => void;
  removeGood: (id: string) => void;
  setOpex: (id: string, amount: number) => void;
  setCapex: (id: string, partial: Partial<CapexLine>) => void;
  resetDir: () => void;
};

function fresh(): Saved {
  return {
    dir: "cgk-ist",
    mode: "one",
    byDir: {
      "cgk-ist": scenarioFor("cgk-ist"),
      "ist-cgk": scenarioFor("ist-cgk"),
    },
  };
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

/** Writes the demo scenario the first time this browser has no uji data. */
export function seedUjiIfEmpty() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(UJI_KEY)) return;
    const seed = fresh();
    localStorage.setItem(UJI_KEY, JSON.stringify({ state: seed, version: 0 }));
  } catch {
    // Private mode or a blocked storage API: the screen still works in memory.
  }
}

export const useLedger = create<State>()(
  persist(
    (set, get) => ({
      ...fresh(),
      hydrated: false,
      setDir: (dir) => set({ dir }),
      setMode: (mode) => {
        if (mode === "one") {
          set({ mode });
          return;
        }
        const capex = get().byDir[get().dir].capex;
        set((s) => ({
          mode: "pp",
          byDir: {
            "cgk-ist": { ...s.byDir["cgk-ist"], capex },
            "ist-cgk": { ...s.byDir["ist-cgk"], capex },
          },
        }));
      },
      patch: (partial) => {
        const dir = get().dir;
        set((s) => ({
          byDir: { ...s.byDir, [dir]: { ...s.byDir[dir], ...partial } },
        }));
      },
      patchDir: (dir, partial) => {
        set((s) => ({
          byDir: { ...s.byDir, [dir]: { ...s.byDir[dir], ...partial } },
        }));
      },
      setGood: (id, partial) => {
        const dir = get().dir;
        set((s) => ({
          byDir: {
            ...s.byDir,
            [dir]: {
              ...s.byDir[dir],
              goods: s.byDir[dir].goods.map((g) => (g.id === id ? { ...g, ...partial } : g)),
            },
          },
        }));
      },
      addGood: (good) => {
        const dir = get().dir;
        set((s) => ({
          byDir: {
            ...s.byDir,
            [dir]: { ...s.byDir[dir], goods: [...s.byDir[dir].goods, good] },
          },
        }));
      },
      removeGood: (id) => {
        const dir = get().dir;
        set((s) => ({
          byDir: {
            ...s.byDir,
            [dir]: { ...s.byDir[dir], goods: s.byDir[dir].goods.filter((g) => g.id !== id) },
          },
        }));
      },
      setOpex: (id, amount) => {
        const dir = get().dir;
        set((s) => ({
          byDir: {
            ...s.byDir,
            [dir]: {
              ...s.byDir[dir],
              opex: s.byDir[dir].opex.map((line) => (line.id === id ? { ...line, amount } : line)),
            },
          },
        }));
      },
      setCapex: (id, partial) => {
        const dir = get().dir;
        const apply = (lines: CapexLine[]) => lines.map((line) => (line.id === id ? { ...line, ...partial } : line));
        set((s) => {
          if (s.mode === "pp") {
            return {
              byDir: {
                "cgk-ist": { ...s.byDir["cgk-ist"], capex: apply(s.byDir["cgk-ist"].capex) },
                "ist-cgk": { ...s.byDir["ist-cgk"], capex: apply(s.byDir["ist-cgk"].capex) },
              },
            };
          }
          return {
            byDir: {
              ...s.byDir,
              [dir]: { ...s.byDir[dir], capex: apply(s.byDir[dir].capex) },
            },
          };
        });
      },
      resetDir: () => {
        const dir = get().dir;
        const next = scenarioFor(dir);
        set((s) => {
          const byDir = { ...s.byDir, [dir]: next };
          if (s.mode === "pp") {
            const other: Dir = dir === "cgk-ist" ? "ist-cgk" : "cgk-ist";
            byDir[other] = { ...byDir[other], capex: next.capex };
          }
          return { byDir };
        });
      },
    }),
    {
      name: UJI_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ dir: s.dir, mode: s.mode, byDir: s.byDir }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Saved> | undefined;
        if (!saved?.byDir) return { ...current, hydrated: true };
        return {
          ...current,
          hydrated: true,
          dir: saved.dir === "ist-cgk" ? "ist-cgk" : "cgk-ist",
          mode: saved.mode === "pp" ? "pp" : "one",
          byDir: {
            "cgk-ist": mergeScenario("cgk-ist", saved.byDir["cgk-ist"]),
            "ist-cgk": mergeScenario("ist-cgk", saved.byDir["ist-cgk"]),
          },
        };
      },
      onRehydrateStorage: () => () => {
        useLedger.setState({ hydrated: true });
      },
    },
  ),
);
