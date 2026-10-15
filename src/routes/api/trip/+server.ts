import { api } from "../../../convex/_generated/api";
import { bodyOf, json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";
import { parseTrip } from "../../../lib/titip/trip-state";

/** Trip aktif meja hitung (slug `utama`) milik pemilik sesi. */
export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const result = await convexServer().query(api.tripScenarios.getMain, {});
  if ("error" in result && result.error) return json({ error: "masuk" }, 401);
  const { trip, version } = result as { trip: unknown; version: number };
  return json({ trip: parseTrip(trip), version });
}

export async function PUT({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const body = await bodyOf(request);
  const trip = parseTrip(body.trip ?? body);
  if (!trip) return json({ error: "isian" }, 400);
  const expected = typeof body.version === "number" ? body.version : Number(body.version ?? 0);
  const result = await convexServer().mutation(api.tripScenarios.saveMain, {
    trip, version: Number.isInteger(expected) ? expected : 0,
  });
  if ("error" in result && result.error) {
    if (result.error === "konflik") return json({ error: "konflik", version: (result as { version: number }).version }, 409);
    return json({ error: "masuk" }, 401);
  }
  return json({ ok: true, version: (result as { version: number }).version });
}
