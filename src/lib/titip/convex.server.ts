import { createConvexHttpClient } from "@mmailaender/convex-better-auth-svelte/sveltekit";
import { convexUrl } from "../convex-url";

/**
 * Convex HTTP client untuk server SvelteKit. Token Better Auth dari cookie
 * dibaca otomatis via `withServerConvexToken` di `hooks.server.ts`.
 */
export function convexServer() {
  return createConvexHttpClient({ convexUrl });
}
