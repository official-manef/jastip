export function databaseReady(env: Record<string, string | undefined>): boolean {
  return Boolean(env.DATABASE_URL?.trim()) || env.VERCEL !== "1" && env.NODE_ENV !== "production";
}

export function canClaimAdmin(email: string, env: Record<string, string | undefined>): boolean {
  if (env.VERCEL !== "1" && env.NODE_ENV !== "production") return true;
  const owner = env.JASTIP_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(owner) && owner === email.trim().toLowerCase();
}
