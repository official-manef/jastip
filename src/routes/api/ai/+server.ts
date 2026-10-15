import { bodyOf, json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";
import { callProvider, parseAiRequest } from "../../../lib/titip/ai";
import { api } from "../../../convex/_generated/api";

/**
 * Asisten AI mode BYOK: key selalu dari pengguna, tidak ada key server.
 * Server hanya memvalidasi origin, sesi, dan URL penyedia (HTTPS publik).
 */

function reply(body: unknown, status = 200) {
  const response = json(body, status);
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "lintas-situs" }, 403);
  const me = await convexServer().query(api.accounts.me, {});
  if (!me.user) return reply({ error: "masuk" }, 401);
  if (Number(request.headers.get("content-length")) > 262144) return reply({ error: "isian" }, 413);
  try {
    const body = await bodyOf(request);
    const input = parseAiRequest(body);
    if (!input.apiKey) return reply({ error: "tanpa-key" }, 400);
    const result = await callProvider(input, input.apiKey);
    return reply(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "provider-error";
    const known = ["invalid-request", "provider-not-allowed", "provider-auth", "provider-limit", "provider-error", "provider-format"];
    return reply({ error: known.includes(code) ? code : "provider-unreachable" },
      code === "invalid-request" || code === "provider-not-allowed" ? 400 : 502);
  }
}
