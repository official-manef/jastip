/**
 * Kurs dinamis (rupiah per 1 unit mata uang lokal).
 *
 * Sumber: open.er-api.com (gratis, tanpa key). Modul ini murni/isomorphic —
 * tidak mengimpor `$app/*` — supaya bisa dipakai route server maupun diuji
 * langsung. Cache dipegang pemanggil (route), bukan di sini.
 *
 * Selalu kirim tanggal pembaruan (`updatedAt`) supaya UI bisa menampilkan
 * "kurs per kapan". Bila sumber gagal, pemanggil memakai nilai seed katalog.
 */
import type { Currency } from "./destinasi.ts";

export type KursSnapshot = {
  /** ISO-8601 UTC saat sumber memperbarui, mis. 2026-10-16T00:02:31.000Z. */
  updatedAt: string;
  /** Rupiah per 1 unit mata uang. */
  rates: Partial<Record<Currency, number>>;
  /** Nama sumber, untuk ditampilkan. */
  sumber: string;
};

const SUMBER = "open.er-api.com";
const URL = "https://open.er-api.com/v6/latest/IDR";

/** Mata uang yang ingin kita ambil (bagian dari katalog, tanpa IDR). */
const TARGET: Currency[] = [
  "USD", "JPY", "KRW", "SGD", "HKD", "THB", "EUR", "MYR", "AUD", "TRY",
  "CNY", "TWD", "VND", "PHP", "INR", "AED", "SAR", "GBP", "CAD", "NZD", "EGP", "CHF",
];

/** Normalisasi respons provider jadi rupiah per 1 unit. `rates` = unit per 1 IDR. */
export function normalize(body: unknown): KursSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.result !== "success") return null;
  const raw = row.rates;
  if (!raw || typeof raw !== "object") return null;
  const perIdr = raw as Record<string, unknown>;

  let updatedAt = "";
  if (typeof row.time_last_update_unix === "number" && Number.isFinite(row.time_last_update_unix)) {
    updatedAt = new Date(row.time_last_update_unix * 1000).toISOString();
  } else if (typeof row.time_last_update_utc === "string") {
    const t = Date.parse(row.time_last_update_utc);
    if (Number.isFinite(t)) updatedAt = new Date(t).toISOString();
  }
  if (!updatedAt) return null;

  const rates: Partial<Record<Currency, number>> = {};
  for (const code of TARGET) {
    const v = perIdr[code];
    // provider memberi unit per 1 IDR; kebalikannya = rupiah per 1 unit.
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      const rp = 1 / v;
      // Simpan presisi wajar: bawah 100 → 2 desimal (mis. JPY ~113,5), atas → bulatkan.
      rates[code] = rp >= 100 ? Math.round(rp) : Math.round(rp * 100) / 100;
    }
  }
  if (Object.keys(rates).length === 0) return null;
  return { updatedAt, rates, sumber: SUMBER };
}

/** Ambil kurs dari provider. Melempar bila jaringan/format gagal. */
export async function fetchKurs(fetcher: typeof fetch = fetch): Promise<KursSnapshot> {
  const res = await fetcher(URL, { redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("kurs-http");
  const snap = normalize(await res.json());
  if (!snap) throw new Error("kurs-format");
  return snap;
}

/** Tanggal ringkas bahasa Indonesia, mis. "16 Okt 2026". */
export function kursTanggal(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "tanggal tidak diketahui";
  return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
