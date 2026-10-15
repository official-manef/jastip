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
  addGood, desk, patch, patchKaki, removeGood, resetKaki, setGood, setOpex, setCapex,
  kakiAktif, tambahKaki, sisipKaki, hapusKaki, setAktif, setDestinasi, setNama, snapshot,
} from "./trip-store.svelte";
import { compute } from "./calc";
import { capacity, computeRevenue, targetProgress, tripLintas } from "./pricing";
import { DESTINASI, destinasiByCode } from "./destinasi";
import { newKaki as baruKaki } from "./kaki";
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
const kakiJenis = { type: "string", enum: ["utama", "transit"] } as const;
const destinasiEnum = { type: "string", enum: DESTINASI.map((d) => d.code) } as const;

export const TOOL_DEFS: AiToolDef[] = [
  { type: "function", function: { name: "ringkasan_trip", description: "Baca angka kalkulator: rute (daftar tahap), kuota, muatan, omzet, laba, progres target, dan daftar negara tujuan yang tersedia.", parameters: obj({}) } },
  { type: "function", function: { name: "set_trip", description: "Ubah skenario TAHAP AKTIF. Hanya field yang dikirim berubah.", parameters: obj({
    bags: n, kgPerBag: n, cabin: n, tare: n, overPerKg: n, hargaPerKg: n, margin: n, ujiKg: n, kursTry: n,
    target: n, hargaCurrency: { type: "string", enum: ["IDR", "USD", "TRY", "JPY", "KRW", "SGD", "HKD", "THB", "EUR", "MYR", "AUD"] },
  }) } },
  { type: "function", function: { name: "pilih_kaki", description: "Jadikan tahap ke-`index` sebagai tahap aktif (index 0 = tahap pertama).", parameters: obj({ index: n }, ["index"]) } },
  { type: "function", function: { name: "tambah_kaki", description: "Tambah tahap baru di akhir rute. destinasi = kode negara (lihat ringkasan_trip.negaraTersedia).", parameters: obj({ destinasi: destinasiEnum, jenis: kakiJenis, lama: n }, ["destinasi"]) } },
  { type: "function", function: { name: "sisip_transit", description: "Sisipkan tahap transit setelah tahap ke-`index` (untuk negara singgah di tengah rute).", parameters: obj({ index: n, destinasi: destinasiEnum, lama: n }, ["index", "destinasi"]) } },
  { type: "function", function: { name: "hapus_kaki", description: "Hapus tahap ke-`index`. Minimal satu tahap harus tersisa.", parameters: obj({ index: n }, ["index"]) } },
  { type: "function", function: { name: "set_kaki", description: "Ubah jenis (utama|transit) atau lama tahap ke-`index`.", parameters: obj({ index: n, jenis: kakiJenis, lama: n }, ["index"]) } },
  { type: "function", function: { name: "set_nama_trip", description: "Ubah nama trip.", parameters: obj({ nama: s }, ["nama"]) } },
  { type: "function", function: { name: "set_opex", description: "Set nominal satu baris biaya jalan tahap aktif berdasarkan id (lihat ringkasan_trip).", parameters: obj({ id: s, amount: n }, ["id", "amount"]) } },
  { type: "function", function: { name: "set_capex", description: "Set harga dan/atau umur trip sebuah biaya alat; berlaku untuk semua tahap.", parameters: obj({ id: s, price: n, trips: n }, ["id"]) } },
  { type: "function", function: { name: "tambah_barang", description: "Tambah satu barang ke muatan tahap aktif.", parameters: obj({ nama: s, kg: n, qty: n, beli: n, model_tarif: { type: "string", enum: ["per_kg", "per_item"] }, tarif: n, satuan: s }, ["nama", "kg"]) } },
  { type: "function", function: { name: "ubah_barang", description: "Ubah barang berdasarkan id (lihat ringkasan_trip).", parameters: obj({ id: s, nama: s, kg: n, qty: n, beli: n, tarif: n, model_tarif: { type: "string", enum: ["per_kg", "per_item"] }, satuan: s }, ["id"]) } },
  { type: "function", function: { name: "hapus_barang", description: "Hapus barang dari muatan tahap aktif.", parameters: obj({ id: s }, ["id"]) } },
  { type: "function", function: { name: "reset_kaki", description: "Kembalikan tahap aktif ke nilai contoh destinasi/jenis-nya.", parameters: obj({}) } },
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
  const idx = Math.min(desk.aktif, Math.max(0, s.kaki.length - 1));
  const now = s.kaki[idx];
  const meta = destinasiByCode(now.destinasi);
  const rev = computeRevenue(now.scenario.goods, now.scenario.hargaPerKg, meta?.currency ?? "IDR");
  const lintas = tripLintas(s.kaki.map((k) => ({ id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario })));
  const bebanTrip = s.kaki.reduce((sum, k) => {
    const opex = k.scenario.opex.reduce((a, l) => a + l.amount, 0);
    const capex = k.scenario.capex.reduce((a, l) => a + l.price / Math.max(1, l.trips), 0);
    return sum + Math.round(opex + capex);
  }, 0);
  const bersihKaki = Math.max(0, now.scenario.bags * now.scenario.kgPerBag + now.scenario.cabin - now.scenario.tare);
  return {
    nama: s.nama,
    jumlahKaki: s.kaki.length,
    kakiAktif: idx,
    rute: s.kaki.map((k, i) => ({
      index: i,
      destinasi: k.destinasi,
      negara: destinasiByCode(k.destinasi)?.negara ?? (k.destinasi === "jakarta" ? "Indonesia" : k.destinasi),
      kota: destinasiByCode(k.destinasi)?.kota ?? k.destinasi,
      jenis: k.jenis,
      lama: k.lama,
      aktif: i === idx,
      mataUangBelanja: destinasiByCode(k.destinasi)?.currency ?? "IDR",
      muatanKg: tripLintas([{ id: k.id, destinasi: k.destinasi, jenis: k.jenis, scenario: k.scenario }]).totalKg,
    })),
    sisaKgKakiIni: Math.round((bersihKaki - rev.totalKg) * 10) / 10,
    muatanTripKg: lintas.totalKg,
    kapasitasTripKg: lintas.capacityKg,
    overTripKg: lintas.overKg,
    omzetJasaTrip: lintas.service,
    labaTrip: Math.round(lintas.service - bebanTrip),
    bebanTrip,
    target: now.scenario.target ?? 0,
    progresPersen: targetProgress(rev.service, now.scenario.target ?? 0).persen,
    barang: now.scenario.goods.map((g) => ({ id: g.id, nama: g.name, kg: g.kg, qty: g.qty, beli: g.beli, tarif: g.pricing?.rate, model: g.pricing?.model })),
    opex: now.scenario.opex,
    capex: now.scenario.capex,
    negaraTersedia: DESTINASI.map((d) => ({ kode: d.code, negara: d.negara, kategori: d.kategori })),
  };
}

export async function runTool(name: string, args: Json): Promise<Json> {
  switch (name) {
    case "ringkasan_trip":
      return ringkasan();

    case "set_trip": {
      const fields: Record<string, number | string> = {};
      for (const key of ["bags", "kgPerBag", "cabin", "tare", "overPerKg", "hargaPerKg", "margin", "ujiKg", "kursTry", "target"]) {
        const v = num(args[key]);
        if (v !== undefined) fields[key] = v;
      }
      if (str(args.hargaCurrency)) fields.hargaCurrency = str(args.hargaCurrency) as string;
      if (Object.keys(fields).length) patch(fields);
      return { ok: true, ringkasan: ringkasan() };
    }

    case "pilih_kaki": {
      const index = num(args.index);
      if (index === undefined) return { error: "isian" };
      setAktif(index);
      return { ok: true, ringkasan: ringkasan() };
    }

    case "tambah_kaki": {
      const kode = str(args.destinasi);
      if (!kode || !DESTINASI.some((d) => d.code === kode)) return { error: "destinasi tidak ada", tersedia: DESTINASI.map((d) => d.code) };
      tambahKaki(kode, args.jenis === "transit" ? "transit" : "utama");
      return { ok: true, ringkasan: ringkasan() };
    }

    case "sisip_transit": {
      const index = num(args.index);
      const kode = str(args.destinasi);
      if (index === undefined || !kode || !DESTINASI.some((d) => d.code === kode)) return { error: "isian", tersedia: DESTINASI.map((d) => d.code) };
      sisipKaki(index, kode, "transit");
      if (num(args.lama) !== undefined) {
        // lama diisi lewat set_kaki berikutnya bila model mengirimnya.
      }
      return { ok: true, ringkasan: ringkasan() };
    }

    case "hapus_kaki": {
      const index = num(args.index);
      if (index === undefined) return { error: "isian" };
      if (snapshot().kaki.length <= 1) return { error: "minimal satu kaki" };
      hapusKaki(index);
      return { ok: true, ringkasan: ringkasan() };
    }

    case "set_kaki": {
      const index = num(args.index);
      if (index === undefined) return { error: "isian" };
      const s = snapshot().kaki[index];
      if (!s) return { error: "kaki tidak ada" };
      if (args.jenis === "transit" || args.jenis === "utama") {
        const segar = baruKaki(s.destinasi, args.jenis).scenario;
        patchKaki(index, { ...segar, goods: s.scenario.goods, capex: s.scenario.capex });
        desk.kaki = desk.kaki.map((k, i) => (i === index ? { ...k, jenis: args.jenis as "utama" | "transit" } : k));
      }
      if (num(args.lama) !== undefined) {
        desk.kaki = desk.kaki.map((k, i) => (i === index ? { ...k, lama: num(args.lama) as number } : k));
      }
      return { ok: true, ringkasan: ringkasan() };
    }

    case "set_nama_trip": {
      const nama = str(args.nama);
      if (!nama) return { error: "isian" };
      setNama(nama);
      return { ok: true, ringkasan: ringkasan() };
    }

    case "set_opex": {
      const id = str(args.id);
      const amount = num(args.amount);
      if (!id || amount === undefined) return { error: "isian" };
      const aktif = kakiAktif();
      if (!aktif.scenario.opex.some((line) => line.id === id)) return { error: "id tidak ada", opex: aktif.scenario.opex };
      setOpex(id, amount);
      return { ok: true, opex: aktif.scenario.opex };
    }

    case "set_capex": {
      const id = str(args.id);
      if (!id) return { error: "isian" };
      const aktif = kakiAktif();
      if (!aktif.scenario.capex.some((line) => line.id === id)) return { error: "id tidak ada", capex: aktif.scenario.capex };
      const partial: { price?: number; trips?: number } = {};
      if (num(args.price) !== undefined) partial.price = num(args.price);
      if (num(args.trips) !== undefined) partial.trips = num(args.trips);
      setCapex(id, partial);
      return { ok: true, capex: aktif.scenario.capex };
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
      const aktif = kakiAktif();
      const good = aktif.scenario.goods.find((g) => g.id === id);
      if (!good) return { error: "id tidak ada", barang: aktif.scenario.goods.map((g) => g.id) };
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
      if (!id || !kakiAktif().scenario.goods.some((g) => g.id === id)) return { error: "id tidak ada" };
      removeGood(id);
      return { ok: true, ringkasan: ringkasan() };
    }

    case "reset_kaki":
      resetKaki();
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
      const aktif = kakiAktif().scenario;
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

/**
 * F18: nama aksi yang dibaca manusia, bukan nama tool internal. Dipakai UI
 * asisten untuk catatan "Mengubah: …" supaya pengguna nonteknis tak melihat
 * `set_trip`/`tambah_kaki`.
 */
const AKSI_LABEL: Record<string, string> = {
  set_trip: "isi & tarif",
  set_nama_trip: "nama trip",
  set_opex: "biaya jalan",
  set_capex: "biaya alat",
  tambah_barang: "barang",
  ubah_barang: "barang",
  hapus_barang: "barang",
  pilih_kaki: "tahap aktif",
  tambah_kaki: "tahap",
  sisip_transit: "tahap transit",
  hapus_kaki: "tahap",
  set_kaki: "tahap",
  reset_kaki: "tahap",
  daftar_titipan: "daftar titipan",
  buat_titipan: "titipan",
  ubah_status_titipan: "status titipan",
  daftar_orang: "daftar orang",
  set_peran: "peran",
  ringkasan_trip: "ringkasan",
  usul_penutup_target: "usulan target",
  periksa_risiko: "periksa risiko",
};

export function aksiLabel(name: string): string {
  return AKSI_LABEL[name] ?? "data";
}

