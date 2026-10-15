import type { Role } from "./roles";

/**
 * Single source of truth for app navigation — desktop sidebar and mobile dock
 * both read this list, so labels, order, and access rules never drift.
 */
export type NavItem = {
  href: string;
  label: string;
  hint: string;
  /** Inline SVG path data (24×24, stroke). Kept here so nav stays one file. */
  icon: string;
  /** Empty = everyone (including signed-out). */
  roles: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/meja",
    label: "Meja",
    hint: "Kalkulator bagasi & tarif",
    icon: "M4 6h16M4 12h16M4 18h10",
    roles: [],
  },
  {
    href: "/portal",
    label: "Portal",
    hint: "Dashboard contoh",
    icon: "M4 5h16v14H4zM4 9h16M9 9v10",
    roles: [],
  },
  {
    href: "/asisten",
    label: "Asisten",
    hint: "Chat & ubah lewat tool",
    icon: "M12 3v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8",
    roles: ["klien", "jastiper", "admin"],
  },
  {
    href: "/titip",
    label: "Titipan",
    hint: "Permintaan titipan",
    icon: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
    roles: ["klien", "jastiper", "admin"],
  },
  {
    href: "/pengaturan",
    label: "AI",
    hint: "Penyedia & model (BYOK)",
    icon: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1M7.7 16.3l-2.1 2.1",
    roles: [],
  },
  {
    href: "/admin",
    label: "Orang",
    hint: "Kelola peran pengguna",
    icon: "M16 20v-1a4 4 0 0 0-8 0v1M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8",
    roles: ["admin"],
  },
];

/** Items the given role may see. Signed out (`null`) sees only public pages. */
export function navFor(role: Role | null): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.length === 0 || (role !== null && item.roles.includes(role)));
}

export function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
