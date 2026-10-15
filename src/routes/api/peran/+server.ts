import { api } from "../../../convex/_generated/api";
import { bodyOf, json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";
import { isRole } from "../../../lib/titip/roles";

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const body = await bodyOf(request);
  if (!isRole(body.role)) return json({ error: "peran" }, 400);
  const result = await convexServer().mutation(api.accounts.claimRole, { role: body.role });
  if ("error" in result && result.error) {
    return json({ error: result.error }, result.error === "admin-forbidden" ? 403 : result.error === "masuk" ? 401 : 409);
  }
  return json({ role: (result as { role: string }).role, locked: (result as { locked?: boolean }).locked ?? false });
}
