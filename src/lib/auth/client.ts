import { createAuthClient } from "better-auth/svelte";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

/**
 * Klien Better Auth (browser). `convexClient()` menambah endpoint
 * `convex.token()` untuk menukar sesi jadi JWT Convex. Email/password saja.
 */
export const authClient = createAuthClient({
  plugins: [convexClient()],
});

/** True saat UI masuk harus ditampilkan. */
export const authEnabled = true;

/** Akhiri sesi lokal, lalu arahkan ke `redirectTo`. */
export async function signOut(redirectTo = "/"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Keluar gagal");
  if (typeof window !== "undefined") window.location.href = redirectTo;
}
