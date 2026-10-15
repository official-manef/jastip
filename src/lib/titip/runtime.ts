/** Apakah penyimpanan akun aktif. Sejak auth pindah ke Convex, selalu siap. */
export function databaseReady(_env: Record<string, string | undefined>): boolean {
  return true;
}

export function canClaimAdmin(userId: string, adminUserId: string | undefined): boolean {
  return Boolean(adminUserId?.trim()) && userId === adminUserId?.trim();
}
