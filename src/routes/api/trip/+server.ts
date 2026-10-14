import { getSql } from "../../../lib/db";
import { bodyOf, json, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { parseTrip } from "../../../lib/titip/trip-state";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const sql = await getSql();
  const rows = await sql<{ state: unknown }>`select state from trip_scenarios where user_id = ${account.user.id}`;
  return json({ trip: rows.length ? parseTrip(rows[0].state) : null });
}

export async function PUT({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const trip = parseTrip(await bodyOf(request));
  if (!trip) return json({ error: "isian" }, 400);
  const sql = await getSql();
  await sql`
    insert into trip_scenarios (user_id, state) values (${account.user.id}, ${JSON.stringify(trip)}::jsonb)
    on conflict (user_id) do update set state = excluded.state, updated_at = now()
  `;
  return json({ ok: true });
}
