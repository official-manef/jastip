import { api } from "../../../convex/_generated/api";
import { bodyOf, json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";
import { parseTrip } from "../../../lib/titip/trip-state";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const result = await convexServer().query(api.tripScenarios.listTrips, {});
  if ("error" in result && result.error) return json({ error: "masuk" }, 401);
  return json({ trips: (result as { trips: unknown[] }).trips });
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const body = await bodyOf(request);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const trip = parseTrip(body.trip ?? null);
  if (!trip || name.length < 1) return json({ error: "isian" }, 400);
  const result = await convexServer().mutation(api.tripScenarios.createTrip, { name, trip });
  if ("error" in result && result.error) return json({ error: "masuk" }, 401);
  return json(result, 201);
}

export async function PATCH({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const body = await bodyOf(request);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const expected = typeof body.version === "number" ? body.version : Number(body.version);
  if (!slug || !Number.isInteger(expected) || expected < 0) return json({ error: "isian" }, 400);
  const trip = body.trip === undefined ? undefined : parseTrip(body.trip);
  if (body.trip !== undefined && !trip) return json({ error: "isian" }, 400);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined;
  const result = await convexServer().mutation(api.tripScenarios.patchTrip, { slug, name, trip, version: expected });
  if ("error" in result && result.error) {
    const status = result.error === "konflik" ? 409 : result.error === "tidak-ada" ? 404 : result.error === "masuk" ? 401 : 400;
    return json({ error: result.error, ...(result as { version?: number }) }, status);
  }
  return json({ ok: true, version: (result as { version: number }).version });
}

export async function DELETE({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return json({ error: "slug" }, 400);
  const result = await convexServer().mutation(api.tripScenarios.deleteTrip, { slug });
  if ("error" in result && result.error) {
    return json({ error: result.error }, result.error === "tidak-ada" ? 404 : result.error === "masuk" ? 401 : 400);
  }
  return json({ ok: true, slug });
}
