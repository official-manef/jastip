import type { Handle } from "@sveltejs/kit/hooks";
import { getToken } from "@mmailaender/convex-better-auth-svelte/sveltekit";
import { withServerConvexToken } from "convex-svelte/sveltekit/server";

/**
 * Ambil JWT Convex dari cookie Better Auth per-request dan simpan ke
 * AsyncLocalStorage, supaya `createConvexHttpClient()` / `convexLoad()` di SSR
 * otomatis terautentikasi. Tidak lagi bergantung `DATABASE_URL`.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  const token = getToken(event.cookies);
  event.locals.token = token;
  const response = await withServerConvexToken(token, () => resolve(event));
  if (path.startsWith("/api/")) response.headers.set("cache-control", "no-store");
  return response;
};
