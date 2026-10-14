import { bodyOf, json, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { callProvider, DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL, parseAiRequest } from "../../../lib/titip/ai";

function config() {
  const baseUrl = process.env.AI_API_BASE_URL?.trim() || DEFAULT_AI_BASE_URL;
  const model = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  // Operator-approved destinations keep keys out of arbitrary/private servers.
  const allowedHosts = (process.env.AI_ALLOWED_HOSTS || new URL(baseUrl).hostname)
    .split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  return { baseUrl, model, allowedHosts };
}

function reply(body: unknown, status = 200) {
  const response = json(body, status);
  response.headers.set("cache-control", "no-store");
  return response;
}

export function GET() {
  const { baseUrl, model } = config();
  return reply({ baseUrl, model });
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "lintas-situs" }, 403);
  if (!await readAccount(request)) return reply({ error: "masuk" }, 401);
  if (Number(request.headers.get("content-length")) > 16384) return reply({ error: "isian" }, 413);
  try {
    const input = parseAiRequest(await bodyOf(request));
    const result = await callProvider(input, config().allowedHosts);
    return reply(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "provider-error";
    const known = ["invalid-request", "provider-not-allowed", "provider-auth", "provider-limit", "provider-error", "provider-format"];
    return reply({ error: known.includes(code) ? code : "provider-unreachable" },
      code === "invalid-request" || code === "provider-not-allowed" ? 400 : 502);
  }
}
