import { getSql } from "../../../lib/db";
import { bodyOf, json, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { parseTrip } from "../../../lib/titip/trip-state";
import { isSlug, resolveSave, uniqueSlug } from "../../../lib/titip/trips";

type Row = { id: string; slug: string; name: string; version: number; state: unknown; updated_at: string };

function bad(error: string, status = 400) {
  return json({ error }, status);
}

/** One owner's trips. Ownership comes from the session, never the request body. */
export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const sql = await getSql();
  const rows = await sql<Row>`
    select slug, name, version, updated_at from trip_scenarios
    where user_id = ${account.user.id} order by updated_at desc limit 100
  `;
  return json({
    trips: rows.map((r) => ({ slug: r.slug, name: r.name, version: Number(r.version), updatedAt: r.updated_at })),
  });
}

/** Create a new trip, auto-naming a free slug. */
export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const body = await bodyOf(request);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const trip = parseTrip(body.trip ?? null);
  if (!trip || name.length < 1) return bad("isian");
  const sql = await getSql();
  const used = await sql<{ slug: string }>`select slug from trip_scenarios where user_id = ${account.user.id}`;
  const slug = uniqueSlug(name, used.map((r) => r.slug));
  const id = `trip-${crypto.randomUUID()}`;
  await sql`
    insert into trip_scenarios (user_id, id, slug, name, state, version)
    values (${account.user.id}, ${id}, ${slug}, ${name}, ${JSON.stringify(trip)}::jsonb, 1)
  `;
  return json({ id, slug, name, version: 1 }, 201);
}

/** Rename a trip or move its scenario; version guards a lost update. */
export async function PATCH({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const body = await bodyOf(request);
  if (!isSlug(body.slug)) return bad("slug");
  const expected = typeof body.version === "number" ? body.version : Number(body.version);
  if (!Number.isInteger(expected) || expected < 0) return bad("versi");
  const trip = body.trip === undefined ? null : parseTrip(body.trip);
  if (body.trip !== undefined && !trip) return bad("isian");
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined;

  const sql = await getSql();
  const found = await sql<{ version: number }>`
    select version from trip_scenarios where user_id = ${account.user.id} and slug = ${body.slug}
  `;
  const current = found.length ? Number(found[0].version) : null;
  const outcome = resolveSave(current, expected);
  if (outcome.kind === "conflict") return json({ error: "konflik", version: outcome.version }, 409);
  if (outcome.kind === "created") return bad("tidak-ada", 404);

  await sql`
    update trip_scenarios set
      name = coalesce(${name ?? null}, name),
      state = case when ${trip ? JSON.stringify(trip) : null}::jsonb is null then state
                   else ${trip ? JSON.stringify(trip) : null}::jsonb end,
      version = ${outcome.version},
      updated_at = now()
    where user_id = ${account.user.id} and slug = ${body.slug}
  `;
  return json({ ok: true, version: outcome.version });
}

/** Delete a trip the caller owns. */
export async function DELETE({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!isSlug(slug)) return bad("slug");
  const sql = await getSql();
  const removed = await sql<{ slug: string }>`
    delete from trip_scenarios where user_id = ${account.user.id} and slug = ${slug} returning slug
  `;
  if (!removed.length) return bad("tidak-ada", 404);
  return json({ ok: true, slug });
}
