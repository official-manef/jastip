/**
 * Standalone TITIPIN email/password authentication, served by SvelteKit.
 * Postgres stores production accounts; PGLite supports local development.
 * No broker OAuth client and no gate identity — email/password only.
 */
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { ensureDbReady, getPglite } from "../db";
import { pgliteDialect } from "./pglite-dialect";

/** This app uses its own email/password accounts (no broker, no gate). */
const emailAndPasswordEnabled = true;

// Kick (and share) PGLite bootstrap as soon as the auth server module loads.
void ensureDbReady();

/**
 * Preview secret must outlive module reloads: PGLite (and its session rows) is
 * stored on `globalThis`, so an HMR re-eval of this file must NOT mint a new
 * signing secret or every existing session becomes invalid mid-dev. Process
 * restart clears both the secret and PGLite together.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __titipinAuthPreviewSecret__?: string;
};
function previewAuthSecret(): string {
  globalAuthRef.__titipinAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__titipinAuthPreviewSecret__;
}

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// Explicit off-switch. Set `VITE_AUTH_ENABLED=false` to force auth off.
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

/** True when the app's own email/password authentication is enabled. */
export const authConfigured = !authDisabled && emailAndPasswordEnabled;

// This app's own Better Auth origin. When deployed the deployer injects the
// public URL; local dev falls back to loopback origins.
const explicitBaseURL = env("BETTER_AUTH_URL");
const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];
const baseURL = explicitBaseURL ?? {
  allowedHosts: ["localhost", "127.0.0.1", "[::1]"],
  protocol: "auto" as const,
  fallback: "http://localhost:8080",
};

// Origins Better Auth accepts on credentialed POSTs (sign-up/sign-in, etc.).
const trustedOrigins: string[] = explicitBaseURL ? [explicitBaseURL, ...LOCAL_DEV_ORIGINS] : [...LOCAL_DEV_ORIGINS];

const databaseUrl = env("DATABASE_URL");

// Real Postgres when `DATABASE_URL` is set (deployed apps), else the app's
// embedded PGLite (preview) via a Kysely dialect.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

export const auth = betterAuth({
  baseURL,
  secret: env("BETTER_AUTH_SECRET") ?? previewAuthSecret(),
  database,
  trustedOrigins,
  session: { cookieCache: { enabled: false } },

  // Local email/password — toggled only via `./email-password` (not a plugin).
  ...(authConfigured && emailAndPasswordEnabled
    ? { emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 } }
    : {}),

  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
  },
});
