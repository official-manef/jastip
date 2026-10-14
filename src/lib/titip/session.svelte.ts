import { browser } from "$app/env";
import { isRole, type Role } from "./roles";

export const PENDING_ROLE_KEY = "titipin-peran";

export type MeUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export const session = $state({
  pending: true,
  user: null as MeUser | null,
  role: null as Role | null,
  databaseReady: false,
  canClaimAdmin: false,
});

let inflight: Promise<void> | null = null;
let resolved = false;

export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (browser) {
    const { getBearerToken } = await import("../auth/client");
    const token = getBearerToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(url, { signal: AbortSignal.timeout(15000), ...init, headers, credentials: "same-origin" });
}

/** Resolve the session once per page load. Later calls share the in-flight request. */
export function loadMe(): Promise<void> {
  if (!browser) return Promise.resolve();
  if (resolved && !inflight) return Promise.resolve();
  return refreshMe();
}

export function refreshMe(): Promise<void> {
  if (!browser) return Promise.resolve();
  if (inflight) return inflight;
  session.pending = true;
  inflight = (async () => {
    try {
      const res = await authedFetch("/api/saya");
      if (!res.ok) throw new Error("sesi");
      const data = (await res.json()) as { user?: MeUser | null; role?: unknown; databaseReady?: boolean; canClaimAdmin?: boolean };
      session.user = data.user ?? null;
      session.role = isRole(data.role) ? data.role : null;
      session.databaseReady = data.databaseReady === true;
      session.canClaimAdmin = data.canClaimAdmin === true;
    } catch {
      session.user = null;
      session.role = null;
      session.databaseReady = false;
      session.canClaimAdmin = false;
    } finally {
      session.pending = false;
      resolved = true;
      inflight = null;
    }
  })();
  return inflight;
}
