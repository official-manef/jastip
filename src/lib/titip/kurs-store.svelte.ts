/**
 * Kurs live sisi klien. Ambil sekali per pemuatan halaman dari `/api/kurs`,
 * lalu tulis ke modul `destinasi` supaya `viewOf` memakai kurs terbaru.
 * Reaktif: `kurs` adalah `$state` supaya UI bisa menampilkan tanggal update.
 */
import { browser } from "$app/env";
import { setKursLive, type Currency } from "./destinasi";
import { kursTanggal, type KursSnapshot } from "./kurs";

export const kurs = $state({
  loaded: false,
  sumber: "",
  /** ISO-8601 UTC, kosong bila masih pakai seed. */
  updatedAt: "",
  /** Rupiah per 1 unit; kosong = pakai seed katalog. */
  rates: {} as Partial<Record<Currency, number>>,
});

let inflight: Promise<void> | null = null;

/** Muat kurs sekali. Kegagalan tidak fatal: UI tetap pakai nilai seed. */
export function loadKurs(): Promise<void> {
  if (!browser || kurs.loaded) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/kurs", { signal: AbortSignal.timeout(10000) });
      const data = (await res.json()) as Partial<KursSnapshot> & { fallback?: boolean };
      if (!res.ok || !data.rates) return;
      kurs.rates = data.rates as Partial<Record<Currency, number>>;
      kurs.updatedAt = data.updatedAt ?? "";
      kurs.sumber = data.sumber ?? "";
      setKursLive({ rates: kurs.rates, updatedAt: kurs.updatedAt, sumber: kurs.sumber });
    } catch {
      /* pakai seed */
    } finally {
      kurs.loaded = true;
      inflight = null;
    }
  })();
  return inflight;
}

/** Label "Kurs per <tanggal>" atau "Kurs contoh" bila masih seed. */
export function kursLabel(): string {
  if (kurs.updatedAt) return `Kurs per ${kursTanggal(kurs.updatedAt)}`;
  return "Kurs contoh";
}
