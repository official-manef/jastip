import { getSql } from "../../../lib/db";
import { bodyOf, claimRole, json, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { isRole } from "../../../lib/titip/roles";
import { canClaimAdmin } from "../../../lib/titip/runtime-ready";

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  const body = await bodyOf(request);
  if (!isRole(body.role)) return json({ error: "peran" }, 400);
  if (body.role === "admin" && account.role !== "admin" && !canClaimAdmin(account.user.email, process.env)) {
    return json({ error: "admin-restricted" }, 403);
  }
  const sql = await getSql();
  const result = await claimRole(sql, account.user.id, body.role);
  if (!result.ok) return json({ error: result.error }, 409);
  return json({ role: result.role, locked: result.locked });
}
