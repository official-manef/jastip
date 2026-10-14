/**
 * Satu sumber state trip (meja hitung). Dipakai bersama oleh Desk.svelte dan
 * asisten AI (tools), supaya perubahan dari chat langsung terlihat di meja.
 * Modul ini juga pemilik simpan-muat: localStorage perangkat + akun (`/api/trip`).
 */
import { browser } from "$app/env";
import { authedFetch, loadMe, session } from "./session.svelte";
import { parseTrip, TRIP_STORAGE_KEY, type TripState } from "./trip-state";
import { scenarioFor, type CapexLine, type Dir, type Good, type Scenario, type TripMode } from "./calc";

function initialByDir(): Record<Dir, Scenario> {
  return { "cgk-ist": scenarioFor("cgk-ist"), "ist-cgk": scenarioFor("ist-cgk") };
}

export const desk = $state({
  dir: "cgk-ist" as Dir,
  mode: "one" as TripMode,
  byDir: initialByDir(),
  source: "Memuat kalkulasi…",
  syncFailed: false,
  conflict: false,
  version: 0,
  ready: false,
});

let initialized = false;
let revision = 0;
let saving = false;
let queued = false;
let localSaved = false;
const controller = new AbortController();

export function snapshot(): TripState {
  return { dir: desk.dir, mode: desk.mode, cgkIst: desk.byDir["cgk-ist"], istCgk: desk.byDir["ist-cgk"] };
}

export function restore(trip: TripState) {
  desk.dir = trip.dir;
  desk.mode = trip.mode;
  desk.byDir = { "cgk-ist": trip.cgkIst, "ist-cgk": trip.istCgk };
}

function persistLocal() {
  if (!browser) return;
  try {
    const key = session.user ? `${TRIP_STORAGE_KEY}:${session.user.id}` : TRIP_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(snapshot()));
    localSaved = true;
  } catch { localSaved = false; }
}

async function syncAccount() {
  if (!session.user || !initialized || controller.signal.aborted) return;
  queued = true;
  if (saving) return;
  saving = true;
  try {
    while (queued && !controller.signal.aborted) {
      queued = false;
      const savingRevision = revision;
      desk.source = "Menyimpan ke akun…";
      try {
        const response = await authedFetch("/api/trip", {
          method: "PUT", body: JSON.stringify({ trip: snapshot(), version: desk.version }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (response.status === 409) {
          const data = await response.json().catch(() => ({}));
          desk.conflict = true;
          queued = false;
          desk.source = "Trip diubah di perangkat lain. Muat ulang untuk menyatukan versi.";
          if (typeof data.version === "number") desk.version = data.version;
          return;
        }
        if (!response.ok) throw new Error("save");
        const data = await response.json().catch(() => ({}));
        if (typeof data.version === "number") desk.version = data.version;
        desk.conflict = false;
        desk.syncFailed = false;
        if (revision === savingRevision) desk.source = "Tersimpan di akun pribadi.";
      } catch {
        if (controller.signal.aborted) return;
        desk.syncFailed = true;
        desk.source = localSaved ? "Tersimpan di perangkat; sinkronisasi akun gagal." : "Belum tersimpan. Coba sinkronisasi lagi.";
        // A later edit or explicit retry can try again without a retry loop.
        queued = false;
      }
    }
  } finally { saving = false; }
}

export function retrySync() { void syncAccount(); }

/** Catat satu perubahan (dipakai UI dan asisten) lalu simpan. */
export function commit() {
  revision += 1;
  if (!initialized) return;
  persistLocal();
  desk.source = localSaved ? "Tersimpan di perangkat ini." : "Penyimpanan perangkat tidak tersedia. Kalkulasi belum tersimpan.";
  void syncAccount();
}

export function initDesk() {
  if (!browser) return;
  void (async () => {
    await loadMe();
    if (controller.signal.aborted) return;
    try {
      const key = session.user ? `${TRIP_STORAGE_KEY}:${session.user.id}` : TRIP_STORAGE_KEY;
      const trip = parseTrip(JSON.parse(localStorage.getItem(key) || "null"));
      if (trip && revision === 0) restore(trip);
    } catch { /* Corrupt or unavailable device storage leaves the calculator usable. */ }
    persistLocal();
    desk.source = localSaved ? "Tersimpan di perangkat ini." : "Penyimpanan perangkat tidak tersedia. Kalkulasi belum tersimpan.";
    if (session.user) {
      const loadingRevision = revision;
      try {
        const response = await authedFetch("/api/trip", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("load");
        const data = await response.json();
        const trip = parseTrip(data.trip);
        if (controller.signal.aborted) return;
        if (trip && loadingRevision === 0 && revision === 0) {
          restore(trip);
          persistLocal();
          desk.source = "Tersimpan di akun pribadi.";
        }
        if (typeof data.version === "number") desk.version = data.version;
      } catch {
        if (controller.signal.aborted) return;
        desk.syncFailed = true;
        desk.source = localSaved ? "Tersimpan di perangkat; akun belum dapat dimuat." : "Akun belum dapat dimuat. Kalkulasi belum tersimpan.";
      }
    }
    initialized = true;
    desk.ready = true;
    if (revision > 0) { persistLocal(); void syncAccount(); }
  })();
}

/* ---------- Mutasi (dipakai Desk.svelte dan tools asisten) ---------- */

export function patchDir(target: Dir, partial: Partial<Scenario>) {
  desk.byDir = { ...desk.byDir, [target]: { ...desk.byDir[target], ...partial } };
  commit();
}

export function patch(partial: Partial<Scenario>) {
  patchDir(desk.dir, partial);
}

export function setGood(id: string, partial: Partial<Good>) {
  if (partial.qty !== undefined) partial.qty = Math.min(10_000, Math.max(0, Math.round(partial.qty)));
  patch({ goods: desk.byDir[desk.dir].goods.map((g) => (g.id === id ? { ...g, ...partial } : g)) });
}

export function addGood(good: Good) {
  patch({ goods: [...desk.byDir[desk.dir].goods, good] });
}

export function removeGood(id: string) {
  patch({ goods: desk.byDir[desk.dir].goods.filter((g) => g.id !== id) });
}

export function setPricing(id: string, partial: Partial<NonNullable<Good["pricing"]>>) {
  patch({ goods: desk.byDir[desk.dir].goods.map((g) =>
    g.id === id ? { ...g, pricing: { model: "per_kg", rate: 0, ...g.pricing, ...partial } } : g) });
}

export function clearPricing(id: string) {
  patch({ goods: desk.byDir[desk.dir].goods.map((g) => {
    if (g.id !== id) return g;
    const { pricing: _drop, ...rest } = g;
    return rest;
  }) });
}

export function setOpex(id: string, amount: number) {
  if (!Number.isFinite(amount)) return;
  const clamped = Math.min(1_000_000_000_000, Math.max(0, amount));
  patch({ opex: desk.byDir[desk.dir].opex.map((line) => (line.id === id ? { ...line, amount: clamped } : line)) });
}

export function setCapex(id: string, partial: Partial<CapexLine>) {
  if (partial.price !== undefined) partial.price = Math.min(1_000_000_000_000, Math.max(0, partial.price));
  if (partial.trips !== undefined) partial.trips = Math.min(10_000, Math.max(1, Math.round(partial.trips)));
  const apply = (lines: CapexLine[]) => lines.map((line) => (line.id === id ? { ...line, ...partial } : line));
  if (desk.mode === "pp") {
    desk.byDir = {
      "cgk-ist": { ...desk.byDir["cgk-ist"], capex: apply(desk.byDir["cgk-ist"].capex) },
      "ist-cgk": { ...desk.byDir["ist-cgk"], capex: apply(desk.byDir["ist-cgk"].capex) },
    };
    commit();
  } else {
    patch({ capex: apply(desk.byDir[desk.dir].capex) });
  }
}

export function setMode(next: TripMode) {
  desk.mode = next;
  if (next === "pp") {
    const capex = desk.byDir[desk.dir].capex;
    desk.byDir = {
      "cgk-ist": { ...desk.byDir["cgk-ist"], capex },
      "ist-cgk": { ...desk.byDir["ist-cgk"], capex },
    };
  }
  commit();
}

export function setDir(next: Dir) {
  desk.dir = next;
  commit();
}

export function resetDir() {
  const next = scenarioFor(desk.dir);
  const other: Dir = desk.dir === "cgk-ist" ? "ist-cgk" : "cgk-ist";
  const copy = { ...desk.byDir, [desk.dir]: next };
  if (desk.mode === "pp") copy[other] = { ...copy[other], capex: next.capex };
  desk.byDir = copy;
  commit();
}
