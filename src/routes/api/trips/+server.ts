import { getSql } from "../../../lib/db";
import { readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { databaseReady } from "../../../lib/titip/runtime";
import { parseTrip } from "../../../lib/titip/trip-state";
import { newTrip } from "../../../lib/titip/trip-drafts";
import { tripBookSchema } from "../../../lib/titip/trip-drafts";

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function access(request: Request) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  if (!databaseReady(process.env)) return reply({ error: "database-unavailable" }, 503);
  const account = await readAccount(request);
  if (!account) return reply({ error: "masuk" }, 401);
  if (account.role !== "jastiper" && account.role !== "admin") return reply({ error: "peran" }, 403);
  return account;
}

export async function GET({ request }: { request: Request }) {
  const account = await access(request);
  if (account instanceof Response) return account;
  const sql = await getSql();
  const rows = await sql<{ book: unknown; revision: number }>`select book, revision from trip_books where user_id = ${account.user.id}`;
  if (rows[0]) return reply(rows[0]);
  const legacyRows = await sql<{ state: unknown }>`select state from trip_scenarios where user_id = ${account.user.id}`;
  const legacy = legacyRows.length ? parseTrip(legacyRows[0].state) : null;
  if (!legacy) return reply({ book: null, revision: 0 });
  const trip = { ...newTrip("legacy-account", "Trip tersimpan"), dir: legacy.dir, mode: legacy.mode,
    byDir: { "cgk-ist": legacy.cgkIst, "ist-cgk": legacy.istCgk } };
  return reply({ book: { version: 1, activeId: trip.id, trips: [trip] }, revision: 0 });
}

export async function PUT({ request }: { request: Request }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "lintas-situs" }, 403);
  const account = await access(request);
  if (account instanceof Response) return account;
  if (Number(request.headers.get("content-length")) > 2_000_000) return reply({ error: "isian" }, 413);
  const raw = await request.text();
  if (raw.length > 2_000_000) return reply({ error: "isian" }, 413);
  let body: { book?: unknown; revision?: unknown };
  try { body = JSON.parse(raw); } catch { return reply({ error: "isian" }, 400); }
  if (!body || typeof body !== "object") return reply({ error: "isian" }, 400);
  const parsed = tripBookSchema.safeParse(body.book);
  if (!parsed.success || !Number.isSafeInteger(body.revision) || (body.revision as number) < 0) return reply({ error: "isian" }, 400);
  const sql = await getSql();
  const book = JSON.stringify(parsed.data);
  const revision = body.revision as number;
  const rows = revision === 0
    ? await sql<{ revision: number }>`insert into trip_books (user_id, book) values (${account.user.id}, ${book}::jsonb) on conflict (user_id) do nothing returning revision`
    : await sql<{ revision: number }>`update trip_books set book = ${book}::jsonb, revision = revision + 1, updated_at = now() where user_id = ${account.user.id} and revision = ${revision} returning revision`;
  if (!rows.length) return reply({ error: "conflict" }, 409);
  return reply({ revision: rows[0].revision });
}
