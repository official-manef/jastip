import type { Handle } from "@sveltejs/kit/hooks";
import { databaseReady } from "./lib/titip/runtime";

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  if (path.startsWith("/api/") && !databaseReady(process.env)) {
    // These reads need no database and keep the public calculator available.
    if (path === "/api/saya" && event.request.method === "GET") {
      return Response.json({ user: null, role: null, databaseReady: false, canClaimAdmin: false }, {
        headers: { "cache-control": "no-store" },
      });
    }
    if (!(["/api/ai", "/api/readiness"].includes(path) && event.request.method === "GET")) {
      return Response.json({ error: "database-unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }
  const response = await resolve(event);
  if (path.startsWith("/api/")) response.headers.set("cache-control", "no-store");
  return response;
};
