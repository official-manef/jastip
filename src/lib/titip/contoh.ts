import { compute, scenarioFor } from "./calc";
import type { Role } from "./roles";
import type { Arah, TitipanStatus } from "./titipan";

export type ContohOrang = {
  id: string;
  name: string;
  email: string;
  role: Role;
  city: string;
};

export type ContohTitipan = {
  id: string;
  orangId: string;
  arah: Arah;
  nama: string;
  kg: number;
  catatan: string;
  status: TitipanStatus;
};

export const CONTOH_ORANG: ContohOrang[] = [
  { id: "sari", name: "Sari Wulandari", email: "sari@contoh.titipin", role: "klien", city: "Jakarta" },
  { id: "deniz", name: "Deniz Kaya", email: "deniz@contoh.titipin", role: "klien", city: "Istanbul" },
  { id: "raka", name: "Raka Wijaya", email: "raka@contoh.titipin", role: "jastiper", city: "Jakarta" },
  { id: "manef", name: "Manef", email: "manef@contoh.titipin", role: "admin", city: "Jakarta" },
];

export const PORTAL_MASUK = ["sari", "raka", "manef"] as const;

const SEED: ContohTitipan[] = [
  {
    id: "t1",
    orangId: "sari",
    arah: "cgk-ist",
    nama: "Serum niacinamide",
    kg: 0.3,
    catatan: "Jangan kena panas.",
    status: "baru",
  },
  {
    id: "t2",
    orangId: "sari",
    arah: "cgk-ist",
    nama: "Kopi biji",
    kg: 1,
    catatan: "Vakum.",
    status: "dibawa",
  },
  {
    id: "t3",
    orangId: "deniz",
    arah: "ist-cgk",
    nama: "Selendang tenun",
    kg: 0.6,
    catatan: "Lipat tipis.",
    status: "baru",
  },
  {
    id: "t4",
    orangId: "deniz",
    arah: "ist-cgk",
    nama: "Lokum",
    kg: 1.2,
    catatan: "Sudah sampai Jakarta.",
    status: "selesai",
  },
];

export function salinOrang(): ContohOrang[] {
  return CONTOH_ORANG.map((orang) => ({ ...orang }));
}

export function salinTitipan(): ContohTitipan[] {
  return SEED.map((row) => ({ ...row }));
}

/** Contoh dashboard portal: hitung satu kaki Jakarta → Turki. */
export function contohTrip() {
  return compute("cgk-ist", scenarioFor("cgk-ist"));
}
