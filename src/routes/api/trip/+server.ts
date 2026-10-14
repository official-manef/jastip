import { getSql } from "../../../lib/db";
import { bodyOf, json, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { parseTrip } from "../../../lib/titip/trip-state";
import { resolveSave } from "../../../lib/titip/trips";

/** The desk's "current" trip is the owner's `utama` slug — see migrations/0004. */
const SLUG = "utama";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const sql = await getSql();
  const rows = await sql<{ state: unknown; version: number }>`
    select state, version from trip_scenarios where user_id = ${account.user.id} and slug = ${SLUG}
  `;
  return json({
    trip: rows.length ? parseTrip(rows[0].state) : null,
    version: rows.length ? Number(rows[0].version) : 0,
  });
}

export async function PUT({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const body = await bodyOf(request);
  const trip = parseTrip(body.trip ?? body);
  if (!trip) return json({ error: "isian" }, 400);
  const expected = typeof body.version === "number" ? body.version : Number(body.version ?? 0);
  const sql = await getSql();
  const found = await sql<{ version: number }>`
    select version from trip_scenarios where user_id = ${account.user.id} and slug = ${SLUG}
  `;
  const current = found.length ? Number(found[0].version) : null;
  const outcome = resolveSave(current, Number.isInteger(expected) ? expected : 0);
  if (outcome.kind === "conflict") return json({ error: "konflik", version: outcome.version }, 409);
  await sql`
    insert into trip_scenarios (user_id, id, slug, name, state, version)
    values (${account.user.id}, ${`trip-${crypto.randomUUID()}`}, ${SLUG}, 'Trip utama',
            ${JSON.stringify(trip)}::jsonb, ${outcome.version})
    on conflict (user_id, slug) do update
      set state = excluded.state, version = excluded.version, updated_at = now()
  `;
  return json({ ok: true, version: outcome.version });
}
