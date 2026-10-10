export const ARAH = [
  { id: "cgk-ist", label: "Jakarta → Turki" },
  { id: "ist-cgk", label: "Turki → Jakarta" },
] as const;

export const STATUSES = [
  { id: "baru", label: "Baru" },
  { id: "dibawa", label: "Dibawa" },
  { id: "selesai", label: "Selesai" },
] as const;

export type Arah = (typeof ARAH)[number]["id"];
export type TitipanStatus = (typeof STATUSES)[number]["id"];

export type TitipanRow = {
  id: string;
  userId: string;
  pemilik: string;
  arah: Arah;
  nama: string;
  kg: number;
  catatan: string;
  status: TitipanStatus;
  createdAt: string;
};

export function isArah(value: unknown): value is Arah {
  return value === "cgk-ist" || value === "ist-cgk";
}

export function isStatus(value: unknown): value is TitipanStatus {
  return value === "baru" || value === "dibawa" || value === "selesai";
}

export function arahLabel(arah: Arah): string {
  return ARAH.find((item) => item.id === arah)?.label ?? arah;
}

export function statusLabel(status: TitipanStatus): string {
  return STATUSES.find((item) => item.id === status)?.label ?? status;
}
