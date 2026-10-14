import { createAuthClient } from "better-auth/svelte";

/**
 * Better Auth client for this SvelteKit app (browser side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*` with the
 * HttpOnly session cookie. Email/password only — no broker, no bearer tokens.
 */
export const authClient = createAuthClient();

/** True when sign-in UI should be shown. `VITE_AUTH_ENABLED=false` forces it off. */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** End the local session, then send the visitor to `redirectTo`. */
export async function signOut(redirectTo = "/"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Keluar gagal");
  if (typeof window !== "undefined") window.location.href = redirectTo;
}
