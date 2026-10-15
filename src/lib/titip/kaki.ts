/**
 * Model trip berkaki bebas.
 *
 * Trip = daftar kaki (penerbangan) berurutan. Tiap kaki punya destinasi,
 * mata uang belanja, kuota bagasi, muatan, opex, dan capex sendiri. Kaki
 * bertanda `transit` = singgah pendek (jam, bukan hari) yang tetap boleh
 * diisi barang terbatas.
 *
 * Koridor lama (Jakarta ↔ Turki) hanya kasus khusus: dua kaki.
 * `dariTripLama` mengubah state v1 ke daftar kaki supaya data lama tetap terbaca.
 */
import {
  scenarioFor,
  type CapexLine,
  type Dir,
  type Scenario,
} from "./calc.ts";
import { destinasiByCode, type Destinasi } from "./destinasi.ts";

/** Satu penerbangan dalam satu trip. */
export type Kaki = {
  id: string;
  /** Kode destinasi katalog, atau "jakarta" untuk kaki asal. */
  destinasi: string;
  /** "utama" = tujuan belanja; "transit" = singgah pendek. */
  jenis: "utama" | "transit";
  /** Lama di sana: hari untuk utama, jam untuk transit. */
  lama: number;
  scenario: Scenario;
};

export type TripKaki = {
  /** Nama trip bebas, mis. "Jepang Maret". */
  nama: string;
  kaki: Kaki[];
};

const ID = () => Math.random().toString(36).slice(2, 10);

/**
 * Skenario awal untuk satu kaki. Angka mengikuti destinasi (kurs, harga
 * tiket contoh, opex lokal) supaya meja tidak mulai dari nol. Semua nilai
 * tetap contoh — jastiper yang mengubah.
 */
export function scenarioForKaki(kode: string, jenis: Kaki["jenis"]): Scenario {
  const d = destinasiByCode(kode);
  const transit = jenis === "transit";

  // Kuota contoh: transit = bagasi kecil & cepat; utama = koper penuh.
  const base: Scenario = {
    bags: transit ? 0 : 1,
    kgPerBag: transit ? 7 : 23,
    cabin: transit ? 7 : 7,
    tare: transit ? 1.5 : 3.2,
    overPerKg: d ? Math.round(d.kurs * 25) : 350000,
    hargaPerKg: d ? Math.round(d.kurs * 120) : 280000,
    margin: 40,
    ujiKg: 0.5,
    kursTry: d?.currency === "TRY" ? d.kurs : 470,
    goods: [],
    opex: [
      {
        id: "tiket",
        label: d ? `Tiket → ${d.kota}` : "Tiket",
        amount: d ? tiketContoh(d, transit) : 0,
      },
      { id: "pack", label: "Packing & lakban", amount: transit ? 0 : 150000 },
      { id: "makan", label: "Makan & lokal", amount: transit ? 150000 : 400000 },
    ],
    capex: [],
  };
  if (d) base.hargaCurrency = d.currency;
  return base;
}

/** Tiket contoh kasar per destinasi: jauh & transit lebih murah. */
function tiketContoh(d: Destinasi, transit: boolean): number {
  const tiketUmum: Record<string, number> = {
    jepang: 6500000,
    korea: 6200000,
    singapura: 2200000,
    hongkong: 3800000,
    thailand: 2600000,
    amerika: 16000000,
    prancis: 14000000,
    malaysia: 1500000,
    jerman: 13500000,
    australia: 8500000,
  };
  return tiketUmum[d.code] ?? 5000000;
}

/** Kaki kosong untuk destinasi (jenis default utama). */
export function newKaki(kode: string, jenis: Kaki["jenis"] = "utama"): Kaki {
  return {
    id: `${kode}-${ID()}`,
    destinasi: kode,
    jenis,
    lama: jenis === "transit" ? 6 : 5,
    scenario: scenarioForKaki(kode, jenis),
  };
}

/** Nama tampilan satu kaki, mis. "Jakarta → Tokyo" atau "Tokyo (transit)". */
export function kakiLabel(kaki: Kaki, prev?: Kaki): string {
  const to = destinasiByCode(kaki.destinasi);
  const tujuan = to ? `${to.kota}` : kaki.destinasi === "jakarta" ? "Jakarta" : kaki.destinasi;
  if (kaki.jenis === "transit" && prev) {
    const dari = destinasiByCode(prev.destinasi);
    const asal = dari ? dari.kota : "Jakarta";
    return `${asal} → ${tujuan} · transit ${kaki.lama}j`;
  }
  return tujuan;
}

/** Kode tampilan rute, mis. "CGK → NRT". Kaki asal (Jakarta) tampil "CGK" saja. */
export function kakiCode(kaki: Kaki, prev?: Kaki): string {
  const to = destinasiByCode(kaki.destinasi);
  const kodeTo = to?.iata ?? (kaki.destinasi === "jakarta" ? "CGK" : kaki.destinasi.toUpperCase());
  if (!prev) {
    // Kaki pertama = titik asal; tak ada panah.
    return kaki.destinasi === "jakarta" ? "CGK (asal)" : kodeTo;
  }
  const from = destinasiByCode(prev.destinasi);
  const kodeFrom = prev.destinasi === "jakarta" ? "CGK" : from?.iata ?? "CGK";
  return `${kodeFrom} → ${kodeTo}`;
}

/**
 * Ubah state trip lama (v1: dir + mode + cgkIst/istCgk) jadi daftar kaki.
 * `one` = satu kaki; `pp` = dua kaki. Arah Turki memakai skenario istCgk.
 */
export function dariTripLama(input: { dir: Dir; mode: "one" | "pp"; cgkIst: Scenario; istCgk: Scenario }): TripKaki {
  const turki: Kaki = {
    id: "turki",
    destinasi: "turki",
    jenis: "utama",
    lama: 5,
    scenario: input.istCgk,
  };
  const jakarta: Kaki = {
    id: "jakarta",
    destinasi: "jakarta",
    jenis: "utama",
    lama: 3,
    scenario: input.cgkIst,
  };
  if (input.dir === "ist-cgk") {
    return input.mode === "pp"
      ? { nama: "Turki ↔ Jakarta", kaki: [jakarta, turki] }
      : { nama: "Turki → Jakarta", kaki: [turki] };
  }
  return input.mode === "pp"
    ? { nama: "Jakarta ↔ Turki", kaki: [jakarta, turki] }
    : { nama: "Jakarta → Turki", kaki: [jakarta] };
}
