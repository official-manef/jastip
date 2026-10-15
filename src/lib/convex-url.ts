/**
 * URL deployment Convex, satu sumber untuk klien maupun server.
 * Klien: `import.meta.env` (Vite, prefix PUBLIC_). Server: `process.env`.
 */
function fromEnv(key: string): string | undefined {
  const meta = (import.meta.env as Record<string, string | undefined>)[key];
  if (meta) return meta;
  const proc = typeof process !== "undefined" ? process.env[key] : undefined;
  return proc && proc.trim() ? proc.trim() : undefined;
}

export const convexUrl = (fromEnv("PUBLIC_CONVEX_URL") ?? "").replace(/\/+$/, "");

/** HTTP actions URL (`*.convex.site`) diturunkan dari `*.convex.cloud`. */
export function convexSiteUrl(): string | undefined {
  const explicit = fromEnv("PUBLIC_CONVEX_SITE_URL");
  if (explicit) return explicit;
  if (!convexUrl.endsWith(".convex.cloud")) return undefined;
  return `${convexUrl.slice(0, -".convex.cloud".length)}.convex.site`;
}
