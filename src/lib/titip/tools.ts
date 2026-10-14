/**
 * Registry tool buat asisten AI: definisi JSON-schema (dikirim ke model) dan
 * executor (dijalankan di browser lewat store + `/api/*`). Satu file supaya
 * definisi dan aksi tidak pernah drift.
 *
 * Prinsip: tool hanya membungkus aksi yang sudah ada di UI. Aturan peran, admin
 * tunggal, validasi, dan batas tetap ditegakkan server; tool tidak menembusnya.
 */
import type { AiToolDef } from "./ai";
import { authedFetch, session } from "./session.svelte";
import {
  addGood, desk, patch, patchDir, removeGood, resetDir, setCapex, setDir, setGood, setMode, setOpex, snapshot,
} from "./trip-store.svelte";
import { computeTrip, type Dir } from "./calc";
import { capacity, computeRevenue, targetProgress } from "./pricing";
import { suggestToTarget, type SuggestCandidate } from "./suggest";
import { evaluateRisk, type RiskRule } from "./risk";
import { isArah, isStatus, type TitipanRow } from "./titipan";
import { isRole } from "./roles";

type Json = Record<string, unknown>;
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const obj = (props: Json, required: string[] = []): Json => ({ type: "object", properties: props, required, additionalProperties: false });
const n = { type: "number" } as const;
const s = { type: "string" } as const;
const b = { type: "boolean" } as const;
const dirEnum = { type: "string", enum: ["cgk-ist", "ist-cgk"] } as const;

export const TOOL_DEFS: AiToolDef[] = [
  { type: "function", function: { name: "ringkasan_trip", description: "Baca angka meja hitung saat ini (kuota, sisa, omzet jasa, laba, progres target).", parameters: obj({}) } },
  { type: "function", function: { name: "set_trip", description: "Ubah skenario trip. Hanya field yang dikirim berubah. arah menentukan kaki mana.", parameters: obj({
    arah: dirEnum,
    mode: { type: "string", enum: ["one", "pp"] },
    bags: n, kgPerBag: n, cabin: n, tare: n, overPerKg: n, hargaPerKg: n, margin: n, ujiKg: n, kursTry: n,
    target: n, hargaCurrency: { type: "string", enum: ["IDR", "USD", "TRY"] },
  }) } },
  { type: "function", function: { name: "set_opex", description: "Set nominal satu baris opex berdasarkan id baris (lihat ringkasan_trip).", parameters: obj({ id: s, amount: n }, ["id", "amount"]) } },
  { type: "function", function: { name: "set_capex", description: "Set harga dan/atau umur trip sebuah capex berdasarkan id baris.", parameters: obj({ id: s, price: n, trips: n }, ["id"]) } },
  { type: "function", function: { name: "tambah_barang", description: "Tambah satu barang ke muatan kaki aktif.", parameters: obj({ nama: s, kg: n, qty: n, beli: n, model_tarif: { type: "string", enum: ["per_kg", "per_item"] }, tarif: n, satuan: s }, ["nama", "kg"]) } },
  { type: "function", function: { name: "ubah_barang", description: "Ubah barang berdasarkan id (lihat ringkasan_trip).", parameters: obj({ id: s, nama: s, kg: n, qty: n, beli: n, tarif: n, model_tarif: { type: "string", enum: ["per_kg", "per_item"] }, satuan: s }, ["id"]) } },
  { type: "function", function: { name: "hapus_barang", description: "Hapus barang dari muatan aktif.", parameters: obj({ id: s }, ["id"]) } },
  { type: "function", function: { name: "reset_arah", description: "Kembalikan kaki aktif ke nilai contoh awal.", parameters: obj({}) } },
  { type: "function", function: { name: "daftar_titipan", description: "Baca daftar titipan (butuh masuk; klien melihat miliknya, jastiper/admin melihat semua).", parameters: obj({}) } },
  { type: "function", function: { name: "buat_titipan", description: "Buat titipan baru (peran klien atau admin).", parameters: obj({ arah: dirEnum, nama: s, kg: n, catatan: s }, ["arah", "nama", "kg"]) } },
  { type: "function", function: { name: "ubah_status_titipan", description: "Ubah status titipan: baru | dibawa | selesai (peran jastiper atau admin).", parameters: obj({ id: s, status: { type: "string", enum: ["baru", "dibawa", "selesai"] } }, ["id", "status"]) } },
  { type: "function", function: { name: "daftar_orang", description: "Daftar akun dan peran (admin saja).", parameters: obj({}) } },
  { type: "function", function: { name: "set_peran", description: "Ubah peran akun lain (admin saja). Admin tetap satu.", parameters: obj({ user_id: s, role: { type: "string", enum: ["klien", "jastiper", "admin"] } }, ["user_id", "role"]) } },
  { type: "function", function: { name: "usul_penutup_target", description: "Proyeksi rencana barang untuk menutup kekurangan target jasa. Murni hitungan, tidak mengubah data.", parameters: obj({
    kekurangan: n,
    kandidat: { type: "array", items: obj({ id: s, nama: s, unit_kg: n, model_tarif: { type: "string", enum: ["per_kg", "per_item"] }, tarif: n, max_qty: n, beli: n }, ["id", "nama", "unit_kg", "model_tarif", "tarif", "max_qty"]) },
  }, ["kekurangan", "kandidat"]) } },
  { type: "function", function: { name: "periksa_risiko", description: "Tandai baris untuk ditinjau bea cukai memakai aturan yang diberikan pemanggil. Tanpa aturan, tidak ada angka karangan.", parameters: obj({
    barang: { type: "array", items: obj({ nama: s, kategori: s, qty: n, kg: n, nilai: n }, ["nama"]) },
    aturan: { type: "array", items: obj({ id: s, route: dirEnum, categories: { type: "array", items: s }, keywords: { type: "array", items: s }, maxQty: n, maxValue: n, maxWeightKg: n, requiresDocument: b, blocking: b, note: s, source: s, checkedAt: s }, ["id", "route", "categories", "requiresDocument", "note"]) },
  }, ["barang"]) } },
];

async function jsonFetch(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Json }> {
  const res = await authedFetch(url, init);
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

function ringkasan(): Json {
  const s = snapshot();
  const legs = (["cgk-ist", "ist-cgk"] as Dir[]).map((d) => {
    const sc = s[d === "cgk-ist" ? "cgkIst" : "istCgk"];
    const rev = computeRevenue(sc.goods, sc.hargaPerKg);
    return {
      arah: d, aktif: s.dir === d, bags: sc.bags, kgPerBag: sc.kgPerBag, cabin: sc.cabin, tare: sc.tare,
      overPerKg: sc.overPerKg, hargaPerKg: sc.hargaPerKg, margin: sc.margin, ujiKg: sc.ujiKg, kursTry: sc.kursTry,
      target: sc.target ?? 0, hargaCurrency: sc.hargaCurrency ?? "IDR",
      barang: sc.goods.map((g) => ({ id: g.id, nama: g.name, kg: g.kg, qty: g.qty, beli: g.beli, tarif: g.pricing?.rate, model: g.pricing?.model })),
      opex: sc.opex, capex: sc.capex,
      kuotaBersih: capacity(sc.bags * sc.kgPerBag + sc.cabin - sc.tare, rev.totalKg).capacityKg,
      omzetJasa: rev.service,
    };
  });
  const n = computeTrip(s.mode, s.dir, { "cgk-ist": s.cgkIst, "ist-cgk": s.istCgk });
  const aktif = s.dir === "cgk-ist" ? s.cgkIst : s.istCgk;
  const rev = computeRevenue(aktif.goods, aktif.hargaPerKg);
  return {
    mode: s.mode,
    arahAktif: s.dir,
    sisaKg: Math.round(n.sisa * 10) / 10,
    overKg: n.overKg,
    omzetJasa: rev.service,
    target: aktif.target ?? 0,
    progresPersen: targetProgress(rev.service, aktif.target ?? 0).persen,
    laba: n.laba,
    beban: n.beban,
    kaki: legs,
  };
}

export async function runTool(name: string, args: Json): Promise<Json> {
  switch (name) {
    case "ringkasan_trip":
      return ringkasan();

    case "set_trip": {
      const arah: Dir = args.arah === "ist-cgk" ? "ist-cgk" : "cgk-ist";
      if (args.mode === "one" || args.mode === "pp") setMode(args.mode);
      const fields: Record<string, number | string> = {};
      for (const key of ["bags", "kgPerBag", "cabin", "tare", "overPerKg", "hargaPerKg", "margin", "ujiKg", "kursTry", "target"]) {
        const v = num(args[key]);
        if (v !== undefined) fields[key] = v;
      }
      if (str(args.hargaCurrency)) fields.hargaCurrency = str(args.hargaCurrency) as string;
      if (Object.keys(fields).length) patchDir(arah, fields);
      if (args.arah) setDir(arah);
      return { ok: true, ringkasan: ringkasan() };
    }

    case "set_opex": {
      const id = str(args.id);
      const amount = num(args.amount);
      if (!id || amount === undefined) return { error: "isian" };
      const aktif = desk.dir === "cgk-ist" ? desk.byDir["cgk-ist"] : desk.byDir["ist-cgk"];
      if (!aktif.opex.some((line) => line.id === id)) return { error: "id tidak ada", opex: aktif.opex };
      setOpex(id, amount);
      return { ok: true, opex: aktif.opex };
    }

    case "set_capex": {
      const id = str(args.id);
      if (!id) return { error: "isian" };
      const aktif = desk.dir === "cgk-ist" ? desk.byDir["cgk-ist"] : desk.byDir["ist-cgk"];
      if (!aktif.capex.some((line) => line.id === id)) return { error: "id tidak ada", capex: aktif.capex };
      const partial: { price?: number; trips?: number } = {};
      if (num(args.price) !== undefined) partial.price = num(args.price);
      if (num(args.trips) !== undefined) partial.trips = num(args.trips);
      setCapex(id, partial);
      return { ok: true, capex: aktif.capex };
    }

    case "tambah_barang": {
      const nama = str(args.nama);
      const weight = num(args.kg);
      if (!nama || nama.length < 2 || nama.length > 80 || weight === undefined || weight <= 0 || weight > 100) return { error: "isian" };
      const tarif = num(args.tarif);
      const model = args.model_tarif === "per_item" ? "per_item" : "per_kg";
      addGood({
        id: `g${Date.now().toString(36)}`, name: nama, kg: weight,
        qty: num(args.qty) ?? 1, beli: num(args.beli) ?? 0,
        ...(tarif && tarif > 0 ? { pricing: { model, rate: tarif, ...(str(args.satuan) ? { unit: str(args.satuan) } : {}) } } : {}),
      });
      return { ok: true, ringkasan: ringkasan() };
    }

    case "ubah_barang": {
      const id = str(args.id);
      if (!id) return { error: "isian" };
      const aktif = desk.byDir[desk.dir];
      const good = aktif.goods.find((g) => g.id === id);
      if (!good) return { error: "id tidak ada", barang: aktif.goods.map((g) => g.id) };
      const nama = str(args.nama);
      const weight = num(args.kg);
      const qty = num(args.qty);
      const beli = num(args.beli);
      const tarif = num(args.tarif);
      setGood(id, {
        ...(nama ? { name: nama.slice(0, 80) } : {}),
        ...(weight !== undefined && weight > 0 && weight <= 100 ? { kg: weight } : {}),
        ...(qty !== undefined ? { qty } : {}),
        ...(beli !== undefined && beli >= 0 ? { beli } : {}),
        ...(tarif !== undefined ? { pricing: { model: args.model_tarif === "per_item" ? "per_item" : (good.pricing?.model ?? "per_kg"), rate: Math.max(0, tarif), ...(str(args.satuan) ? { unit: str(args.satuan) } : {}) } } : {}),
      });
      return { ok: true, ringkasan: ringkasan() };
    }

    case "hapus_barang": {
      const id = str(args.id);
      if (!id || !desk.byDir[desk.dir].goods.some((g) => g.id === id)) return { error: "id tidak ada" };
      removeGood(id);
      return { ok: true, ringkasan: ringkasan() };
    }

    case "reset_arah":
      resetDir();
      return { ok: true, ringkasan: ringkasan() };

    case "daftar_titipan": {
      const res = await jsonFetch("/api/titipan");
      if (!res.ok) return { error: res.data.error ?? "gagal", status: res.status };
      return { rows: (res.data.rows as TitipanRow[]) ?? [] };
    }

    case "buat_titipan": {
      const nama = str(args.nama);
      const weight = num(args.kg);
      if (!isArah(args.arah) || !nama || !weight || weight <= 0 || weight > 40) return { error: "isian" };
      const res = await jsonFetch("/api/titipan", { method: "POST", body: JSON.stringify({ arah: args.arah, nama: nama.slice(0, 80), kg: weight, catatan: (str(args.catatan) ?? "").slice(0, 240) }) });
      return res.ok ? { ok: true, id: res.data.id } : { error: res.data.error ?? "gagal" };
    }

    case "ubah_status_titipan": {
      const id = str(args.id);
      if (!id || !isStatus(args.status)) return { error: "isian" };
      const res = await jsonFetch("/api/titipan", { method: "PATCH", body: JSON.stringify({ id, status: args.status }) });
      return res.ok ? { ok: true } : { error: res.data.error ?? "gagal" };
    }

    case "daftar_orang": {
      const res = await jsonFetch("/api/admin");
      return res.ok ? { people: res.data.people ?? [] } : { error: res.data.error ?? "gagal" };
    }

    case "set_peran": {
      const userId = str(args.user_id);
      if (!userId || !isRole(args.role)) return { error: "isian" };
      const res = await jsonFetch("/api/admin", { method: "POST", body: JSON.stringify({ userId, role: args.role }) });
      return res.ok ? { ok: true } : { error: res.data.error ?? "gagal" };
    }

    case "usul_penutup_target": {
      const aktif = desk.byDir[desk.dir];
      const rev = computeRevenue(aktif.goods, aktif.hargaPerKg);
      const kekurangan = num(args.kekurangan) ?? Math.max(0, (aktif.target ?? 0) - rev.service);
      const kandidat = Array.isArray(args.kandidat) ? args.kandidat : [];
      const candidates: SuggestCandidate[] = kandidat.flatMap((raw) => {
        const c = raw as Json;
        const id = str(c.id);
        const nama = str(c.nama);
        const unit = num(c.unit_kg);
        const tarif = num(c.tarif);
        const maxQty = num(c.max_qty);
        if (!id || !nama || unit === undefined || tarif === undefined || maxQty === undefined) return [];
        return [{ id, name: nama, unitWeightKg: unit, feeModel: c.model_tarif === "per_item" ? "per_item" : "per_kg" as const, feeRate: tarif, maxQty, beli: num(c.beli) }];
      });
      const plan = suggestToTarget({ candidates, remainingKg: capacity(aktif.bags * aktif.kgPerBag + aktif.cabin - aktif.tare, rev.totalKg).remainingKg, shortfall: kekurangan, currency: aktif.hargaCurrency ?? "IDR" });
      return { ...plan, catatan: "PROYEKSI, bukan omzet diakui atau pesanan" };
    }

    case "periksa_risiko": {
      const barang = Array.isArray(args.barang) ? args.barang : [];
      const aturan = Array.isArray(args.aturan) ? args.aturan : [];
      const rules = aturan.flatMap((raw) => {
        const r = raw as Json;
        const id = str(r.id);
        const note = str(r.note);
        if (!id || !note || (r.route !== "cgk-ist" && r.route !== "ist-cgk")) return [];
        return [{
          id, route: r.route, categories: Array.isArray(r.categories) ? r.categories.filter((x): x is string => typeof x === "string") : [],
          keywords: Array.isArray(r.keywords) ? r.keywords.filter((x): x is string => typeof x === "string") : undefined,
          maxQty: num(r.maxQty), maxValue: num(r.maxValue), maxWeightKg: num(r.maxWeightKg),
          requiresDocument: r.requiresDocument === true, blocking: r.blocking === true, note, source: str(r.source), checkedAt: str(r.checkedAt),
        } as RiskRule];
      });
      return { hasil: barang.map((raw) => {
        const row = raw as Json;
        return {
          nama: str(row.nama) ?? "", ...evaluateRisk({
            name: str(row.nama) ?? "", category: str(row.kategori) ?? "", qty: num(row.qty) ?? 0,
            weightKg: num(row.kg) ?? 0, value: num(row.nilai) ?? 0,
          }, rules),
        };
      }), catatan: rules.length === 0 ? "Tidak ada aturan diberikan; tidak ada angka hukum karangan." : "Hanya menandai untuk ditinjau, bukan cara melewati bea cukai." };
    }

    default:
      return { error: "tool tidak dikenal" };
  }
}

/** Ringkas hasil tool jadi teks pendek untuk dikirim balik ke model. */
export function summarize(name: string, result: Json): string {
  const text = JSON.stringify(result);
  return text.length > 6000 ? `${text.slice(0, 6000)}…` : text;
}

