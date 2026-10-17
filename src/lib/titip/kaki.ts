/**
 * Model trip bertahap bebas.
 *
 * Trip = daftar tahap (penerbangan) berurutan. Tiap tahap punya destinasi,
 * mata uang belanja, kuota bagasi, muatan, biaya jalan, dan biaya alat sendiri.
 * Tahap bertanda `transit` = singgah pendek (jam, bukan hari) yang tetap boleh
 * diisi barang terbatas.
 *
 * Koridor lama (Jakarta ↔ Turki) hanya kasus khusus: dua tahap.
 * `dariTripLama` mengubah state v1 ke daftar tahap supaya data lama tetap terbaca.
 */
import {
  scenarioFor,
  type CapexLine,
  type Dir,
  type Scenario,
} from "./calc.ts";
import { viewOf, type CustomDest } from "./destinasi.ts";

/** Satu penerbangan dalam satu trip. */
export type Kaki = {
  id: string;
  /** Kode destinasi katalog, `custom:<slug>`, atau "jakarta" untuk tahap asal. */
  destinasi: string;
  /** Data negara tambahan bila `destinasi` bukan katalog (dipilih "Negara lain…"). */
  custom?: CustomDest;
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
 * Skenario awal untuk satu tahap. Angka mengikuti destinasi (kurs, harga
 * tiket contoh, biaya jalan lokal) supaya kalkulator tidak mulai dari nol. Semua
 * nilai tetap contoh — jastiper yang mengubah.
 *
 * `custom` dipakai bila destinasi adalah negara tambahan (bukan katalog).
 */
export function scenarioForKaki(kode: string, jenis: Kaki["jenis"], custom?: CustomDest): Scenario {
  const view = viewOf(kode, custom);
  const transit = jenis === "transit";
  const kurs = view?.kurs && view.kurs > 0 ? view.kurs : 1;

  // Kuota contoh: transit = bagasi kecil & cepat; utama = koper penuh.
  const base: Scenario = {
    bags: transit ? 0 : 1,
    kgPerBag: transit ? 7 : 23,
    cabin: transit ? 7 : 7,
    tare: transit ? 1.5 : 3.2,
    overPerKg: Math.round(kurs * 25) || 350000,
    hargaPerKg: Math.round(kurs * 120) || 280000,
    margin: 40,
    ujiKg: 0.5,
    kursTry: view?.currency === "TRY" ? kurs : 470,
    goods: [],
    opex: [
      {
        id: "tiket",
        label: view ? `Tiket → ${view.kota}` : "Tiket",
        amount: view ? tiketContoh(view.code, transit) : 0,
      },
      { id: "pack", label: "Packing & lakban", amount: transit ? 0 : 150000 },
      { id: "makan", label: "Makan & lokal", amount: transit ? 150000 : 400000 },
    ],
    capex: [],
  };
  // F06: tarif jasa dinyatakan dalam rupiah (diturunkan dari kurs), jadi
  // JANGAN mewarisi mata uang belanja destinasi. Mata uang tarif default IDR;
  // pengguna boleh menggantinya di meja.
  return base;
}

/** Tiket contoh kasar per destinasi: jauh & transit lebih murah. */
function tiketContoh(code: string, transit: boolean): number {
  const tiketUmum: Record<string, number> = {
    jepang: 6500000,
    korea: 6200000,
    china: 5800000,
    taiwan: 5200000,
    hongkong: 3800000,
    singapura: 2200000,
    malaysia: 1500000,
    thailand: 2600000,
    vietnam: 2900000,
    filipina: 3400000,
    india: 7000000,
    turki: 6800000,
    uniemirat: 9000000,
    arab: 9500000,
    mesir: 10000000,
    prancis: 14000000,
    jerman: 13500000,
    belanda: 13800000,
    inggris: 14500000,
    italia: 14000000,
    swiss: 15000000,
    amerika: 16000000,
    kanada: 17000000,
    australia: 8500000,
    selandia: 11000000,
  };
  const base = tiketUmum[code] ?? 5000000;
  return transit ? Math.round(base * 0.3) : base;
}

/** Tahap kosong untuk destinasi (jenis default utama). */
export function newKaki(kode: string, jenis: Kaki["jenis"] = "utama", custom?: CustomDest): Kaki {
  return {
    id: `${kode === "jakarta" ? "jakarta" : kode}-${ID()}`.slice(0, 60),
    destinasi: kode,
    ...(custom ? { custom } : {}),
    jenis,
    lama: jenis === "transit" ? 6 : 5,
    scenario: scenarioForKaki(kode, jenis, custom),
  };
}

/** Nama tampilan satu tahap, mis. "Jakarta → Tokyo" atau "Tokyo (transit)". */
export function kakiLabel(kaki: Kaki, prev?: Kaki): string {
  const to = viewOf(kaki.destinasi, kaki.custom);
  const tujuan = to?.kota ?? (kaki.destinasi === "jakarta" ? "Jakarta" : kaki.destinasi);
  if (kaki.jenis === "transit" && prev) {
    const dari = viewOf(prev.destinasi, prev.custom);
    const asal = dari?.kota ?? "Jakarta";
    return `${asal} → ${tujuan} · transit ${kaki.lama}j`;
  }
  return tujuan;
}

/** Kode tampilan rute, mis. "CGK → NRT". Tahap asal (Jakarta) tampil "CGK" saja. */
export function kakiCode(kaki: Kaki, prev?: Kaki): string {
  const to = viewOf(kaki.destinasi, kaki.custom);
  const kodeTo = to?.iata ?? (kaki.destinasi === "jakarta" ? "CGK" : (to?.kota ?? kaki.destinasi).toUpperCase().slice(0, 3));
  if (!prev) {
    // Tahap pertama = titik asal; tak ada panah.
    return kaki.destinasi === "jakarta" ? "CGK (asal)" : kodeTo;
  }
  const from = viewOf(prev.destinasi, prev.custom);
  const kodeFrom = prev.destinasi === "jakarta" ? "CGK" : from?.iata ?? "CGK";
  return `${kodeFrom} → ${kodeTo}`;
}

/**
 * Ubah state trip lama (v1: dir + mode + cgkIst/istCgk) jadi daftar tahap.
 * `one` = satu tahap; `pp` = dua tahap. Arah Turki memakai skenario istCgk.
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


/** Biaya alat trip: gunakan daftar pertama yang terisi, termasuk state lama. */
export function sharedCapex(kaki: { scenario: { capex: CapexLine[] } }[]): CapexLine[] {
  return kaki.find((k) => k.scenario.capex.length > 0)?.scenario.capex ?? [];
}
