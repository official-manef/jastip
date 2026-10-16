/**
 * Satu sumber state trip (kalkulator). Dipakai bersama oleh Desk.svelte dan
 * asisten AI (tools), supaya perubahan dari chat langsung terlihat di kalkulator.
 * Modul ini juga pemilik simpan-muat: localStorage perangkat + akun (`/api/trip`).
 *
 * Model: trip = daftar kaki berurutan (`desk.kaki`). `aktif` = index kaki yang
 * sedang dibuka di kalkulator.
 */
import { browser } from "$app/env";
import { authedFetch, loadMe, session } from "./session.svelte";
import { parseTrip, seedTrip, TRIP_STORAGE_KEY, type TripStateV2 } from "./trip-state";
import { newKaki, type Kaki } from "./kaki";
import { customKode, type CustomDest } from "./destinasi";
import type { CapexLine, Good, Scenario } from "./calc";

export const desk = $state({
  nama: seedTrip().nama,
  kaki: seedTrip().kaki as Kaki[],
  aktif: 0,
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

/** Index kaki aktif, dijaga dalam rentang daftar. */
function activeIndex(): number {
  return Math.min(Math.max(0, desk.aktif), Math.max(0, desk.kaki.length - 1));
}

export function snapshot(): TripStateV2 {
  return { v: 2, nama: desk.nama, kaki: desk.kaki };
}

export function restore(trip: TripStateV2) {
  desk.nama = trip.nama;
  desk.kaki = trip.kaki;
  desk.aktif = Math.min(desk.aktif, trip.kaki.length - 1);
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

/* ---------- Kaki ---------- */

export function aktifIdx(): number {
  return activeIndex();
}

export function kakiAktif(): Kaki {
  return desk.kaki[activeIndex()];
}

/** Patch skenario kaki pada index tertentu. */
export function patchKaki(index: number, partial: Partial<Scenario>) {
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  desk.kaki = desk.kaki.map((k, idx) => (idx === i ? { ...k, scenario: { ...k.scenario, ...partial } } : k));
  commit();
}

/** Patch skenario kaki aktif. */
export function patch(partial: Partial<Scenario>) {
  patchKaki(activeIndex(), partial);
}

export function setAktif(index: number) {
  desk.aktif = Math.min(Math.max(0, index), Math.max(0, desk.kaki.length - 1));
  commit();
}

/** Ganti destinasi kaki aktif; skenario diset ulang mengikuti destinasi.
 *  `custom` mengisi data negara tambahan (opsi "Negara lain…"). */
export function setDestinasi(index: number, kode: string, jenis?: Kaki["jenis"]) {
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  const current = desk.kaki[i];
  const next = newKaki(kode, jenis ?? current.jenis, current.custom);
  desk.kaki = desk.kaki.map((k, idx) => (idx === i ? { ...next, id: current.id } : k));
  commit();
}

/** Simpan/edit data negara tambahan untuk kaki aktif (tetap pertahankan barang). */
export function setCustom(index: number, custom: Kaki["custom"]) {
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  if (desk.kaki[i].custom && !custom) return;
  desk.kaki = desk.kaki.map((k, idx) => {
    if (idx !== i) return k;
    const next: Kaki = { ...k };
    if (custom) next.custom = custom;
    else delete next.custom;
    return next;
  });
  commit();
}

/** Ubah destinasi kaki ke negara custom baru (buat kaki baru dengan data custom). */
export function setDestinasiCustom(
  index: number,
  custom: { negara: string; kota: string; currency: string; kurs: number; iata?: string },
) {
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  const current = desk.kaki[i];
  const kode = customKode(custom.negara);
  const next = newKaki(kode, current.jenis, custom as CustomDest);
  desk.kaki = desk.kaki.map((k, idx) => (idx === i ? { ...next, id: current.id } : k));
  commit();
}

export function setJenis(index: number, jenis: Kaki["jenis"]) {
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  const kaki = desk.kaki[i];
  desk.kaki = desk.kaki.map((k, idx) => (idx === i
    ? { ...k, jenis, lama: jenis === "transit" ? Math.min(k.lama || 6, 24) || 6 : k.lama || 5, scenario: scenarioUntukJenis(k, jenis) }
    : k));
  commit();
}

function scenarioUntukJenis(kaki: Kaki, jenis: Kaki["jenis"]): Scenario {
  const segar = newKaki(kaki.destinasi, jenis).scenario;
  // Pertahankan barang & opex yang sudah diisi; hanya kuota & label tiket yang menyesuaikan.
  return {
    ...segar,
    goods: kaki.scenario.goods,
    capex: kaki.scenario.capex,
    opex: segar.opex.map((line) => {
      const lama = kaki.scenario.opex.find((o) => o.id === line.id);
      return lama ? { ...line, amount: lama.amount } : line;
    }),
  };
}

export function setLama(index: number, lama: number) {
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  const max = desk.kaki[i].jenis === "transit" ? 72 : 365;
  desk.kaki = desk.kaki.map((k, idx) => (idx === i ? { ...k, lama: Math.min(max, Math.max(0, lama)) } : k));
  commit();
}

/** Tambah kaki baru di akhir (default destinasi Jepang bila tak diberi). */
export function tambahKaki(kode = "jepang", jenis: Kaki["jenis"] = "utama") {
  if (desk.kaki.length >= 24) return;
  desk.kaki = [...desk.kaki, newKaki(kode, jenis)];
  desk.aktif = desk.kaki.length - 1;
  commit();
}

/** Sisipkan kaki setelah index tertentu (untuk transit di tengah rute). */
export function sisipKaki(index: number, kode = "singapura", jenis: Kaki["jenis"] = "transit") {
  if (desk.kaki.length >= 24) return;
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  const next = [...desk.kaki];
  next.splice(i + 1, 0, newKaki(kode, jenis));
  desk.kaki = next;
  desk.aktif = i + 1;
  commit();
}

/** Hapus kaki; minimal satu kaki harus tersisa. */
export function hapusKaki(index: number) {
  if (desk.kaki.length <= 1) return;
  const i = Math.min(Math.max(0, index), desk.kaki.length - 1);
  desk.kaki = desk.kaki.filter((_, idx) => idx !== i);
  desk.aktif = Math.min(desk.aktif, desk.kaki.length - 1);
  commit();
}

export function setNama(nama: string) {
  desk.nama = nama.slice(0, 80);
  commit();
}

/* ---------- Mutasi isi kaki aktif (dipakai Desk.svelte dan tools asisten) ---------- */

export function setGood(id: string, partial: Partial<Good>) {
  if (partial.qty !== undefined) partial.qty = Math.min(10_000, Math.max(0, Math.round(partial.qty)));
  patch({ goods: kakiAktif().scenario.goods.map((g) => (g.id === id ? { ...g, ...partial } : g)) });
}

export function addGood(good: Good) {
  patch({ goods: [...kakiAktif().scenario.goods, good] });
}

export function removeGood(id: string) {
  patch({ goods: kakiAktif().scenario.goods.filter((g) => g.id !== id) });
}

/** F11: pulihkan daftar barang penuh (dipakai Undo setelah hapus). Urutan tetap. */
export function setGoods(goods: Good[]) {
  patch({ goods });
}

export function setPricing(id: string, partial: Partial<NonNullable<Good["pricing"]>>) {
  patch({ goods: kakiAktif().scenario.goods.map((g) =>
    g.id === id ? { ...g, pricing: { model: "per_kg", rate: 0, ...g.pricing, ...partial } } : g) });
}

export function clearPricing(id: string) {
  patch({ goods: kakiAktif().scenario.goods.map((g) => {
    if (g.id !== id) return g;
    const { pricing: _drop, ...rest } = g;
    return rest;
  }) });
}

export function setOpex(id: string, amount: number) {
  if (!Number.isFinite(amount)) return;
  const clamped = Math.min(1_000_000_000_000, Math.max(0, amount));
  patch({ opex: kakiAktif().scenario.opex.map((line) => (line.id === id ? { ...line, amount: clamped } : line)) });
}

export function setCapex(id: string, partial: Partial<CapexLine>) {
  if (partial.price !== undefined) partial.price = Math.min(1_000_000_000_000, Math.max(0, partial.price));
  if (partial.trips !== undefined) partial.trips = Math.min(10_000, Math.max(1, Math.round(partial.trips)));
  const apply = (lines: CapexLine[]) => lines.map((line) => (line.id === id ? { ...line, ...partial } : line));
  // Capex (koper, timbangan) dipakai bersama seluruh kaki — samakan di semua kaki.
  desk.kaki = desk.kaki.map((k) => ({ ...k, scenario: { ...k.scenario, capex: apply(k.scenario.capex) } }));
  commit();
}

/** Kembalikan kaki aktif ke skenario contoh destinasi/jenis-nya. */
export function resetKaki() {
  const k = kakiAktif();
  const segar = newKaki(k.destinasi, k.jenis).scenario;
  desk.kaki = desk.kaki.map((x, idx) => (x.id === k.id && idx === activeIndex() ? { ...x, scenario: segar } : x));
  commit();
}
