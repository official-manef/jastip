import { z } from "zod";
import type { Dir } from "./calc.ts";

/**
 * Aturan risiko cukai/bea untuk barang titipan.
 *
 * SEMUA batas berasal dari konfigurasi pemanggil. Modul ini TIDAK mengarang
 * angka hukum, persentase peluang pemeriksaan, ataupun tarif cukai. Setiap
 * aturan wajib mencatat `source` + `checkedAt` karena ketentuan resmi harus
 * diverifikasi dan sumbernya dicatat.
 *
 * Referensi Indonesia (dari handover):
 *   - https://beacukai.go.id/barang-penumpang
 *   - https://beacukai.go.id/faq-barang-penumpang
 * Ketentuan rute Turki (kedatangan IST) BELUM diperiksa; jangan mengisi batas
 * rute itu sebelum ada sumber resmi.
 *
 * DILARANG memakai modul ini untuk menyembunyikan barang atau menghindari
 * deklarasi. Jika ada permintaan seperti itu, TOLAK. Modul ini hanya menandai
 * baris untuk ditinjau petugas, bukan cara melewati bea cukai.
 */

export type RiskRule = {
  id: string;
  /** Arah perjalanan aturan ini berlaku. */
  route: Dir;
  /** Kategori yang terkena aturan; kosong berarti semua kategori. */
  categories: string[];
  /** Kata kunci pada nama barang; opsional. */
  keywords?: string[];
  /** Batas jumlah unit. */
  maxQty?: number;
  /** Batas nilai pembelian (mata uang nilai barang). */
  maxValue?: number;
  /** Batas berat total baris (kg). */
  maxWeightKg?: number;
  /** Wajib dokumen pendukung; belum dipenuhi -> naik ke `review`. */
  requiresDocument: boolean;
  /** Melampaui batas aturan ini menandai blokir eksplisit. */
  blocking?: boolean;
  /** Penjelasan aturan (dipakai juga sebagai label dokumen). */
  note: string;
  /** URL sumber resmi. */
  source?: string;
  /** Tanggal verifikasi sumber, ISO date, mis. "2026-10-14". */
  checkedAt?: string;
};

/** Satu baris barang yang dinilai. */
export type RiskInput = {
  name: string;
  category: string;
  qty: number;
  weightKg: number;
  /** Nilai pembelian baris. */
  value: number;
};

export type RiskLevel = "ok" | "review" | "blocked";

export type RiskVerdict = {
  level: RiskLevel;
  flags: string[];
  documents: string[];
  reasons: string[];
  blocked: boolean;
};

const LEVEL_RANK: Record<RiskLevel, number> = { ok: 0, review: 1, blocked: 2 };

function worse(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;
}

/** Aturan mengenai baris bila kategori cocok dan (bila ada) kata kunci nama cocok. */
function applies(rule: RiskRule, input: RiskInput): boolean {
  const byCategory = rule.categories.length === 0 || rule.categories.includes(input.category);
  if (!byCategory) return false;
  if (!rule.keywords || rule.keywords.length === 0) return true;
  const name = input.name.toLowerCase();
  return rule.keywords.some((k) => name.includes(k.toLowerCase()));
}

/**
 * Nilai satu baris terhadap daftar aturan yang diberikan.
 * Pemanggil bertanggung jawab menyaring `rules` per rute lebih dulu.
 */
export function evaluateRisk(input: RiskInput, rules: RiskRule[]): RiskVerdict {
  const flags: string[] = [];
  const documents: string[] = [];
  const reasons: string[] = [];
  let level: RiskLevel = "ok";

  const qty = Number.isFinite(input.qty) ? input.qty : 0;
  const value = Number.isFinite(input.value) ? input.value : 0;
  const weight = Number.isFinite(input.weightKg) ? input.weightKg : 0;

  for (const rule of rules) {
    if (!applies(rule, input)) continue;

    const exceeded: string[] = [];
    if (rule.maxQty !== undefined && qty > rule.maxQty) {
      exceeded.push(`qty ${qty} > ${rule.maxQty}`);
      flags.push(`${rule.id}:qty`);
    }
    if (rule.maxValue !== undefined && value > rule.maxValue) {
      exceeded.push(`nilai ${value} > ${rule.maxValue}`);
      flags.push(`${rule.id}:value`);
    }
    if (rule.maxWeightKg !== undefined && weight > rule.maxWeightKg) {
      exceeded.push(`berat ${weight} kg > ${rule.maxWeightKg} kg`);
      flags.push(`${rule.id}:weight`);
    }

    if (exceeded.length > 0) {
      reasons.push(`"${rule.note}" (${rule.id}): ${exceeded.join("; ")}`);
      level = worse(level, rule.blocking ? "blocked" : "review");
    }

    if (rule.requiresDocument) {
      documents.push(rule.note);
      flags.push(`${rule.id}:doc`);
      reasons.push(`"${rule.note}" (${rule.id}): wajib dokumen pendukung`);
      level = worse(level, "review");
    }
  }

  return { level, flags, documents, reasons, blocked: level === "blocked" };
}

export type RiskConfig = {
  rules: RiskRule[];
};

/** Konfigurasi kosong: TANPA angka hukum bikinan; isi dari sumber resmi. */
export function defaultRiskConfig(): RiskConfig {
  return { rules: [] };
}

const ruleSchema = z.object({
  id: z.string().min(1).max(80),
  route: z.enum(["cgk-ist", "ist-cgk"]),
  categories: z.array(z.string().min(1)).max(50),
  keywords: z.array(z.string().min(1)).max(50).optional(),
  maxQty: z.number().finite().nonnegative().optional(),
  maxValue: z.number().finite().nonnegative().optional(),
  maxWeightKg: z.number().finite().nonnegative().optional(),
  requiresDocument: z.boolean(),
  blocking: z.boolean().optional(),
  note: z.string().min(1).max(400),
  source: z.string().min(1).max(300).optional(),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional(),
});

const configSchema = z.object({ rules: z.array(ruleSchema).max(200) });

/** Tolak bentuk tak valid; kembalikan null. */
export function parseRiskConfig(value: unknown): RiskConfig | null {
  const parsed = configSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
