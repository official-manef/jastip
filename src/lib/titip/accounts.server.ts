/** Helper HTTP bersama untuk route API (`/api/*`). Bebas database. */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Block scripted cross-site calls. Same-origin, non-browser, and top-level GET stay. */
export function rejectedCrossSite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return null;
  const dest = request.headers.get("sec-fetch-dest");
  const topLevelGet =
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    dest !== "object" &&
    dest !== "embed";
  if (topLevelGet) return null;
  return json({ error: "lintas-situs" }, 403);
}

export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    /* not json */
  }
  return {};
}
