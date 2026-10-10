import { getSql } from "../../../lib/db";
import { bodyOf, json, listPeople, readAccount, rejectedCrossSite, setRole } from "../../../lib/titip/accounts.server";
import { isRole } from "../../../lib/titip/roles";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  if (account.role !== "admin") return json({ error: "bukan-admin" }, 403);
  const sql = await getSql();
  return json({ people: await listPeople(sql) });
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  if (account.role !== "admin") return json({ error: "bukan-admin" }, 403);
  const body = await bodyOf(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId || !isRole(body.role)) return json({ error: "isian" }, 400);
  const sql = await getSql();
  const result = await setRole(sql, userId, body.role);
  if (!result.ok) return json({ error: result.error }, result.error === "tidak-ada" ? 404 : 409);
  return json({ ok: true });
}
