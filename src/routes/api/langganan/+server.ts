import { api } from "../../../convex/_generated/api";
import { bodyOf, json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";

/**
 * Status langganan (GET) dan pembuatan invoice (POST). Pembayaran nyata
 * ditangani DOKU; di sini hanya menyiapkan invoice `pending` dan membaca
 * status. Kredensial DOKU tidak pernah menyentuh request ini.
 */
export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const result = await convexServer().query(api.subscriptions.mine, {});
  if ("error" in result && result.error) return json({ error: "masuk" }, 401);
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "lintas-situs" }, 403);
  const body = await bodyOf(request);
  if (body.plan !== "pro") return json({ error: "paket" }, 400);
  const result = await convexServer().mutation(api.subscriptions.buatInvoice, { plan: "pro" });
  if ("error" in result && result.error) return json({ error: "masuk" }, 401);
  return json(result, 201);
}
