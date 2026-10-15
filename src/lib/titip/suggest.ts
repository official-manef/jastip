import { computeRevenue, type PricedGood } from "./pricing.ts";

/**
 * Rekomendasi produk untuk menutup kekurangan target jasa.
 *
 * PENTING: hasil modul ini adalah PROYEKSI, bukan omzet yang sudah diakui dan
 * bukan pesanan. Omzet hanya diakui saat titipan berstatus `selesai`
 * (docs/rencana-omzet-trip.md §3–§5). Angka di sini hanya usulan rencana.
 *
 * Murni: memakai `computeRevenue` sebagai mesin yang sama dengan kalkulator, tidak
 * menduplikasi rumus jasa/berat.
 */

export type SuggestCandidate = {
  id: string;
  name: string;
  category?: string;
  /** Berat per unit (kg), sama artinya dengan `Good.kg`. */
  unitWeightKg: number;
  feeModel: "per_kg" | "per_item";
  feeRate: number;
  /** Jumlah unit yang tersedia. */
  maxQty: number;
  /** Harga beli per unit; hanya info, bukan omzet. */
  beli?: number;
};

export type SuggestInput = {
  candidates: SuggestCandidate[];
  /** Sisa kapasitas kaki (kg) yang boleh dipakai. */
  remainingKg: number;
  /** Kekurangan target jasa yang perlu ditutup (mata uang `currency`). */
  shortfall: number;
  /** Mata uang tarif jasa (aturan: USD). */
  currency: string;
};

export type SuggestLine = {
  candidateId: string;
  name: string;
  qty: number;
  weightKg: number;
  service: number;
  currency: string;
};

export type SuggestPlan = {
  /** Tegas: ini proyeksi, bukan omzet diakui dan bukan pesanan. */
  kind: "proyeksi";
  lines: SuggestLine[];
  totalService: number;
  totalKg: number;
  shortfall: number;
  /** Proyeksi jasa dari rencana ini (= totalService). */
  projected: number;
  achievable: boolean;
  notes: string[];
};

function unitWeight(c: SuggestCandidate): number {
  return Number.isFinite(c.unitWeightKg) && c.unitWeightKg > 0 ? c.unitWeightKg : 0;
}

function cleanRate(c: SuggestCandidate): number {
  return Number.isFinite(c.feeRate) && c.feeRate > 0 ? c.feeRate : 0;
}

/** Jasa per unit kandidat (per_item = tarif; per_kg = tarif × berat/unit). */
function servicePerUnit(c: SuggestCandidate): number {
  return c.feeModel === "per_item" ? cleanRate(c) : cleanRate(c) * unitWeight(c);
}

/** Efisiensi jasa per kg, dipakai untuk urutan pilih. */
function servicePerKg(c: SuggestCandidate): number {
  if (c.feeModel !== "per_item") return cleanRate(c);
  const w = unitWeight(c);
  return w > 0 ? cleanRate(c) / w : Number.POSITIVE_INFINITY;
}

/** Batas unit karena kapasitas; berat tanpa unit tidak membatasi. */
function capByWeight(c: SuggestCandidate, remainingKg: number): number {
  const w = unitWeight(c);
  if (w <= 0) return Number.POSITIVE_INFINITY;
  return Math.floor(remainingKg / w);
}

function ceilDiv(value: number, unit: number): number {
  return unit > 0 ? Math.ceil(value / unit) : Number.POSITIVE_INFINITY;
}

export function suggestToTarget(input: SuggestInput): SuggestPlan {
  const currency = input.currency || "USD";
  const remainingKg = Number.isFinite(input.remainingKg) ? Math.max(0, input.remainingKg) : 0;
  const shortfall = Number.isFinite(input.shortfall) && input.shortfall > 0 ? input.shortfall : 0;
  const notes: string[] = [];

  // Urut stabil: efisiensi jasa/kg menurun, lalu id naik -> deterministik.
  const ranked = [...input.candidates].sort((a, b) => {
    const ea = servicePerKg(a);
    const eb = servicePerKg(b);
    const aInf = !Number.isFinite(ea);
    const bInf = !Number.isFinite(eb);
    if (aInf !== bInf) return aInf ? -1 : 1; // efisiensi tak hingga dulu
    if (!aInf && ea !== eb) return eb - ea;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const goods: PricedGood[] = [];
  let leftKg = remainingKg;
  let leftShortfall = shortfall;

  for (const c of ranked) {
    if (leftShortfall <= 0 && shortfall > 0) break; // target sudah tertutup
    const avail = Number.isFinite(c.maxQty) && c.maxQty > 0 ? Math.floor(c.maxQty) : 0;
    if (avail <= 0) continue;

    const perUnit = servicePerUnit(c);
    const byWeight = capByWeight(c, leftKg);
    // Bila jasa per unit nol, kandidat tak membantu; ambil seminimalnya.
    const need = perUnit > 0 ? ceilDiv(leftShortfall, perUnit) : 0;
    const qty = Math.min(avail, byWeight, need);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const w = unitWeight(c);
    leftKg = Math.max(0, leftKg - qty * w);
    leftShortfall = Math.max(0, leftShortfall - qty * perUnit);
    goods.push({
      id: c.id,
      name: c.name,
      kg: w,
      qty,
      beli: Number.isFinite(c.beli ?? 0) ? (c.beli ?? 0) : 0,
      pricing: { model: c.feeModel, rate: c.feeRate, currency },
    });
  }

  const revenue = computeRevenue(goods, 0, currency);
  const lines: SuggestLine[] = revenue.rows.map((row) => ({
    candidateId: row.id,
    name: row.name,
    qty: row.qty,
    weightKg: row.weightKg,
    service: row.service,
    currency: row.currency,
  }));

  const totalService = Number.isFinite(revenue.service) ? revenue.service : 0;
  const totalKg = Number.isFinite(revenue.totalKg) ? revenue.totalKg : 0;
  const achievable = shortfall === 0 || totalService >= shortfall;

  if (input.candidates.length === 0) {
    notes.push("Tidak ada kandidat produk; proyeksi nol dan target belum bisa ditutup.");
  }
  if (!achievable) {
    notes.push(
      `Proyeksi jasa ${totalService} ${currency} belum menutup kekurangan ${shortfall} ${currency}; tambah kandidat atau longgarkan kapasitas.`,
    );
  }
  notes.push("Angka ini PROYEKSI, bukan omzet yang sudah diakui dan bukan pesanan.");

  return {
    kind: "proyeksi",
    lines,
    totalService,
    totalKg,
    shortfall,
    projected: totalService,
    achievable,
    notes,
  };
}
