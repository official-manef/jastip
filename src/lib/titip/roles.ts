export const ROLES = [
  {
    id: "klien",
    label: "Klien",
    blurb: "Titip barang. Kamu yang pesan, jastiper yang bawa.",
  },
  {
    id: "jastiper",
    label: "Jastiper",
    blurb: "Bawa bagasi. Hitung kuota, biaya jalan, dan biaya alat trip.",
  },
  {
    id: "admin",
    label: "Admin",
    blurb: "Pengembang yang ditetapkan operator. Atur peran akun.",
  },
] as const;

export type Role = (typeof ROLES)[number]["id"];

export function isRole(value: unknown): value is Role {
  return value === "klien" || value === "jastiper" || value === "admin";
}

export function roleLabel(role: Role | null): string {
  return ROLES.find((item) => item.id === role)?.label ?? "Belum ada peran";
}

export function homeFor(role: Role | null): string {
  if (role === "klien") return "/dashboard";
  if (role === "admin") return "/dashboard";
  if (role === "jastiper") return "/dashboard";
  return "/masuk";
}
