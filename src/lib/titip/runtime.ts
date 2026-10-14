export function databaseReady(env: Record<string, string | undefined>): boolean {
  return Boolean(env.DATABASE_URL?.trim()) || (env.VERCEL !== "1" && env.NODE_ENV !== "production");
}

export function canClaimAdmin(userId: string, adminUserId: string | undefined): boolean {
  return Boolean(adminUserId?.trim()) && userId === adminUserId?.trim();
}
